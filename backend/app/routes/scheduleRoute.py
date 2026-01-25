from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload
from app import db
from ..models import (
    Schedule,
    ScheduleMembership,
    MembershipStationWeight,
    ScheduleDay,
)
from ..utils.schedule_utils import generate_schedule_days, populate_holiday_table
from ..utils.schedule_summary_util import get_schedule_summary_data
from ..utils.quota_calculator import calculate_schedule_quotas
from ..utils.schedule_validator import validate_schedule
from datetime import datetime, date

schedule_bp = Blueprint("schedules", __name__)


@schedule_bp.route("/schedules", methods=["POST"])
def create_schedule():
    data = request.get_json()
    try:
        new_schedule = Schedule(
            name=data["name"],
            start_date=datetime.strptime(data["start_date"], "%Y-%m-%d").date(),
            end_date=datetime.strptime(data["end_date"], "%Y-%m-%d").date(),
            status=data.get("status", "draft"),
        )
        db.session.add(new_schedule)

        # Flush sends 'new_schedule' to DB to get its ID without finishing the transaction
        db.session.flush()

        # Populate the holiday table
        start_date = date.fromisoformat(data["start_date"])
        end_date = date.fromisoformat(data["end_date"])
        try:
            populate_holiday_table(data["start_date"], data["end_date"])
        except Exception as e:
            print(f"Holiday fetch failed, continuing with existing data: {e}")

        # Now we can generate the days!
        generate_schedule_days(new_schedule)

        db.session.commit()
        return jsonify(new_schedule.to_dict(summary_only=False)), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@schedule_bp.route("/schedules", methods=["GET"])
def get_schedules():
    """
    List all schedules.
    Fixes N+1 by eager loading memberships to calculate member_count.
    """
    schedules = (
        db.session.query(Schedule)
        .options(selectinload(Schedule.memberships))
        .order_by(Schedule.start_date.desc())
        .all()
    )
    # to_dict defaults to summary_only=True
    return jsonify([s.to_dict() for s in schedules]), 200


@schedule_bp.route("/schedules/<int:id>", methods=["GET"])
def get_single_schedule(id):
    """
    Fetch a full schedule object.
    Deeply eager-loads Memberships -> StationWeights and Days -> Assignments.
    """
    schedule = (
        db.session.query(Schedule)
        .options(
            # Load Days and their Assignments
            selectinload(Schedule.days).selectinload(ScheduleDay.assignments),
            # Load Memberships, their Person details, and their Station Weights
            selectinload(Schedule.memberships).options(
                selectinload(ScheduleMembership.person),
                selectinload(ScheduleMembership.leaves),
                selectinload(ScheduleMembership.exclusions),
                selectinload(ScheduleMembership.station_weights).selectinload(
                    MembershipStationWeight.station
                ),
            ),
        )
        .filter(Schedule.id == id)
        .first()
    )

    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404

    # We use summary_only=False to include the nested children in the JSON
    return jsonify(schedule.to_dict(summary_only=False)), 200


@schedule_bp.route("/schedules/<int:id>", methods=["DELETE"])
def delete_schedule(id):
    """Delete a schedule. Cascades handle the cleanup of child records."""
    schedule = db.session.get(Schedule, id)
    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404

    db.session.delete(schedule)
    db.session.commit()
    return (
        jsonify({"message": "Schedule and all related data successfully deleted"}),
        200,
    )


@schedule_bp.route("/schedules/<int:id>/summary", methods=["GET"])
def get_schedule_summary(id):
    """
    Returns high-level health metrics for a schedule.
    Used by the frontend to determine if the solver can be run.
    """
    summary = get_schedule_summary_data(id)

    if not summary:
        return jsonify({"error": "Schedule not found"}), 404

    return jsonify(summary), 200


@schedule_bp.route("/schedules/<int:schedule_id>/quotas", methods=["GET"])
def get_schedule_quotas(schedule_id):
    try:
        quotas = calculate_schedule_quotas(schedule_id)
        return jsonify(quotas), 200
    except Exception as e:
        # Log the error so you can see it in pytest -s
        print(f"Quota Route Error: {e}")
        return jsonify({"error": str(e)}), 500


@schedule_bp.route("/schedules/<int:schedule_id>/alerts", methods=["GET"])
def get_schedule_alerts(schedule_id):
    """
    Returns a list of validation alerts for the schedule.
    """
    try:
        alerts = validate_schedule(schedule_id)
        return jsonify(alerts), 200
    except Exception as e:
        print(f"Validator Error: {e}")
        return jsonify({"error": str(e)}), 500

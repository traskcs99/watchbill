from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app import db
from ..models import (
    Schedule,
    ScheduleMembership,
    MembershipStationWeight,
    ScheduleDay,
    ScheduleCandidate,
)
from ..utils.schedule_utils import generate_schedule_days, populate_holiday_table
from ..utils.schedule_summary_util import get_schedule_summary_data
from ..utils.quota_calculator import calculate_schedule_quotas
from ..utils.schedule_validator import validate_schedule
from ..utils.optimization_service import run_schedule_optimization
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


@schedule_bp.route("/schedules/<int:id>", methods=["PATCH"])
def update_schedule(id):
    schedule = db.session.get(Schedule, id)
    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404

    data = request.json

    # Standard Fields
    if "name" in data:
        schedule.name = data["name"]
    if "status" in data:
        schedule.status = data["status"]

    # 🟢 1. Handle the JSON Dictionary Field
    if "group_weights" in data:
        # Ensure it is a dictionary
        if isinstance(data["group_weights"], dict):
            schedule.group_weights = data["group_weights"]
            # 🟢 2. Tell SQLAlchemy the JSON content changed
            flag_modified(schedule, "group_weights")

    # Optimization / Goat Points Weights
    optimization_keys = [
        "weight_quota_deviation",
        "weight_spacing_1_day",
        "weight_spacing_2_day",
        "weight_same_weekend",
        "weight_consecutive_weekends",
        "weight_goal_deviation",
    ]

    for key in optimization_keys:
        if key in data:
            if isinstance(data[key], (int, float)):
                setattr(schedule, key, float(data[key]))

    db.session.commit()
    # 🟢 3. Return the full object so the frontend sees the new weights
    return jsonify(schedule.to_dict(summary_only=False))


@schedule_bp.route("/schedules/<int:id>/generate", methods=["POST"])
def generate_candidates(id):
    """
    Triggers the optimization solver to generate multiple schedule options.
    """
    data = request.get_json() or {}
    num_candidates = data.get("num_candidates", 5)

    # Run the service logic you provided
    result = run_schedule_optimization(id, num_candidates=num_candidates)

    if result.get("status") == "error":
        return jsonify(result), 404

    return jsonify(result), 200


@schedule_bp.route("/schedules/<int:id>/candidates", methods=["GET"])
def get_candidates(id):
    # 🟢 Use select() to find all candidates matching the schedule_id
    stmt = (
        select(ScheduleCandidate)
        .filter_by(schedule_id=id)
        .order_by(ScheduleCandidate.score.asc())  # Best scores first
    )

    # Execute the query and get all results
    candidates = db.session.scalars(stmt).all()

    # Return as a JSON list
    return jsonify([c.to_dict() for c in candidates]), 200

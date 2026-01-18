from flask import Blueprint, request, jsonify
from sqlalchemy.orm import selectinload
from app import db
from ..models import (
    Schedule,
    ScheduleMembership,
    MembershipStationWeight,
    ScheduleDay,
)
from ..utils.schedule_utils import generate_schedule_days
from datetime import datetime

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

from flask import Blueprint, request, jsonify
from ..database import db
from ..models import ScheduleDay, ScheduleMembership, ScheduleLeave, Person, Schedule
from collections import defaultdict
from datetime import timedelta


day_bp = Blueprint("schedule_days", __name__)


@day_bp.route("/schedules/<int:schedule_id>/days", methods=["GET"])
def get_schedule_days(schedule_id):
    # 1. Modern SQLAlchemy 2.0 / Flask-SQLAlchemy 3.0 syntax
    # This avoids the LegacyAPIWarning and handles the 404
    stmt = (
        db.select(Schedule)
        .options(
            db.joinedload(Schedule.memberships).joinedload(ScheduleMembership.leaves),
            db.joinedload(Schedule.memberships).joinedload(ScheduleMembership.person),
        )
        .filter_by(id=schedule_id)
    )

    schedule = db.session.execute(stmt).unique().scalar_one_or_none()

    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404

    # Use the shared logic from the model
    leaves_map = schedule._get_leaves_by_date()

    # Return the days using the standard Day to_dict
    return jsonify(
        [
            d.to_dict(day_leaves=leaves_map.get(d.date.isoformat(), []))
            for d in schedule.days
        ]
    )


@day_bp.route("/schedule-days/<int:id>", methods=["PATCH"])
def patch_day(id):
    day = db.session.get(ScheduleDay, id)
    if not day:
        return jsonify({"error": "Schedule day not found"}), 404

    data = request.get_json()

    try:
        if "weight" in data:
            # This is where the crash usually happens
            day.weight = float(data["weight"])

        if "name" in data:
            day.name = data["name"]

        if "is_holiday" in data:
            day.is_holiday = bool(data["is_holiday"])

        if "label" in data:
            day.label = data["label"]

        db.session.commit()
        return jsonify(day.to_dict()), 200

    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({"error": "Invalid data format. Weight must be a number."}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@day_bp.route("/schedule-days/<int:id>", methods=["PUT"])
def update_schedule_day(id):
    """Full replacement of a day's properties."""
    day = db.session.get(ScheduleDay, id)
    if not day:
        return jsonify({"error": "Schedule day not found"}), 404

    data = request.get_json()
    day.name = data.get("name", "")
    day.label = data.get("label")
    day.weight = data.get("weight", 1.0)
    day.is_holiday = data.get("is_holiday", False)
    day.availability_estimate = data.get("availability_estimate", 1.0)

    db.session.commit()
    return jsonify(day.to_dict()), 200

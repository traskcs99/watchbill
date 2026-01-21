from flask import Blueprint, request, jsonify
from ..database import db
from ..models import ScheduleDay, ScheduleMembership, ScheduleLeave, Person
from collections import defaultdict
from datetime import timedelta


day_bp = Blueprint("schedule_days", __name__)


@day_bp.route("/schedules/<int:schedule_id>/days", methods=["GET"])
def get_schedule_days(schedule_id):
    # 1. Single query for all days
    days = (
        ScheduleDay.query.filter_by(schedule_id=schedule_id)
        .order_by(ScheduleDay.date)
        .all()
    )

    # 2. Single query for all leaves (Joined with Person to get names)
    leave_records = (
        db.session.query(ScheduleLeave, Person.name)
        .join(ScheduleMembership, ScheduleLeave.membership_id == ScheduleMembership.id)
        .join(Person, ScheduleMembership.person_id == Person.id)
        # FIX: Change 'id' to 'schedule_id' here
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .all()
    )

    # 3. Explode ranges into a dictionary
    leaves_by_date = defaultdict(list)
    for l, p_name in leave_records:
        curr = l.start_date
        while curr <= l.end_date:
            leaves_by_date[curr.isoformat()].append(
                {"id": l.id, "person_name": p_name, "reason": l.reason}
            )
            curr += timedelta(days=1)

    # 4. Return results
    return jsonify(
        [d.to_dict(day_leaves=leaves_by_date.get(d.date.isoformat(), [])) for d in days]
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

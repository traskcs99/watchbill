from flask import Blueprint, request, jsonify
from sqlalchemy.orm import joinedload
from app import db
from app.models import ScheduleExclusion, ScheduleMembership, ScheduleDay, Schedule

exclusion_bp = Blueprint("exclusions", __name__)


@exclusion_bp.route("exclusions/schedule/<int:schedule_id>", methods=["GET"])
# app/routes/exclusion_routes.py


@exclusion_bp.route("/exclusions/schedule/<int:schedule_id>", methods=["GET"])
def get_exclusions_for_schedule(schedule_id):
    # 1. Check Schedule Existence
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return jsonify({"error": f"Schedule {schedule_id} not found"}), 404

    try:
        # 2. THE FIX IS HERE
        exclusions = (
            db.session.query(ScheduleExclusion)
            .join(ScheduleExclusion.day)  # <--- Join the "Bridge" table
            .filter(
                ScheduleDay.schedule_id == schedule_id
            )  # <--- Filter on the Day's link to schedule
            .options(
                joinedload(ScheduleExclusion.day),
                joinedload(ScheduleExclusion.membership).joinedload(
                    ScheduleMembership.person
                ),
            )
            .all()
        )

        return jsonify([e.to_dict() for e in exclusions]), 200

    except Exception as e:
        print(f"Error fetching exclusions: {e}")  # This helped us find the bug!
        return jsonify({"error": str(e)}), 500

    except Exception as e:
        # 3. Generic Error Handling
        # Log the actual error for your dev eyes, return a clean message to the front end
        print(f"Error fetching exclusions: {str(e)}")
        return (
            jsonify(
                {"error": "An internal server error occurred while fetching exclusions"}
            ),
            500,
        )


@exclusion_bp.route("/exclusions", methods=["POST"])
def create_exclusion():
    data = request.get_json() or {}

    # 1. Validate Input Keys
    if "day_id" not in data or "membership_id" not in data:
        # Update the string to match your test exactly if needed,
        # or update the test. This matches the test error you saw:
        return jsonify({"error": "Missing membership_id or day_id"}), 400

    # 2. Manual 404 Checks (Satisfies test_create_exclusion_invalid_ids)
    day = db.session.get(ScheduleDay, data["day_id"])
    if not day:
        return jsonify({"error": "Day not found"}), 404

    membership = db.session.get(ScheduleMembership, data["membership_id"])
    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    # 3. Create
    new_exclusion = ScheduleExclusion(
        day_id=data["day_id"],
        membership_id=data["membership_id"],
        reason=data.get("reason"),
    )

    try:
        db.session.add(new_exclusion)
        db.session.commit()
        # This will now work because we fixed the indentation in Step 1
        return jsonify(new_exclusion.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@exclusion_bp.route("/exclusions/batch", methods=["POST"])
def batch_create_exclusions():
    """Atomic batch insert for exclusions."""
    payload = request.get_json()
    if not isinstance(payload, list):
        return jsonify({"error": "Payload must be a list"}), 400

    new_exclusions = []
    try:
        for item in payload:
            exc = ScheduleExclusion(
                membership_id=item["membership_id"],
                day_id=item["day_id"],
                reason=item.get("reason", ""),
            )
            new_exclusions.append(exc)

        db.session.add_all(new_exclusions)
        db.session.commit()
        return jsonify([e.to_dict() for e in new_exclusions]), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@exclusion_bp.route("/exclusions/<int:id>", methods=["PATCH"])
def update_exclusion(id):
    exc = db.session.get(ScheduleExclusion, id)
    if not exc:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json()
    if "reason" in data:
        exc.reason = data["reason"]
    if "day_id" in data:
        exc.day_id = data["day_id"]

    db.session.commit()
    return jsonify(exc.to_dict()), 200


@exclusion_bp.route("/exclusions/<int:id>", methods=["DELETE"])
def delete_exclusion(id):
    exc = db.session.get(ScheduleExclusion, id)
    if not exc:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(exc)
    db.session.commit()
    return jsonify({"message": "Exclusion removed"}), 200


@exclusion_bp.route("/exclusions/toggle", methods=["POST"])
def toggle_exclusion():
    try:
        data = request.get_json()
        day_id = data.get("day_id")
        membership_id = data.get("membership_id")

        if not day_id or not membership_id:
            return jsonify({"error": "Missing day_id or membership_id"}), 400

        # 1. Look for an existing exclusion
        existing = ScheduleExclusion.query.filter_by(
            day_id=day_id, membership_id=membership_id
        ).first()

        if existing:
            # 2. If it exists, the user is "unchecking" the box -> Delete it
            db.session.delete(existing)
            message = "Exclusion removed"
        else:
            # 3. If it doesn't exist, the user is "checking" the box -> Create it
            new_exclusion = ScheduleExclusion(
                day_id=day_id, membership_id=membership_id
            )
            db.session.add(new_exclusion)
            message = "Exclusion added"

        db.session.commit()
        return jsonify({"message": message}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

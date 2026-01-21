from flask import Blueprint, request, jsonify
from app import db
from app.models import ScheduleLeave, ScheduleMembership, Person
from datetime import datetime

leave_bp = Blueprint("leaves", __name__)

# --- Helper Utilities ---


def parse_date(date_str):
    """Parses YYYY-MM-DD string to date object."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def validate_leave_logic(start_date, end_date):
    """Ensures start date is not after end date."""
    if start_date and end_date and start_date > end_date:
        return "Start date cannot be after end date."
    return None


# --- Routes ---


@leave_bp.route("/leaves", methods=["GET"])
def get_leaves():
    schedule_id = request.args.get("schedule_id")
    if not schedule_id:
        return jsonify({"error": "Missing schedule_id parameter"}), 400

    # Query: Join Leave -> Membership -> Person to get the name
    results = (
        db.session.query(ScheduleLeave, Person.name)
        .join(ScheduleMembership, ScheduleLeave.membership_id == ScheduleMembership.id)
        .join(Person, ScheduleMembership.person_id == Person.id)
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .all()
    )

    # Serialize results and inject person_name
    leaves_data = []
    for leave, person_name in results:
        leave_dict = leave.to_dict()
        leave_dict["person_name"] = person_name
        leaves_data.append(leave_dict)

    return jsonify(leaves_data), 200


@leave_bp.route("/leaves", methods=["POST"])
def create_leave():
    """Create a single leave record."""
    data = request.get_json()

    # Basic Input Validation
    if not all(k in data for k in ["membership_id", "start_date", "end_date"]):
        return jsonify({"error": "Missing required fields"}), 400

    start = parse_date(data["start_date"])
    end = parse_date(data["end_date"])

    if not start or not end:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    # Logic Validation
    error = validate_leave_logic(start, end)
    if error:
        return jsonify({"error": error}), 400

    # Integrity Check
    if not db.session.get(ScheduleMembership, data["membership_id"]):
        return jsonify({"error": "Membership not found"}), 404

    try:
        new_leave = ScheduleLeave(
            membership_id=data["membership_id"],
            start_date=start,
            end_date=end,
            reason=data.get("reason", ""),
        )
        db.session.add(new_leave)
        db.session.commit()
        return jsonify(new_leave.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@leave_bp.route("/leaves/batch", methods=["POST"])
def batch_create_leaves():
    """
    Atomic Batch Insert.
    Accepts a list of leave objects.
    If ANY fail validation, the whole batch is rejected (Safety First).
    """
    payload = request.get_json()

    if not isinstance(payload, list):
        return jsonify({"error": "Payload must be a list of leave objects"}), 400

    if len(payload) > 50:  # Protection against massive payloads
        return jsonify({"error": "Batch size limit exceeded (max 50)"}), 400

    created_leaves = []

    try:
        # 1. Validation Phase (No DB writes yet)
        for index, item in enumerate(payload):
            if "membership_id" not in item:
                return jsonify({"error": f"Item {index}: Missing membership_id"}), 400

            start = parse_date(item.get("start_date"))
            end = parse_date(item.get("end_date"))

            if not start or not end:
                return jsonify({"error": f"Item {index}: Invalid dates"}), 400

            logic_error = validate_leave_logic(start, end)
            if logic_error:
                return jsonify({"error": f"Item {index}: {logic_error}"}), 400

            # Optional: Check membership exists for every item?
            # Can be expensive. Trusting FK constraints or doing a bulk check is better.
            # For now, let's trust the IntegrityError to catch bad IDs.

            new_leave = ScheduleLeave(
                membership_id=item["membership_id"],
                start_date=start,
                end_date=end,
                reason=item.get("reason", ""),
            )
            created_leaves.append(new_leave)

        # 2. Execution Phase
        db.session.add_all(created_leaves)
        db.session.commit()  # Atomic Commit

        return (
            jsonify(
                {
                    "message": f"Successfully created {len(created_leaves)} leave records",
                    "leaves": [l.to_dict() for l in created_leaves],
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Batch transaction failed: {str(e)}"}), 400


@leave_bp.route("/leaves/<int:id>", methods=["PUT"])
def update_leave_full(id):
    """Full Update: Replaces all data for a specific leave ID."""
    leave = db.session.get(ScheduleLeave, id)
    if not leave:
        return jsonify({"error": "Leave not found"}), 404

    data = request.get_json()
    required = ["start_date", "end_date", "reason"]

    # PUT implies sending the whole resource representation
    if not all(k in data for k in required):
        return jsonify({"error": f"PUT requires all fields: {required}"}), 400

    start = parse_date(data["start_date"])
    end = parse_date(data["end_date"])

    error = validate_leave_logic(start, end)
    if error:
        return jsonify({"error": error}), 400

    try:
        leave.start_date = start
        leave.end_date = end
        leave.reason = data["reason"]
        # Note: We usually don't allow changing 'membership_id' via PUT,
        # as that changes ownership.

        db.session.commit()
        return jsonify(leave.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@leave_bp.route("/leaves/<int:id>", methods=["PATCH"])
def update_leave_partial(id):
    """Partial Update: Only updates fields provided in the payload."""
    leave = db.session.get(ScheduleLeave, id)
    if not leave:
        return jsonify({"error": "Leave not found"}), 404

    data = request.get_json()

    # Determine new values (fallback to existing if not provided)
    new_start_str = data.get("start_date")
    new_end_str = data.get("end_date")

    current_start = leave.start_date
    current_end = leave.end_date

    # 1. Update Start Date if provided
    if new_start_str:
        parsed_start = parse_date(new_start_str)
        if not parsed_start:
            return jsonify({"error": "Invalid start_date format"}), 400
        current_start = parsed_start
        leave.start_date = parsed_start

    # 2. Update End Date if provided
    if new_end_str:
        parsed_end = parse_date(new_end_str)
        if not parsed_end:
            return jsonify({"error": "Invalid end_date format"}), 400
        current_end = parsed_end
        leave.end_date = parsed_end

    # 3. Validation Logic Check (Compare the potentially mixed new/old dates)
    if current_start > current_end:
        return jsonify({"error": "Resulting start date would be after end date"}), 400

    # 4. Update Reason if provided
    if "reason" in data:
        leave.reason = data["reason"]

    try:
        db.session.commit()
        return jsonify(leave.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@leave_bp.route("/leaves/<int:id>", methods=["DELETE"])
def delete_leave(id):
    """Deletes a leave record."""
    leave = db.session.get(ScheduleLeave, id)
    if not leave:
        return jsonify({"error": "Leave record not found"}), 404

    db.session.delete(leave)
    db.session.commit()
    return jsonify({"message": "Leave deleted"}), 200

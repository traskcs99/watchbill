from flask import Blueprint, request, jsonify
from ..database import db
from ..models import ScheduleMembership, Person  # Updated class name
from sqlalchemy.orm import joinedload
from ..utils.schedule_utils import add_person_to_schedule

# Changed blueprint name to memberships for consistency
membership_bp = Blueprint("memberships", __name__)


@membership_bp.route("/schedule-memberships", methods=["GET"])
def get_all_memberships():
    schedule_id = request.args.get("schedule_id")

    # We "eagerly" load the related objects using JOINs
    query = db.session.query(ScheduleMembership).options(
        joinedload(ScheduleMembership.person),
        joinedload(ScheduleMembership.group),
        joinedload(ScheduleMembership.exclusions),
        joinedload(ScheduleMembership.leaves),
    )

    if schedule_id:
        query = query.filter_by(schedule_id=schedule_id)

    memberships = query.all()
    # Now to_dict() uses data already in memory, no extra queries!
    return jsonify([m.to_dict() for m in memberships]), 200


@membership_bp.route("/schedule-memberships/<int:id>", methods=["GET"])
def get_membership(id):
    """Fetch a single membership record by ID."""
    membership = db.session.get(ScheduleMembership, id)
    if not membership:
        return jsonify({"error": "Membership not found"}), 404
    return jsonify(membership.to_dict()), 200


@membership_bp.route("/schedule-memberships", methods=["POST"])
def add_person_to_schedule_route():
    """
    API endpoint to add a person to a specific schedule.
    It utilizes the utility function to handle station weight initialization.
    """
    data = request.get_json()

    # 1. Validation: Ensure we have the minimum required IDs
    schedule_id = data.get("schedule_id")
    person_id = data.get("person_id")

    if not schedule_id or not person_id:
        return jsonify({"error": "schedule_id and person_id are required fields"}), 400

    # 2. Prevent Duplicates: Check if this person is already in the schedule
    exists = (
        db.session.query(ScheduleMembership)
        .filter_by(schedule_id=schedule_id, person_id=person_id)
        .first()
    )

    if exists:
        return (
            jsonify(
                {"error": "This person is already a member of the selected schedule."}
            ),
            400,
        )

    try:
        # 3. Execution: Call the utility function
        # We pass 'data' as the overrides dictionary so the utility can
        # pick up any override_seniorityFactor, etc., if they were provided.
        new_membership = add_person_to_schedule(schedule_id, person_id, overrides=data)

        if not new_membership:
            return jsonify({"error": "Personnel record not found."}), 404

        # 4. Response: Return the full dictionary including the new station weights
        return jsonify(new_membership.to_dict()), 201

    except Exception as e:
        # In case of database or logic errors, rollback is handled by the utility,
        # but we catch and report the error here for the frontend.
        db.session.rollback()
        return jsonify({"error": f"Failed to initialize membership: {str(e)}"}), 500


@membership_bp.route("/schedule-memberships/<int:id>", methods=["PATCH"])
def patch_membership_overrides(id):
    """Update specific overrides for a membership (Partial Update)."""
    membership = db.session.get(ScheduleMembership, id)
    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    data = request.get_json()
    for key in [
        "override_seniorityFactor",
        "override_min_assignments",
        "override_max_assignments",
    ]:
        if key in data:
            setattr(membership, key, data[key])

    db.session.commit()
    return jsonify(membership.to_dict()), 200


@membership_bp.route("/schedule-memberships/<int:id>", methods=["DELETE"])
def remove_person_from_schedule(id):
    """Remove a person from a schedule (Delete membership)."""
    membership = db.session.get(ScheduleMembership, id)
    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": "Membership removed"}), 200

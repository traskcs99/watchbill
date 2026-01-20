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
@membership_bp.route("/schedule-memberships", methods=["POST"])
def add_membership():
    data = request.get_json()

    try:
        # Extract known overrides from the JSON payload
        overrides = {
            "override_max_assignments": data.get("override_max_assignments"),
            "override_min_assignments": data.get("override_min_assignments"),
            "override_seniorityFactor": data.get("override_seniorityFactor"),
        }

        # Pass them as **kwargs to the utility
        new_mem = add_person_to_schedule(
            schedule_id=int(data["schedule_id"]),
            person_id=int(data["person_id"]),
            group_id=data.get("group_id"),
            **overrides,  # This unpacks the dictionary into arguments
        )

        db.session.commit()
        return jsonify(new_mem.to_dict()), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        # Log the actual error for debugging
        print(f"Server Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


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

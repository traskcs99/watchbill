from flask import Blueprint, request, jsonify
from sqlalchemy.orm import joinedload
from ..database import db
from ..models import Assignment, ScheduleMembership

assignment_bp = Blueprint("assignments", __name__)


# --- GET ALL (Optimized with Eager Loading) ---
@assignment_bp.route("/schedules/<int:schedule_id>/assignments", methods=["GET"])
def get_schedule_assignments(schedule_id):
    """
    Fetch all slots for a month.
    Uses joinedload to prevent N+1 queries for station and person names.
    """
    assignments = (
        db.session.query(Assignment)
        .filter_by(schedule_id=schedule_id)
        .options(
            joinedload(Assignment.master_station),
            joinedload(Assignment.day),
            # Nested join: Membership -> Person
            joinedload(Assignment.membership).joinedload(ScheduleMembership.person),
        )
        .all()
    )

    return jsonify([a.to_dict() for a in assignments]), 200


# --- GET ONE ---
@assignment_bp.route("/assignments/<int:id>", methods=["GET"])
def get_assignment(id):
    assignment = db.session.get(Assignment, id)
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404
    return jsonify(assignment.to_dict()), 200


# --- PATCH (Manual Override & Availability) ---
@assignment_bp.route("/assignments/<int:id>", methods=["PATCH"])
def patch_assignment(id):
    assignment = db.session.get(Assignment, id)
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404

    data = request.get_json()

    # 1. Handle Membership Change
    if "membership_id" in data:
        new_member_id = data["membership_id"]

        # If assigning a specific person...
        if new_member_id is not None:
            # Validate existence
            mem = db.session.get(ScheduleMembership, new_member_id)
            if not mem:
                return jsonify({"error": "Member not found"}), 404

            # Logic: If I manually pick someone, I usually want them locked there.
            assignment.is_locked = True
            assignment.membership_id = new_member_id

        # If clearing the assignment (Unassigned)...
        else:
            # Logic: An empty slot must be unlocked so the solver can use it.
            assignment.is_locked = False
            assignment.membership_id = None

    # 2. Allow Explicit Lock Override
    # (This runs AFTER the auto-logic above, so it takes precedence if sent in the same request)
    if "is_locked" in data:
        assignment.is_locked = bool(data["is_locked"])

    # 3. Update Manpower/Availability Estimate
    if "availability_estimate" in data:
        assignment.availability_estimate = data["availability_estimate"]

    db.session.commit()
    return jsonify(assignment.to_dict()), 200


# --- DELETE ---
@assignment_bp.route("/assignments/<int:id>", methods=["DELETE"])
def delete_assignment(id):
    assignment = db.session.get(Assignment, id)
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404

    db.session.delete(assignment)
    db.session.commit()
    return jsonify({"message": f"Slot {id} removed"}), 200

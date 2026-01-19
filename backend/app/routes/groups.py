from flask import Blueprint, request, jsonify
from sqlalchemy import select, func
from ..database import db
from ..models import Group

group_bp = Blueprint("groups", __name__)


@group_bp.route("/groups", methods=["GET"])
def get_groups():
    # Primary sort: Priority (1, 2, 3...)
    # Secondary sort: Name (A-Z)
    stmt = select(Group).order_by(Group.priority.asc(), Group.name.asc())
    groups = db.session.execute(stmt).scalars().all()
    return jsonify([g.to_dict() for g in groups])


@group_bp.route("/groups", methods=["POST"])
def create_group():
    data = request.json

    # 1. Find the current highest priority
    # "select max(priority) from groups"
    max_priority = db.session.query(func.max(Group.priority)).scalar() or 0

    # 2. Set new group to max + 1 (Bottom of list)
    new_priority = max_priority + 1

    new_group = Group(
        name=data.get("name"),
        min_assignments=data.get("min_assignments", 0),
        max_assignments=data.get("max_assignments", 8),
        seniorityFactor=data.get("seniorityFactor", 1.0),
        priority=new_priority,  # <--- Auto-assigned
    )

    db.session.add(new_group)
    db.session.commit()
    return jsonify(new_group.to_dict()), 201


@group_bp.route("/groups/<int:id>", methods=["PUT"])
def update_group(id):
    group = db.session.get(Group, id)
    if not group:
        return jsonify({"error": "Group not found"}), 404

    data = request.json

    # Update standard fields
    if "name" in data:
        group.name = data["name"]
    if "min_assignments" in data:
        group.min_assignments = data["min_assignments"]
    if "max_assignments" in data:
        group.max_assignments = data["max_assignments"]
    if "seniorityFactor" in data:
        group.seniorityFactor = data["seniorityFactor"]

    # CRITICAL: We intentionally IGNORE 'priority' here.
    # Even if the frontend sends it, we do not update it.
    # Priority changes happen ONLY in the /reorder endpoint.

    db.session.commit()
    return jsonify(group.to_dict())


@group_bp.route("/groups/<int:id>", methods=["DELETE"])
def delete_group(id):
    # 1. Find the group
    group = db.session.get(Group, id)
    if not group:
        return jsonify({"error": "Group not found"}), 404

    # 2. Delete it
    db.session.delete(group)

    # 3. Re-normalize the priorities of the REMAINING groups
    # We fetch them ordered by their current priority to keep relative order
    remaining_groups = Group.query.order_by(Group.priority).all()

    for index, g in enumerate(remaining_groups):
        # index starts at 0, so priority becomes 1, 2, 3...
        g.priority = index + 1

    db.session.commit()
    return jsonify({"message": "Group deleted and priorities reordered"}), 200


@group_bp.route("/groups/bulk-update", methods=["PATCH"])
def bulk_update_groups():
    """
    Useful for updating seniority or assignment limits across all groups at once.
    Expected: [{"id": 1, "seniorityFactor": 1.5}, {"id": 2, "seniorityFactor": 1.0}]
    """
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of updates"}), 400

    for item in data:
        group = db.session.get(Group, item["id"])
        if group:
            if "seniorityFactor" in item:
                group.seniorityFactor = item["seniorityFactor"]
            if "min_assignments" in item:
                group.min_assignments = item["min_assignments"]
            if "max_assignments" in item:
                group.max_assignments = item["max_assignments"]

    db.session.commit()
    return jsonify({"message": "Groups updated successfully"}), 200


@group_bp.route("/groups/reorder", methods=["POST"])
def reorder_groups():
    # Expects a list of IDs in the new desired order: [3, 1, 5, 2]
    new_order_ids = request.json.get("ids", [])

    # Loop through the list and update priority based on index
    # Index 0 = Priority 1 (Highest)
    for index, group_id in enumerate(new_order_ids):
        group = db.session.get(Group, group_id)  # SQLAlchemy 2.0 style
        if not group:
            group = Group.query.get(group_id)  # Legacy style fallback

        if group:
            group.priority = index + 1

    db.session.commit()
    return jsonify({"message": "Order updated successfully"}), 200

from flask import Blueprint, request, jsonify
from sqlalchemy import select
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
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Group name is required"}), 400

    new_group = Group(
        name=data["name"],
        priority=data.get("priority", 1),
        seniorityFactor=data.get("seniorityFactor", 1.0),
        min_assignments=data.get("min_assignments", 0),
        max_assignments=data.get("max_assignments", 10),
    )

    db.session.add(new_group)
    db.session.commit()
    return jsonify(new_group.to_dict()), 201


@group_bp.route("/groups/<int:id>", methods=["PUT"])
def update_group(id):
    group = db.session.get(Group, id)
    if not group:
        return jsonify({"error": "Group not found"}), 404

    data = request.get_json()

    # Update fields if they exist in the request, otherwise keep existing
    group.name = data.get("name", group.name)
    group.seniorityFactor = data.get("seniorityFactor", group.seniorityFactor)
    group.min_assignments = data.get("min_assignments", group.min_assignments)
    group.max_assignments = data.get("max_assignments", group.max_assignments)

    db.session.commit()
    return jsonify(group.to_dict())


@group_bp.route("/groups/<int:id>", methods=["DELETE"])
def delete_group(id):
    group = db.session.get(Group, id)
    if not group:
        return jsonify({"error": "Group not found"}), 404

    db.session.delete(group)
    db.session.commit()
    return jsonify({"message": f"Group '{group.name}' deleted successfully"}), 200


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

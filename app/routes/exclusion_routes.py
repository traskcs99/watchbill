from flask import Blueprint, request, jsonify
from app import db
from app.models import ScheduleExclusion, ScheduleMembership, ScheduleDay

exclusion_bp = Blueprint("exclusions", __name__)

@exclusion_bp.route("/exclusions", methods=["POST"])
def create_exclusion():
    data = request.get_json()
    
    # 1. Validation
    if not all(k in data for k in ["membership_id", "day_id"]):
        return jsonify({"error": "Missing membership_id or day_id"}), 400

    # 2. Check existence
    membership = db.session.get(ScheduleMembership, data["membership_id"])
    day = db.session.get(ScheduleDay, data["day_id"])
    
    if not membership or not day:
        return jsonify({"error": "Membership or Day not found"}), 404

    try:
        new_exc = ScheduleExclusion(
            membership_id=data["membership_id"],
            day_id=data["day_id"],
            reason=data.get("reason", "")
        )
        db.session.add(new_exc)
        db.session.commit()
        return jsonify(new_exc.to_dict()), 201
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
                reason=item.get("reason", "")
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

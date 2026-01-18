from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from ..database import db
from ..models import MembershipStationWeight, ScheduleMembership

membership_station_bp = Blueprint("membership_stations", __name__)


@membership_station_bp.route(
    "/memberships/<int:membership_id>/station-weights", methods=["GET"]
)
def get_weights(membership_id):
    """Fetch all roles/weights assigned to a person for this schedule."""
    weights = MembershipStationWeight.query.filter_by(membership_id=membership_id).all()
    return jsonify([w.to_dict() for w in weights]), 200


@membership_station_bp.route(
    "/memberships/<int:membership_id>/station-weights", methods=["POST"]
)
def set_station_weight(membership_id):
    data = request.get_json()
    station_id = data.get("station_id")

    # 1. Get the Membership and the Person
    membership = db.session.get(ScheduleMembership, membership_id)
    if not membership:
        return jsonify({"error": "Membership not found"}), 404

    # 2. VALIDATION: Check if the Person has the Qualification for this Station
    # This assumes a relationship exists: Person.qualifications
    is_qualified = any(
        q.station_id == station_id for q in membership.person.qualifications
    )

    if not is_qualified:
        return (
            jsonify(
                {
                    "error": f"Person {membership.person.name} is not qualified for this station."
                }
            ),
            400,
        )

    # 3. Proceed with Upsert (Create or Update)
    weight_entry = MembershipStationWeight.query.filter_by(
        membership_id=membership_id, station_id=station_id
    ).first()

    if weight_entry:
        weight_entry.weight = float(data.get("weight", 1.0))
    else:
        weight_entry = MembershipStationWeight(
            membership_id=membership_id,
            station_id=station_id,
            weight=float(data.get("weight", 1.0)),
        )
        db.session.add(weight_entry)

    db.session.commit()
    return jsonify(weight_entry.to_dict()), 201


@membership_station_bp.route("/station-weights/<int:id>", methods=["DELETE"])
def remove_station_weight(id):
    """Remove a station assignment from a person for this schedule."""
    entry = db.session.get(MembershipStationWeight, id)
    if not entry:
        return jsonify({"error": "Weight entry not found"}), 404

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Station weight removed"}), 200

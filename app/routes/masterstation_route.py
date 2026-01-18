from flask import Blueprint, request, jsonify
from app import db
from app.models import MasterStation
from sqlalchemy.exc import IntegrityError

# Distinct name to avoid collision with other blueprints
master_station_bp = Blueprint("master_stations", __name__)


@master_station_bp.route("/master-stations", methods=["GET"])
def get_all_master_stations():
    stations = MasterStation.query.all()
    return jsonify([s.to_dict() for s in stations]), 200


@master_station_bp.route("/master-stations", methods=["POST"])
def create_master_station():
    data = request.get_json()
    # 1. Validation: Check for Name AND Abbr
    if not data or "name" not in data or "abbr" not in data:
        return jsonify({"error": "Station name and abbreviation are required"}), 400

    try:
        new_station = MasterStation(
            name=data["name"],
            abbr=data["abbr"].upper(),  # Store abbr as uppercase (e.g., "OOD")
        )
        db.session.add(new_station)
        db.session.commit()
        return jsonify(new_station.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {"error": "A station with that name or abbreviation already exists"}
            ),
            400,
        )


@master_station_bp.route("/master-stations/<int:id>", methods=["PUT"])
def update_station_full(id):
    """Full update of a master station."""
    station = db.session.get(MasterStation, id)
    if not station:
        return jsonify({"error": "Station not found"}), 404

    data = request.get_json()
    if not data or "name" not in data or "abbr" not in data:
        return jsonify({"error": "Name and Abbr are required for PUT"}), 400

    try:
        station.name = data["name"]
        station.abbr = data["abbr"].upper()
        db.session.commit()
        return jsonify(station.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Duplicate name or abbreviation"}), 400


@master_station_bp.route("/master-stations/<int:id>", methods=["PATCH"])
def update_station_partial(id):
    """Partial update."""
    station = db.session.get(MasterStation, id)
    if not station:
        return jsonify({"error": "Station not found"}), 404

    data = request.get_json()

    if "name" in data:
        station.name = data["name"]
    if "abbr" in data:
        station.abbr = data["abbr"].upper()

    try:
        db.session.commit()
        return jsonify(station.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Duplicate name or abbreviation"}), 400


@master_station_bp.route("/master-stations/<int:id>", methods=["DELETE"])
def delete_master_station(id):
    station = db.session.get(MasterStation, id)
    if not station:
        return jsonify({"error": "Station not found"}), 404

    try:
        db.session.delete(station)
        db.session.commit()
        return jsonify({"message": f"Station '{station.name}' deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

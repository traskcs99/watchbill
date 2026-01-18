from flask import Blueprint, request, jsonify
from sqlalchemy import select, delete
from ..database import db
from ..models import WatchStation

station_bp = Blueprint("stations", __name__)


# --- FETCH ALL ---
@station_bp.route("/stations", methods=["GET"])
def get_all():
    # Sort by abbreviation for the UI (e.g., EDO, OOD, SDO)
    stmt = select(WatchStation).order_by(WatchStation.abbr)
    stations = db.session.execute(stmt).scalars().all()
    return jsonify([s.to_dict() for s in stations])


# --- FETCH ONE ---
@station_bp.route("/stations/<int:id>", methods=["GET"])
def get_one(id):
    station = db.session.get(WatchStation, id)
    if not station:
        return jsonify({"error": "Watch station not found"}), 404
    return jsonify(station.to_dict())


# --- CREATE ---
@station_bp.route("/stations", methods=["POST"])
def create():
    data = request.get_json()
    if not data or "name" not in data or "abbr" not in data:
        return jsonify({"error": "Name and Abbreviation are required"}), 400

    new_station = WatchStation(
        name=data["name"], abbr=data["abbr"].upper()  # Normalize to uppercase
    )
    db.session.add(new_station)
    db.session.commit()
    return jsonify(new_station.to_dict()), 201


# --- UPDATE ---
@station_bp.route("/stations/<int:id>", methods=["PUT"])
def update(id):
    station = db.session.get(WatchStation, id)
    if not station:
        return jsonify({"error": "Watch station not found"}), 404

    data = request.get_json()
    station.name = data.get("name", station.name)
    station.abbr = data.get("abbr", station.abbr).upper()

    db.session.commit()
    return jsonify(station.to_dict())


# --- DELETE ---
@station_bp.route("/stations/<int:id>", methods=["DELETE"])
def delete_station(id):
    station = db.session.get(WatchStation, id)
    if not station:
        return jsonify({"error": "Watch station not found"}), 404

    db.session.delete(station)
    db.session.commit()
    return jsonify({"message": f"Station {id} deleted"}), 200


# --- BULK CREATE ---
@station_bp.route("/stations/bulk", methods=["POST"])
def bulk_create_stations():
    data = request.get_json()  # Expected to be a list of dicts
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of stations"}), 400

    new_stations = []
    for item in data:
        if "name" in item and "abbr" in item:
            new_stations.append(
                WatchStation(name=item["name"], abbr=item["abbr"].upper())
            )

    db.session.add_all(new_stations)
    db.session.commit()
    return jsonify([s.to_dict() for s in new_stations]), 201


# --- BULK DELETE ---
@station_bp.route("/stations/bulk-delete", methods=["POST"])
def bulk_delete_stations():
    data = request.get_json()  # Expected list of IDs: [1, 2, 3]
    if not data or not isinstance(data, list):
        return jsonify({"error": "Expected list of IDs"}), 400

    # Modern SQLAlchemy 2.0 Bulk Delete
    stmt = delete(WatchStation).where(WatchStation.id.in_(data))
    result = db.session.execute(stmt)
    db.session.commit()

    return jsonify({"message": f"Deleted {result.rowcount} stations"}), 200

from flask import Blueprint, request, jsonify
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from ..database import db
from ..models import MasterStation, ScheduleStation, Schedule
from ..utils.schedule_utils import generate_assignments_for_station

station_bp = Blueprint("stations", __name__)


# --- FETCH ALL ---
@station_bp.route("/stations", methods=["GET"])
def get_all():
    # Sort by abbreviation for the UI (e.g., EDO, OOD, SDO)
    stmt = select(MasterStation).order_by(MasterStation.abbr)
    stations = db.session.execute(stmt).scalars().all()
    return jsonify([s.to_dict() for s in stations])


# --- FETCH ONE ---
@station_bp.route("/stations/<int:id>", methods=["GET"])
def get_one(id):
    station = db.session.get(MasterStation, id)
    if not station:
        return jsonify({"error": "Watch station not found"}), 404
    return jsonify(station.to_dict())


@station_bp.route("/schedules/<int:schedule_id>/stations", methods=["POST"])
def add_station_to_schedule(schedule_id):
    data = request.get_json()
    station_id = data.get("station_id")

    if not station_id:
        return jsonify({"error": "Station ID is required"}), 400

    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404

    # 1. Create the Template Link
    new_link = ScheduleStation(schedule_id=schedule_id, station_id=station_id)
    db.session.add(new_link)

    try:
        # Flush to check for duplicates (UniqueConstraint)
        db.session.flush()

        # 2. Call the Utility to handle assignment generation
        count = generate_assignments_for_station(db.session, schedule, station_id)

        db.session.commit()

        return (
            jsonify(
                {
                    "message": f"Station linked and {count} slots generated.",
                    "link": new_link.to_dict(),
                }
            ),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        # MATCH TEST EXPECTATION: "already assigned"
        return jsonify({"error": "Station is already assigned to this schedule"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --- UPDATE ---
@station_bp.route("/stations/<int:id>", methods=["PUT"])
def update(id):
    station = db.session.get(MasterStation, id)
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
    station = db.session.get(MasterStation, id)
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
                MasterStation(name=item["name"], abbr=item["abbr"].upper())
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
    stmt = delete(MasterStation).where(MasterStation.id.in_(data))
    result = db.session.execute(stmt)
    db.session.commit()

    return jsonify({"message": f"Deleted {result.rowcount} stations"}), 200

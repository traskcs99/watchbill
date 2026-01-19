from flask import Blueprint, request, jsonify
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from ..database import db
from ..models import MasterStation, ScheduleStation, Schedule, Assignment
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

    try:
        # 1. CLEANUP ORPHANS (The "Safety Switch")
        # This prevents 500 errors if old data exists
        Assignment.query.filter_by(
            schedule_id=schedule_id, station_id=station_id
        ).delete()

        # 2. CREATE THE LINK
        new_link = ScheduleStation(schedule_id=schedule_id, station_id=station_id)
        db.session.add(new_link)
        db.session.flush()  # Generates new_link.id

        # 3. GENERATE SLOTS
        # Pass station_id (Master ID), not new_link.id
        count = generate_assignments_for_station(db.session, schedule, station_id)

        db.session.commit()

        return (
            jsonify(
                {
                    "message": f"Linked and {count} slots created.",
                    "link": new_link.to_dict(),  # This fixes the KeyError: 'link'
                }
            ),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Station is already assigned to this schedule"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"DEBUG ERROR: {str(e)}")  # This will show in your terminal
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


@station_bp.route(
    "/schedules/<int:schedule_id>/stations/<int:schedule_station_id>",
    methods=["DELETE"],
)
def remove_station_to_schedule(schedule_id, schedule_station_id):
    # 1. Get the link
    link = db.session.get(ScheduleStation, schedule_station_id)
    if not link:
        return jsonify({"error": "Link not found"}), 404

    # 2. Capture the station_id before we delete the link
    target_station_id = link.station_id

    # 3. Manually delete all assignments for this station in this schedule
    # This is necessary because Assignment links to MasterStation, not the Link table
    Assignment.query.filter_by(
        schedule_id=schedule_id, station_id=target_station_id
    ).delete()

    # 4. Delete the link itself
    db.session.delete(link)

    try:
        db.session.commit()
        return jsonify({"message": "Station and associated slots removed"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

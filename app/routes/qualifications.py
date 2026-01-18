from flask import Blueprint, jsonify, request
from ..database import db
from ..models import Person, WatchStation, Qualification
from datetime import date

qualifications_bp = Blueprint("qualifications", __name__)


@qualifications_bp.route("/qualifications", methods=["POST"])
def grant_qualification():
    data = request.get_json()

    # Extract and convert the date if it exists
    earned_date_str = data.get("earned_date")
    earned_dt = None
    if earned_date_str:
        try:
            earned_dt = date.fromisoformat(earned_date_str)
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    new_qual = Qualification(
        person_id=data["person_id"],
        station_id=data["station_id"],
        earned_date=earned_dt,
    )
    try:
        db.session.add(new_qual)
        db.session.commit()
        return jsonify({"message": "Qualification granted"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Already qualified or invalid IDs"}), 400


@qualifications_bp.route("/qualifications/<int:qual_id>", methods=["DELETE"])
def revoke_qualification(qual_id):
    qual = db.session.get(Qualification, qual_id)

    if not qual:
        return jsonify({"error": "Qualification not found"}), 404

    db.session.delete(qual)
    db.session.commit()
    return jsonify({"message": "Qualification removed"}), 200

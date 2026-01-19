from flask import Blueprint, request, jsonify
from ..database import db
from ..models import Person

person_bp = Blueprint("personnel", __name__)

from flask import Blueprint, request, jsonify
from sqlalchemy import select
from ..database import db
from ..models import Person

from sqlalchemy.orm import joinedload

person_bp = Blueprint("personnel", __name__)


@person_bp.route("/personnel", methods=["GET"])
def get_all_personnel():
    # .options() belongs on the stmt object
    stmt = select(Person).options(joinedload(Person.group)).order_by(Person.name)

    # Execute the optimized statement
    people = db.session.execute(stmt).scalars().all()

    return jsonify([p.to_dict() for p in people]), 200


# --- FETCH ONE ---
@person_bp.route("/personnel/<int:id>", methods=["GET"])
def get_one(id):
    person = db.session.get(Person, id)
    if not person:
        return jsonify({"error": "Person not found"}), 404
    return jsonify(person.to_dict())


# --- CREATE ---
@person_bp.route("/personnel", methods=["POST"])
def create():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({"error": "Missing name"}), 400

    # Validate group_id (Optional but good practice)
    group_id = data.get("group_id")
    if group_id == "":  # Handle case where frontend sends empty string for "None"
        group_id = None

    new_person = Person(
        name=data["name"], group_id=group_id, is_active=data.get("is_active", True)
    )
    db.session.add(new_person)
    db.session.commit()
    return jsonify(new_person.to_dict()), 201


# --- UPDATE ---
@person_bp.route("/personnel/<int:id>", methods=["PUT"])
def update(id):
    person = db.session.get(Person, id)
    if not person:
        return jsonify({"error": "Person not found"}), 404

    data = request.get_json()

    # 1. Update Name (if provided)
    if "name" in data:
        person.name = data["name"]

    # 2. Update Active Status (if provided)
    if "is_active" in data:
        person.is_active = data["is_active"]

    # 3. Update Group (HANDLE THE EMPTY STRING BUG)
    if "group_id" in data:
        gid = data["group_id"]
        # If frontend sends "" (empty string), save as None (NULL)
        person.group_id = gid if gid != "" else None

    db.session.commit()
    return jsonify(person.to_dict())


# --- DELETE (Soft Delete) ---
@person_bp.route("/personnel/<int:id>", methods=["DELETE"])
def delete(id):
    person = db.session.get(Person, id)
    if not person:
        return jsonify({"error": "Person not found"}), 404

    # Professional practice: don't delete history, just deactivate
    person.is_active = False
    db.session.commit()
    return jsonify({"message": f"Person {id} deactivated"}), 200

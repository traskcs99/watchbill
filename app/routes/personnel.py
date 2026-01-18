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

    new_person = Person(name=data["name"], is_active=data.get("is_active", True))
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
    person.name = data.get("name", person.name)
    person.is_active = data.get("is_active", person.is_active)

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

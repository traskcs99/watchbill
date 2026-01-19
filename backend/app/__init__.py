from flask import Flask
from flask_cors import CORS
from .database import db
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_FOLDER_PATH = os.path.join(BASE_DIR, "instance")


def create_app():
    app = Flask(__name__)

    # Configuration - update with your actual DB URI
    if not os.path.exists(INSTANCE_FOLDER_PATH):
        os.makedirs(INSTANCE_FOLDER_PATH)
    db_path = os.path.join(INSTANCE_FOLDER_PATH, "watchbill.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app)
    db.init_app(app)

    # Register Blueprints (we will create these next)
    from .routes.personnel import person_bp

    app.register_blueprint(person_bp, url_prefix="/api")
    from .routes.stations import station_bp

    app.register_blueprint(station_bp, url_prefix="/api")
    from .routes.groups import group_bp

    app.register_blueprint(group_bp, url_prefix="/api")

    from .routes.holidays import holiday_bp

    app.register_blueprint(holiday_bp, url_prefix="/api")

    from .routes.qualifications import qualifications_bp

    app.register_blueprint(qualifications_bp, url_prefix="/api")

    from .routes.scheduleMembership import membership_bp

    app.register_blueprint(membership_bp, url_prefix="/api")

    from .routes.scheduleRoute import schedule_bp

    app.register_blueprint(schedule_bp, url_prefix="/api")

    from .routes.leave import leave_bp

    app.register_blueprint(leave_bp, url_prefix="/api")
    from .routes.exclusion_routes import exclusion_bp

    app.register_blueprint(exclusion_bp, url_prefix="/api")
    from .routes.masterstation_route import master_station_bp

    app.register_blueprint(master_station_bp, url_prefix="/api")
    from .routes.assignment_routes import assignment_bp

    app.register_blueprint(assignment_bp, url_prefix="/api")

    from .routes.scheduleDay_route import day_bp

    app.register_blueprint(day_bp, url_prefix="/api")

    from .routes.membership_station_route import membership_station_bp

    app.register_blueprint(membership_station_bp, url_prefix="/api")

    with app.app_context():
        db.create_all()  # Creates tables based on models.py

    return app

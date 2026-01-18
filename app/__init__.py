from flask import Flask
from flask_cors import CORS
from .database import db


def create_app():
    app = Flask(__name__)

    # Configuration - update with your actual DB URI
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///watchbill.db"
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

    with app.app_context():
        db.create_all()  # Creates tables based on models.py

    return app

from flask import Flask
from flask_cors import CORS
from .models import db, migrate
import os
from config import Config  # Now it should find it


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)

    # Configuration - update with your actual DB URI

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

    return app

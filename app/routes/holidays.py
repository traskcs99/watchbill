from flask import Blueprint, jsonify, request
from sqlalchemy import select
from ..database import db
from ..models import Holiday
from datetime import datetime, date
from ..utils.holidays import get_holidays_with_breaks


holiday_bp = Blueprint("holidays", __name__)


@holiday_bp.route("/holidays", methods=["GET"])
def get_holidays():
    """Returns a list of all holidays for the UI to reference."""
    stmt = select(Holiday).order_by(Holiday.date.asc())
    holidays = db.session.execute(stmt).scalars().all()
    return jsonify([h.to_dict() for h in holidays])


@holiday_bp.route("/holidays/sync-range", methods=["POST"])
def sync_holiday_range():
    """
    Overwrites holidays in the database for a specific year range.
    Expected JSON: {"start_year": 2025, "end_year": 2027}
    """
    data = request.get_json() or {}
    start_year = data.get("start_year")
    end_year = data.get("end_year")

    if not start_year or not end_year:
        return jsonify({"error": "Please provide both start_year and end_year"}), 400

    # 1. Define range boundaries
    start_str = f"{start_year}-01-01"
    end_str = f"{end_year}-12-31"

    # Convert to date objects for SQLAlchemy filtering
    start_date_obj = date(start_year, 1, 1)
    end_date_obj = date(end_year, 12, 31)

    try:
        # 2. Fetch all holidays for the range from your utility
        print(f"Syncing range: {start_str} to {end_str}...")
        new_holidays = get_holidays_with_breaks(start_str, end_str)

        # 3. Transactional Overwrite: Delete records ONLY in this range
        # This keeps your history (e.g., 2024) intact while updating the future.
        Holiday.query.filter(
            Holiday.date >= start_date_obj, Holiday.date <= end_date_obj
        ).delete()

        # 4. Bulk Insert new records
        holiday_objects = [
            Holiday(
                name=h["name"], date=datetime.strptime(h["date"], "%Y-%m-%d").date()
            )
            for h in new_holidays
        ]

        db.session.bulk_save_objects(holiday_objects)
        db.session.commit()

        return (
            jsonify(
                {
                    "status": "success",
                    "message": f"Overwrote {len(new_holidays)} holidays from {start_year} to {end_year}",
                    "count": len(new_holidays),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500

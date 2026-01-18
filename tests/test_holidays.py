import pytest
from app.models import Holiday
from datetime import date

def test_sync_holiday_range(client, session):
    """Test that the sync-range route overwrites data correctly."""
    
    # 1. Setup: Add a "dummy" holiday that should be deleted
    # We'll add a 2026 holiday that shouldn't be there after the sync
    dummy = Holiday(name="Old Junk Data", date=date(2026, 1, 1))
    session.add(dummy)
    session.commit()

    # 2. Execute: Sync for 2026
    payload = {
        "start_year": 2026,
        "end_year": 2026
    }
    response = client.post("/api/holidays/sync-range", json=payload)
    
    # 3. Assert: Check response
    assert response.status_code == 200
    data = response.get_json()
    assert "success" in data["status"]
    assert data["count"] > 0

    # 4. Verify Database state
    # Ensure "Old Junk Data" is gone
    old_data = session.query(Holiday).filter_by(name="Old Junk Data").first()
    assert old_data is None

    # Ensure New Year's Day is present (it should be in the API results)
    new_year = session.query(Holiday).filter_by(date=date(2026, 1, 1)).first()
    assert new_year is not None
    assert new_year.name == "New Year's Day"

def test_sync_invalid_input(client):
    """Test error handling for missing years."""
    response = client.post("/api/holidays/sync-range", json={"start_year": 2026})
    assert response.status_code == 400
    assert "error" in response.get_json()

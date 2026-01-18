import pytest
from app.models import MasterStation, Schedule, ScheduleStation, Assignment, ScheduleDay
from datetime import date
from sqlalchemy.exc import IntegrityError

# --- Fixtures ---


@pytest.fixture
def station_env(session):
    """
    Sets up a sandbox with:
    1. A Schedule
    2. A Master MasterStation
    3. A ScheduleDay (needed for assignments)
    """
    # 1. Create Schedule
    sch = Schedule(
        name="Station Integration Test",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
    )
    session.add(sch)
    session.flush()

    # 2. Create Master Station (abbr is REQUIRED)
    stn = MasterStation(name="Test Rover", abbr="ROVER")
    session.add(stn)
    session.flush()

    # 3. Create a Day (for assignment testing)
    day = ScheduleDay(schedule_id=sch.id, date=date(2026, 5, 1), weight=1.0)
    session.add(day)
    session.commit()

    return {"schedule": sch, "station": stn, "day": day}


# --- CRUD Tests ---


def test_create_station_success(client):
    """Happy Path: Create a new station successfully."""
    payload = {"name": "Officer of the Deck", "abbr": "OOD"}
    res = client.post("/api/master-stations", json=payload)
    assert res.status_code == 201
    assert res.json["abbr"] == "OOD"


def test_create_station_missing_fields(client):
    """Validation: Abbr is required."""
    res = client.post("/api/master-stations", json={"name": "No Abbr"})
    assert res.status_code == 400


def test_update_station(client, session):
    """Test PUT update."""
    # Setup
    stn = MasterStation(name="Old Name", abbr="OLD")
    session.add(stn)
    session.commit()

    # Test
    payload = {"name": "New Name", "abbr": "NEW"}
    res = client.put(f"/api/master-stations/{stn.id}", json=payload)

    assert res.status_code == 200
    assert res.json["abbr"] == "NEW"


def test_create_duplicate_station_name(client, session):
    """Integrity: Cannot create two stations with the same name."""
    # 1. Create first
    s1 = MasterStation(name="Security Rover", abbr="SEC")
    session.add(s1)
    session.commit()

    # 2. Try to create second with same name
    res = client.post(
        "/api/master-stations", json={"name": "Security Rover", "abbr": "SEC2"}
    )

    assert res.status_code == 400
    assert "already exists" in res.json["error"]


def test_get_all_stations(client, session):
    """Verify we can fetch the list."""
    session.add_all(
        [
            MasterStation(name="Alpha Station", abbr="ALP"),
            MasterStation(name="Bravo Station", abbr="BRV"),
        ]
    )
    session.commit()

    res = client.get("/api/master-stations")
    assert res.status_code == 200
    assert len(res.json) >= 2
    names = [s["name"] for s in res.json]
    assert "Alpha Station" in names


# --- Update (PUT) Tests ---


def test_put_full_update(client, session):
    """PUT replaces the entire resource."""
    # Setup
    stn = MasterStation(name="Old Name", abbr="OLD")
    session.add(stn)
    session.commit()

    # Action
    payload = {"name": "New Name", "abbr": "NEW"}
    res = client.put(f"/api/master-stations/{stn.id}", json=payload)

    # Assert API response
    assert res.status_code == 200
    assert res.json["name"] == "New Name"
    assert res.json["abbr"] == "NEW"

    # Assert Database
    session.refresh(stn)
    assert stn.name == "New Name"
    assert stn.abbr == "NEW"


# --- Partial Update (PATCH) Tests ---


def test_patch_update_abbr_only(client, session):
    """PATCH can update just the abbreviation."""
    stn = MasterStation(name="Static Name", abbr="OLD")
    session.add(stn)
    session.commit()

    res = client.patch(f"/api/master-stations/{stn.id}", json={"abbr": "NEW"})

    assert res.status_code == 200
    assert res.json["abbr"] == "NEW"
    assert res.json["name"] == "Static Name"


# --- Delete (DELETE) Tests ---


def test_delete_station(client, session):
    """Standard delete."""
    stn = MasterStation(name="Delete Me", abbr="DEL")
    session.add(stn)
    session.commit()

    res = client.delete(f"/api/master-stations/{stn.id}")
    assert res.status_code == 200
    assert session.get(MasterStation, stn.id) is None


# --- Integration Tests (Cascades) ---


def test_link_schedule_to_station(session, station_env):
    """Verify we can link a master station to a schedule."""
    req = ScheduleStation(
        schedule_id=station_env["schedule"].id, station_id=station_env["station"].id
    )
    session.add(req)
    session.commit()

    session.refresh(station_env["schedule"])

    # FIX: Use '.master_station' instead of '.station'
    assert len(station_env["schedule"].required_stations) == 1
    assert station_env["schedule"].required_stations[0].master_station.abbr == "ROVER"


def test_cascade_delete_station_cleans_everything(session, station_env):
    """Deleting MasterStation removes requirements and assignments."""
    sch_id = station_env["schedule"].id
    stn_id = station_env["station"].id
    day_id = station_env["day"].id

    # Create Requirement & Assignment
    session.add(ScheduleStation(schedule_id=sch_id, station_id=stn_id))
    session.add(Assignment(schedule_id=sch_id, day_id=day_id, station_id=stn_id))
    session.commit()

    # Delete Master Station
    session.delete(station_env["station"])
    session.commit()

    # Verify everything linked to it is gone
    # Note: If this fails, it's likely SQLite Foreign Keys are not enabled
    assert session.query(ScheduleStation).filter_by(station_id=stn_id).count() == 0
    assert session.query(Assignment).filter_by(station_id=stn_id).count() == 0

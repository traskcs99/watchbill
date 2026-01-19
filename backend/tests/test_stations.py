import pytest
from app.models import MasterStation, Schedule, ScheduleStation, Assignment, ScheduleDay
from datetime import date


@pytest.fixture
def station_test_env(session):
    """
    Sets up a Master Station and a Schedule for linking tests.
    """
    # 1. Create a Master Station in the library
    ms = MasterStation(name="Officer of the Deck", abbr="OOD")

    # 2. Create a Schedule (this auto-generates days via your utils)
    sch = Schedule(
        name="August 2026",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 3),  # Short range for easy counting
    )
    session.add_all([ms, sch])
    session.flush()

    # Create the days manually or via util if not auto-triggered in fixture
    for i in range(1, 4):
        session.add(ScheduleDay(schedule_id=sch.id, date=date(2026, 8, i), weight=1.0))

    session.commit()
    return {"station": ms, "schedule": sch}


@pytest.fixture
def sample_station(session):
    """Creates a master station for testing."""
    station = MasterStation(name="Ship's Duty Officer", abbr="SDO")
    session.add(station)
    session.commit()
    return station


@pytest.fixture
def sample_schedule(session):
    sch = Schedule(
        name="Test January",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        status="draft",
    )
    # Just add the day to the list; SQLAlchemy handles the ID link on commit
    day = ScheduleDay(date=date(2026, 1, 1), weight=1.0)
    sch.days.append(day)

    session.add(sch)
    session.commit()
    return sch


# --- 1. MasterStation Library Tests ---


def test_create_master_station(client):
    res = client.post(
        "/api/master-stations",
        json={"name": "Junior Officer of the Deck", "abbr": "JOOD"},
    )
    assert res.status_code == 201
    assert res.json["abbr"] == "JOOD"


# --- 2. ScheduleStation (Link) & Auto-Assignment Tests ---


def test_add_station_to_schedule_triggers_assignments(
    client, session, station_test_env
):
    """Verify that posting a station to a schedule creates link + slots."""
    # YOU MUST DEFINE THESE INSIDE EVERY TEST FUNCTION
    sch_id = station_test_env["schedule"].id
    stn_id = station_test_env["station"].id

    payload = {"station_id": stn_id}
    res = client.post(f"/api/schedules/{sch_id}/stations", json=payload)

    assert res.status_code == 201
    # Flexible string check to avoid word-order failures
    msg = res.json["message"].lower()
    assert "3 slots" in msg
    assert "created" in msg

    # Verify assignments were created
    count = (
        session.query(Assignment)
        .filter_by(schedule_id=sch_id, station_id=stn_id)
        .count()
    )
    assert count == 3


def test_prevent_duplicate_station_in_schedule(client, session, station_test_env):
    """Ensure you can't add OOD to the same schedule twice."""
    sch_id = station_test_env["schedule"].id
    stn_id = station_test_env["station"].id

    # Add first time
    client.post(f"/api/schedules/{sch_id}/stations", json={"station_id": stn_id})

    # Add second time
    res = client.post(f"/api/schedules/{sch_id}/stations", json={"station_id": stn_id})

    assert res.status_code == 400
    # This matches the user-friendly error we added to the route
    assert "already assigned" in res.json["error"].lower()


def test_cascade_delete_removes_assignments(client, session, station_test_env):
    """
    Verify that removing a station from the template
    wipes the associated assignments automatically.
    """
    schedule_id = station_test_env["schedule"].id
    station_id = station_test_env["station"].id

    # 1. Setup: Add station and slots
    client.post(
        f"/api/schedules/{schedule_id}/stations", json={"station_id": station_id}
    )

    # Get the ID of the link (ScheduleStation)
    link = session.query(ScheduleStation).first()

    # 2. Action: Delete the Link
    # Note: Ensure you have a DELETE route for ScheduleStation at this endpoint
    res = client.delete(f"/api/stations/{link.id}")
    assert res.status_code == 200

    # 3. Verify: Assignments should be gone due to CASCADE
    count = session.query(Assignment).filter_by(station_id=station_id).count()
    assert count == 0


def test_remove_station_from_schedule_success(
    client, session, sample_schedule, sample_station
):
    """Test successfully removing a station from a schedule."""
    # 1. Setup: Add the station first
    res_add = client.post(
        f"/api/schedules/{sample_schedule.id}/stations",
        json={"station_id": sample_station.id},
    )
    link_id = res_add.get_json()["link"]["id"]

    # 2. Action: Remove the station
    res_del = client.delete(f"/api/schedules/{sample_schedule.id}/stations/{link_id}")

    # 3. Assertions
    assert res_del.status_code == 200
    assert "removed" in res_del.get_json()["message"]

    # 4. Verification: Check summary to ensure it's gone
    res_sum = client.get(f"/api/schedules/{sample_schedule.id}/summary")
    assert len(res_sum.get_json()["required_stations"]) == 0


def test_remove_station_cascades_to_assignments(
    client, session, sample_schedule, sample_station
):
    """Test that removing a station wipes all associated assignment slots."""
    # 1. Add station (which triggers assignment generation)
    res = client.post(
        f"/api/schedules/{sample_schedule.id}/stations",
        json={"station_id": sample_station.id},
    )
    link_id = res.get_json()["link"]["id"]

    # Verify assignments exist (should be one for every day in schedule)
    initial_count = (
        session.query(Assignment).filter_by(schedule_id=sample_schedule.id).count()
    )
    assert initial_count > 0

    # 2. Remove the station
    client.delete(f"/api/schedules/{sample_schedule.id}/stations/{link_id}")

    # 3. Verify assignments are GONE
    final_count = (
        session.query(Assignment).filter_by(schedule_id=sample_schedule.id).count()
    )
    assert final_count == 0

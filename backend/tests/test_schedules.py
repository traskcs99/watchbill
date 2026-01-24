import pytest
from app.models import (
    Schedule,
    ScheduleMembership,
    MembershipStationWeight,
    Holiday,
    ScheduleDay,
)
from datetime import date
from sqlalchemy.exc import IntegrityError


def test_create_schedule(client):
    """Test creating a schedule header via POST."""
    payload = {
        "name": "March 2026 Watchbill",
        "start_date": "2026-03-01",
        "end_date": "2026-03-31",
        "status": "draft",
    }
    response = client.post("/api/schedules", json=payload)
    assert response.status_code == 201
    data = response.json
    assert data["name"] == "March 2026 Watchbill"
    assert "id" in data


def test_get_schedules_list(client, session):
    """Test the list view (Summary mode)."""
    # Setup: Add two schedules
    s1 = Schedule(name="Jan", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31))
    s2 = Schedule(name="Feb", start_date=date(2026, 2, 1), end_date=date(2026, 2, 28))
    session.add_all([s1, s2])
    session.commit()

    response = client.get("/api/schedules")
    assert response.status_code == 200
    assert len(response.json) >= 2
    # Verify summary mode doesn't include deep nested data by default
    assert "days" not in response.json[0]


def test_get_single_schedule_full_load(client, session):
    """Test that creating a schedule via API generates days and returns them."""
    # 1. Setup a holiday to test the 2.0 override
    from app.models import Holiday

    new_year = Holiday(date=date(2026, 1, 1), name="New Year's Day")
    session.add(new_year)
    session.commit()

    # 2. Use the POST route so generate_schedule_days() is actually called
    payload = {
        "name": "Full Load Test",
        "start_date": "2026-01-01",  # Thursday (Holiday)
        "end_date": "2026-01-05",  # Monday
        "status": "draft",
    }
    post_res = client.post("/api/schedules", json=payload)
    assert post_res.status_code == 201
    sch_id = post_res.json["id"]

    # 3. Now GET the single schedule
    response = client.get(f"/api/schedules/{sch_id}")
    assert response.status_code == 200

    data = response.json
    assert "days" in data  # This will now pass
    assert len(data["days"]) == 8

    # 4. Verify your Weight Logic worked
    # Jan 1st (Holiday)
    assert data["days"][3]["weight"] == 2.0
    assert data["days"][3]["is_holiday"] is True
    assert data["days"][3]["name"] == "New Year's Day"

    # Jan 5th (Monday)
    assert data["days"][7]["weight"] == 1.0


def test_delete_schedule_cascades(client, session):
    """
    CRITICAL TEST: Verify that deleting a schedule wipes
    memberships and their local station weights.
    """
    # 1. SETUP PARENTS: Create the Person and Group first
    from app.models import Person, Group, MembershipStationWeight, MasterStation

    p = Person(name="Cascading Carl")
    g = Group(name="Alpha Group")
    session.add_all([p, g])
    session.flush()  # This generates IDs for p and g

    # 2. Create Schedule
    sch = Schedule(
        name="Delete Me", start_date=date(2026, 1, 1), end_date=date(2026, 1, 2)
    )
    session.add(sch)
    session.flush()

    # 3. Add membership using REAL IDs
    mem = ScheduleMembership(schedule_id=sch.id, person_id=p.id, group_id=g.id)
    session.add(mem)
    session.flush()

    # 4. (Optional) Add a local weight to test deeper cascade
    # Create a master station first
    stn = MasterStation(name="OOD", abbr="OOD")
    session.add(stn)
    session.flush()

    weight = MembershipStationWeight(
        membership_id=mem.id, station_id=stn.id, weight=2.0
    )
    session.add(weight)
    session.commit()

    # --- THE TEST ---
    # 5. Delete the Schedule
    session.delete(sch)
    session.commit()

    # 6. VERIFY CASCADE: Everything linked to the schedule should be gone
    assert session.get(ScheduleMembership, mem.id) is None
    assert (
        session.query(MembershipStationWeight).filter_by(membership_id=mem.id).count()
        == 0
    )


def test_invalid_schedule_dates(client):
    """Test that bad date strings return 400."""
    payload = {
        "name": "Bad Dates",
        "start_date": "not-a-date",
        "end_date": "2026-01-31",
    }
    response = client.post("/api/schedules", json=payload)
    assert response.status_code == 400
    assert "error" in response.json


def test_schedule_weight_calculation_logic(client, session):
    """
    Verifies:
    - Mon-Thu = 1.0
    - Fri = 1.5
    - Sat/Sun = 2.0
    - Holiday = 2.0 + Name
    """
    # 1. Setup a Holiday on a Monday (usually a 1.0 day)
    # If logic works, it should override to 2.0
    monday_holiday = date(2026, 1, 19)  # MLK Day 2026
    session.add(Holiday(date=monday_holiday, name="MLK Day"))
    session.commit()

    # 2. Create schedule: Fri Jan 16 to Mon Jan 19
    payload = {
        "name": "Weight Test",
        "start_date": "2026-01-16",
        "end_date": "2026-01-19",
    }
    response = client.post("/api/schedules", json=payload)
    assert response.status_code == 201

    days = response.json["days"]

    # Day 0: Friday (Jan 16) -> 1.5
    assert days[3]["date"] == "2026-01-16"
    assert days[3]["weight"] == 1.5

    # Day 1: Saturday (Jan 17) -> 2.0
    assert days[4]["weight"] == 2.0

    # Day 2: Sunday (Jan 18) -> 2.0
    assert days[5]["weight"] == 2.0

    # Day 3: Monday (Jan 19) -> 2.0 (Holiday Override)
    assert days[6]["date"] == "2026-01-19"
    assert days[6]["weight"] == 2.0
    assert days[6]["name"] == "MLK Day"
    assert days[6]["is_holiday"] is True


def test_prevent_duplicate_schedule_days(session):
    """Ensure the database constraint prevents two entries for the same date."""
    # 1. Create the parent schedule
    sch = Schedule(
        name="Duplicate Constraint Test",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 10),
    )
    session.add(sch)
    session.flush()  # Get the sch.id

    # 2. Create two day objects with the IDENTICAL date
    day1 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 1), weight=1.0)
    day2 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 1), weight=2.0)

    session.add(day1)
    session.add(day2)

    # 3. This should trigger an IntegrityError on commit
    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()  # Clean up the failed transaction


def test_schedule_cascade_delete(client, session):
    # 1. Create a schedule with days
    payload = {
        "name": "Delete Me",
        "start_date": "2026-02-01",
        "end_date": "2026-02-05",
    }
    res = client.post("/api/schedules", json=payload)
    sch_id = res.json["id"]

    # Verify days exist in DB
    assert session.query(ScheduleDay).filter_by(schedule_id=sch_id).count() == 8

    # 2. Delete the schedule
    client.delete(f"/api/schedules/{sch_id}")

    # 3. Verify days are GONE
    assert session.query(ScheduleDay).filter_by(schedule_id=sch_id).count() == 0

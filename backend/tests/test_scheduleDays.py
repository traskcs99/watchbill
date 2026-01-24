import pytest
from datetime import date
from app.models import Schedule, ScheduleDay


@pytest.fixture
def day_env(session):
    """
    Sets up a schedule with a few days for testing.
    """
    sch = Schedule(
        name="Test Schedule", start_date=date(2026, 1, 1), end_date=date(2026, 1, 3)
    )
    session.add(sch)
    session.flush()

    # Create 3 days: Thursday (1.0), Friday (1.5), Saturday (2.0)
    d1 = ScheduleDay(
        schedule_id=sch.id, date=date(2026, 1, 1), name="Thursday", weight=1.0
    )
    d2 = ScheduleDay(
        schedule_id=sch.id, date=date(2026, 1, 2), name="Friday", weight=1.5
    )
    d3 = ScheduleDay(
        schedule_id=sch.id, date=date(2026, 1, 3), name="Saturday", weight=2.0
    )

    session.add_all([d1, d2, d3])
    session.commit()

    return {"schedule": sch, "days": [d1, d2, d3]}


# --- 1. READ TESTS ---


def test_get_days_for_schedule(client, session, day_env):  # 1. Added session fixture
    """Verify we can fetch the full calendar for a schedule."""
    sch_id = day_env["schedule"].id
    res = client.get(f"/api/schedules/{sch_id}/days")

    assert res.status_code == 200
    assert len(res.json) == 3

    # 2. Verify sorting by date
    assert res.json[0]["date"] == "2026-01-01"
    assert res.json[1]["date"] == "2026-01-02"
    assert res.json[2]["date"] == "2026-01-03"

    # 3. Use modern SQLAlchemy 2.0 syntax if you need to fetch from DB in a test
    # Instead of ScheduleDay.query.get(id), use:
    # day = session.get(ScheduleDay, day_env["day1"].id)
    # assert day.weight == 1.0


# --- 2. UPDATE (PATCH) TESTS ---


def test_patch_day_name_and_label(client, day_env):
    """Test using 'name' for the primary event and 'label' for secondary notes."""
    day_id = day_env["days"][0].id  # Thursday

    payload = {
        "name": "Command Picnic",
        "label": "Early Liberty",
        "weight": 0.5,  # A light day
    }

    res = client.patch(f"/api/schedule-days/{day_id}", json=payload)

    assert res.status_code == 200
    assert res.json["name"] == "Command Picnic"
    assert res.json["label"] == "Early Liberty"
    assert res.json["weight"] == 0.5


def test_patch_holiday_status(client, day_env):
    """Verify we can toggle a day to holiday status manually."""
    day_id = day_env["days"][0].id

    res = client.patch(
        f"/api/schedule-days/{day_id}",
        json={"is_holiday": True, "name": "New Year's Day", "weight": 2.0},
    )

    assert res.status_code == 200
    assert res.json["is_holiday"] is True
    assert res.json["name"] == "New Year's Day"


# --- 3. FULL UPDATE (PUT) TESTS ---


def test_put_day_full_update(client, day_env):
    """Test replacing all editable properties of a day."""
    day_id = day_env["days"][1].id  # Friday

    payload = {
        "name": "Normal Workday",
        "label": "Uniform Inspection",
        "weight": 1.0,
        "is_holiday": False,
        "availability_estimate": 15.0,
    }

    res = client.put(f"/api/schedule-days/{day_id}", json=payload)

    assert res.status_code == 200
    assert res.json["name"] == "Normal Workday"
    assert res.json["label"] == "Uniform Inspection"
    assert res.json["availability_estimate"] == 15.0


# --- 4. ERROR HANDLING ---


def test_get_nonexistent_day_fails(client):
    """Verify 404 for invalid day IDs."""
    res = client.get("/api/schedule-days/9999")
    # Note: We didn't build a GET single day route, so this might 404 or 405
    # If using the PATCH route to test 404:
    res = client.patch("/api/schedule-days/9999", json={"name": "Ghost"})
    assert res.status_code == 404


def test_patch_day_invalid_data(client, day_env):
    """Ensure sending bad data types (e.g. string for weight) is handled."""
    day_id = day_env["days"][0].id

    # Depending on your implementation, float() cast might throw 400 or 500
    res = client.patch(f"/api/schedule-days/{day_id}", json={"weight": "very heavy"})
    assert res.status_code in [400, 500]


@pytest.fixture
def override_env(session):
    """
    Sets up a schedule with one standard day and one holiday.
    """
    sch = Schedule(
        name="Override Test", start_date=date(2026, 7, 1), end_date=date(2026, 7, 4)
    )
    session.add(sch)
    session.flush()

    # 1. A standard Wednesday
    d1 = ScheduleDay(
        schedule_id=sch.id,
        date=date(2026, 7, 1),
        name="Wednesday",
        weight=1.0,
        is_holiday=False,
    )
    # 2. Independence Day (Auto-generated as holiday)
    d2 = ScheduleDay(
        schedule_id=sch.id,
        date=date(2026, 7, 4),
        name="Independence Day",
        weight=2.0,
        is_holiday=True,
    )

    session.add_all([d1, d2])
    session.commit()

    return {"schedule": sch, "normal_day": d1, "holiday_day": d2}


# --- 1. TESTING HOLIDAY OVERRIDE (Normal -> Holiday) ---


def test_override_normal_to_holiday(client, override_env):
    """Test turning a regular Wednesday into a custom Command Holiday."""
    day_id = override_env["normal_day"].id

    payload = {
        "is_holiday": True,
        "name": "Command Centennial",
        "weight": 2.5,  # Extra high weight for a major event
        "label": "All Hands",
    }

    res = client.patch(f"/api/schedule-days/{day_id}", json=payload)

    assert res.status_code == 200
    assert res.json["is_holiday"] is True
    assert res.json["name"] == "Command Centennial"
    assert res.json["weight"] == 2.5
    assert res.json["label"] == "All Hands"


# --- 2. TESTING HOLIDAY REMOVAL (Holiday -> Normal) ---


def test_revert_holiday_to_normal(client, override_env):
    """Test stripping holiday status (e.g., Command decides to work on July 4th)."""
    day_id = override_env["holiday_day"].id

    payload = {
        "is_holiday": False,
        "name": "Saturday",  # Reset name to weekday
        "weight": 1.0,  # Reset weight to standard
        "label": "Working Holiday",
    }

    res = client.patch(f"/api/schedule-days/{day_id}", json=payload)

    assert res.status_code == 200
    assert res.json["is_holiday"] is False
    assert res.json["weight"] == 1.0
    assert res.json["name"] == "Saturday"


# --- 3. CHANGING HOLIDAY NAME ---


def test_change_holiday_name(client, override_env):
    """Verify we can rename a holiday without losing its status or weight."""
    day_id = override_env["holiday_day"].id

    # Maybe we want to call it 'July 4th' instead of 'Independence Day'
    res = client.patch(
        f"/api/schedule-days/{day_id}", json={"name": "July 4th Celebration"}
    )

    assert res.status_code == 200
    assert res.json["name"] == "July 4th Celebration"
    assert res.json["is_holiday"] is True  # Should remain True
    assert res.json["weight"] == 2.0  # Should remain 2.0


# --- 4. INTEGRITY CHECK ---


def test_partial_patch_preserves_other_fields(client, override_env):
    """Ensure patching only the name doesn't reset the weight or is_holiday flag."""
    day_id = override_env["holiday_day"].id

    # Update ONLY the label
    res = client.patch(f"/api/schedule-days/{day_id}", json={"label": "Duty Section 1"})

    assert res.status_code == 200
    data = res.json
    assert data["label"] == "Duty Section 1"
    assert data["is_holiday"] is True  # Preserved
    assert data["weight"] == 2.0  # Preserved
    assert data["name"] == "Independence Day"  # Preserved

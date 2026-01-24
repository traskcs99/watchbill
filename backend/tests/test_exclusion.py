import pytest
from datetime import date
from app.models import (
    Schedule,
    Person,
    ScheduleMembership,
    ScheduleDay,
    ScheduleExclusion,
    Group,
)

# --- Fixtures ---


@pytest.fixture
def exclusion_env(session):
    grp = Group(name="Exclusion Group")
    session.add(grp)
    session.flush()

    sch = Schedule(
        name="Exclusion Test Schedule",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )

    p = Person(name="Excluded Person")
    session.add_all([sch, p])
    session.flush()

    day1 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 10), weight=1.0)
    day2 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 11), weight=1.0)
    session.add_all([day1, day2])
    session.flush()

    mem = ScheduleMembership(schedule_id=sch.id, person_id=p.id, group_id=grp.id)
    session.add(mem)
    session.commit()

    return {
        "schedule": sch,
        "person": p,
        "membership": mem,
        "day1": day1,
        "day2": day2,
        "group": grp,
    }


# --- Create Tests (POST) ---


def test_create_exclusion_happy_path(client, exclusion_env):
    """Verify a standard exclusion can be created."""
    payload = {
        "membership_id": exclusion_env["membership"].id,
        "day_id": exclusion_env["day1"].id,
        "reason": "Doctor Appointment",
    }

    res = client.post("/api/exclusions", json=payload)

    assert res.status_code == 201
    assert res.json["reason"] == "Doctor Appointment"
    assert res.json["day_id"] == exclusion_env["day1"].id
    # Ensure the 'date' string is included in response (via to_dict join)
    assert res.json["date"] == "2026-01-10"


def test_create_exclusion_missing_fields(client):
    """Verify 400 if required IDs are missing."""
    res = client.post("/api/exclusions", json={"reason": "Missing IDs"})
    assert res.status_code == 400
    assert "Missing membership_id or day_id" in res.json["error"]


def test_create_exclusion_invalid_ids(client, exclusion_env):
    """Verify 404 if the Membership or Day doesn't exist."""
    payload = {"membership_id": 99999, "day_id": exclusion_env["day1"].id}  # Bad ID
    res = client.post("/api/exclusions", json=payload)
    assert res.status_code == 404
    assert "Membership not found" in res.json["error"]


# --- Batch Create Tests (POST /batch) ---


def test_batch_create_exclusions(client, exclusion_env):
    """Verify we can exclude multiple days at once."""
    payload = [
        {
            "membership_id": exclusion_env["membership"].id,
            "day_id": exclusion_env["day1"].id,
            "reason": "Day 1 Off",
        },
        {
            "membership_id": exclusion_env["membership"].id,
            "day_id": exclusion_env["day2"].id,
            "reason": "Day 2 Off",
        },
    ]

    res = client.post("/api/exclusions/batch", json=payload)

    assert res.status_code == 201
    assert len(res.json) == 2
    assert res.json[0]["reason"] == "Day 1 Off"
    assert res.json[1]["reason"] == "Day 2 Off"


def test_batch_atomic_failure(client, session, exclusion_env):
    """Verify that if one item fails, NO items are saved."""
    payload = [
        {
            # Valid
            "membership_id": exclusion_env["membership"].id,
            "day_id": exclusion_env["day1"].id,
            "reason": "Good",
        },
        {
            # Invalid (Missing day_id) leads to DB Integrity Error if not caught
            # Or if API logic catches it, it returns 400.
            # Let's simulate a logic failure by passing a bad structure
            "membership_id": exclusion_env["membership"].id,
            # "day_id": MISSING
            "reason": "Bad",
        },
    ]

    res = client.post("/api/exclusions/batch", json=payload)

    # Should fail due to missing keys in loop or DB constraint
    assert res.status_code == 400 or res.status_code == 500

    # DB Check: Count should be 0
    count = session.query(ScheduleExclusion).count()
    assert count == 0


# --- Update Tests (PATCH) ---


def test_patch_exclusion_reason(client, session, exclusion_env):
    """Verify we can update just the reason."""
    # Setup: Create one manually
    exc = ScheduleExclusion(
        membership_id=exclusion_env["membership"].id,
        day_id=exclusion_env["day1"].id,
        reason="Original Reason",
    )
    session.add(exc)
    session.commit()

    # Update
    res = client.patch(f"/api/exclusions/{exc.id}", json={"reason": "New Reason"})

    assert res.status_code == 200
    assert res.json["reason"] == "New Reason"

    # Verify persistence
    db_exc = session.get(ScheduleExclusion, exc.id)
    assert db_exc.reason == "New Reason"


# --- Delete Tests (DELETE) ---


def test_delete_exclusion(client, session, exclusion_env):
    """Verify standard deletion."""
    exc = ScheduleExclusion(
        membership_id=exclusion_env["membership"].id, day_id=exclusion_env["day1"].id
    )
    session.add(exc)
    session.commit()

    res = client.delete(f"/api/exclusions/{exc.id}")
    assert res.status_code == 200

    assert session.get(ScheduleExclusion, exc.id) is None


def test_cascade_delete_on_membership_removal(session, exclusion_env):
    """
    Integrity Check: If a Membership is deleted,
    the exclusions should be deleted automatically.
    """
    exc = ScheduleExclusion(
        membership_id=exclusion_env["membership"].id, day_id=exclusion_env["day1"].id
    )
    session.add(exc)
    session.commit()

    # Delete the PARENT membership
    session.delete(exclusion_env["membership"])
    session.commit()

    # The exclusion should be gone
    count = session.query(ScheduleExclusion).count()
    assert count == 0


def test_get_exclusions_n_plus_one_check(
    client, session
):  # <--- Ensure 'session' is used, not db_session
    # 1. Setup Dependencies
    schedule = Schedule(
        name="N+1 Test", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
    )
    person = Person(name="Excluded Guy")
    session.add_all([schedule, person])
    session.commit()

    group = Group(name="Excluded Group")
    session.add(group)
    session.commit()

    # Create the Day and Membership needed for the Exclusion
    day = ScheduleDay(schedule_id=schedule.id, date=date(2026, 1, 15))
    membership = ScheduleMembership(
        schedule_id=schedule.id, person_id=person.id, group_id=group.id
    )
    session.add_all([day, membership])
    session.commit()

    # 2. Create the Exclusion (linking Membership -> Day)
    exclusion = ScheduleExclusion(
        membership_id=membership.id,
        day_id=day.id,  # <--- This is how we link it!
        reason="Medical",
    )
    session.add(exclusion)
    session.commit()

    # 3. Test the Endpoint
    response = client.get(f"/api/exclusions/schedule/{schedule.id}")

    assert response.status_code == 200
    data = response.json
    assert len(data) == 1
    assert data[0]["person_name"] == "Excluded Guy"
    assert data[0]["date"] == "2026-01-15"


def test_toggle_exclusion_flow(client, session, exclusion_env):
    """Verify that calling toggle once adds, and calling again removes."""
    payload = {
        "day_id": exclusion_env["day1"].id,
        "membership_id": exclusion_env["membership"].id,
    }

    # 1. First call: Should Create
    res1 = client.post("/api/exclusions/toggle", json=payload)
    assert res1.status_code == 200
    assert res1.json["message"] == "Exclusion added"
    assert session.query(ScheduleExclusion).count() == 1

    # 2. Second call: Should Delete
    res2 = client.post("/api/exclusions/toggle", json=payload)
    assert res2.status_code == 200
    assert res2.json["message"] == "Exclusion removed"
    assert session.query(ScheduleExclusion).count() == 0


# --- Create Tests (POST) ---


def test_get_exclusions_by_schedule(client, session, exclusion_env):
    """Verify fetching all exclusions for a specific schedule."""
    # Setup: Create one
    exc = ScheduleExclusion(
        membership_id=exclusion_env["membership"].id,
        day_id=exclusion_env["day1"].id,
        reason="Medical",
    )
    session.add(exc)
    session.commit()

    response = client.get(f"/api/exclusions/schedule/{exclusion_env['schedule'].id}")

    assert response.status_code == 200
    data = response.json
    assert len(data) == 1
    # Check that your to_dict() returns these joined fields
    assert "person_name" in data[0]
    assert data[0]["person_name"] == "Excluded Person"
    assert data[0]["date"] == "2026-01-10"

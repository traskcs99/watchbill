import pytest
from datetime import date
from app.models import Schedule, Person, ScheduleMembership, ScheduleLeave

# --- Fixtures ---


@pytest.fixture
def membership_setup(session):
    """
    Creates a valid Group -> Schedule -> Person -> Membership chain.
    """
    from app.models import Group  # Ensure this matches your actual model name

    # 1. Create the Group (Required for membership)
    grp = Group(name="Alpha Shift")
    session.add(grp)
    session.flush()

    # 2. Create Schedule
    sch = Schedule(
        name="Leave Testing Schedule",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )

    # 3. Create Person
    p = Person(name="Test Subject")

    session.add_all([sch, p])
    session.flush()

    # 4. Create Membership WITH the group_id
    mem = ScheduleMembership(
        schedule_id=sch.id,
        person_id=p.id,
        group_id=grp.id,  # <--- This fixes the NOT NULL constraint
    )
    session.add(mem)
    session.commit()

    return mem


# --- Single Create Tests (POST) ---


def test_create_valid_leave(client, membership_setup):
    """Happy Path: Create a standard leave request."""
    payload = {
        "membership_id": membership_setup.id,
        "start_date": "2026-01-10",
        "end_date": "2026-01-15",
        "reason": "Medical",
    }
    res = client.post("/api/leaves", json=payload)
    assert res.status_code == 201
    assert res.json["reason"] == "Medical"
    assert res.json["start_date"] == "2026-01-10"


def test_prevent_invalid_date_logic(client, membership_setup):
    """Logic Check: Start date cannot be after End date."""
    payload = {
        "membership_id": membership_setup.id,
        "start_date": "2026-01-20",
        "end_date": "2026-01-10",  # Backwards!
        "reason": "Time Travel Attempt",
    }
    res = client.post("/api/leaves", json=payload)
    assert res.status_code == 400
    assert "Start date cannot be after" in res.json["error"]


# --- Batch Create Tests (POST /batch) ---


def test_batch_create_success(client, membership_setup):
    """Verify multiple leaves can be added in one go."""
    payload = [
        {
            "membership_id": membership_setup.id,
            "start_date": "2026-01-01",
            "end_date": "2026-01-05",
            "reason": "Trip 1",
        },
        {
            "membership_id": membership_setup.id,
            "start_date": "2026-01-20",
            "end_date": "2026-01-25",
            "reason": "Trip 2",
        },
    ]
    res = client.post("/api/leaves/batch", json=payload)
    assert res.status_code == 201
    assert "Successfully created 2 leave records" in res.json["message"]
    assert len(res.json["leaves"]) == 2


def test_batch_atomic_failure(client, membership_setup, session):
    """
    Atomic Check: If one item is bad, NONE should be saved.
    """
    payload = [
        {
            # Valid item
            "membership_id": membership_setup.id,
            "start_date": "2026-01-01",
            "end_date": "2026-01-05",
            "reason": "Good Entry",
        },
        {
            # INVALID item (Bad Dates)
            "membership_id": membership_setup.id,
            "start_date": "2026-01-20",
            "end_date": "2026-01-10",
            "reason": "Bad Entry",
        },
    ]
    res = client.post("/api/leaves/batch", json=payload)

    # 1. API should return error
    assert res.status_code == 400
    assert "Start date cannot be after" in res.json["error"]

    # 2. Database should be empty (The "Good Entry" was rolled back)
    count = session.query(ScheduleLeave).count()
    assert count == 0


# --- Update Tests (PUT) ---


def test_put_full_update(client, session, membership_setup):
    """PUT must replace the entire resource."""
    # Setup: Create initial leave
    leave = ScheduleLeave(
        membership_id=membership_setup.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 5),
        reason="Initial",
    )
    session.add(leave)
    session.commit()

    # Update Payload
    payload = {
        "start_date": "2026-02-01",
        "end_date": "2026-02-05",
        "reason": "Updated Reason",
    }

    res = client.put(f"/api/leaves/{leave.id}", json=payload)
    assert res.status_code == 200
    assert res.json["reason"] == "Updated Reason"
    assert res.json["start_date"] == "2026-02-01"


def test_put_requires_all_fields(client, session, membership_setup):
    """PUT fails if fields are missing."""
    leave = ScheduleLeave(
        membership_id=membership_setup.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 5),
    )
    session.add(leave)
    session.commit()

    # Missing "end_date"
    payload = {"start_date": "2026-02-01", "reason": "Missing End"}

    res = client.put(f"/api/leaves/{leave.id}", json=payload)
    assert res.status_code == 400
    assert "PUT requires all fields" in res.json["error"]


# --- Partial Update Tests (PATCH) ---


def test_patch_partial_update(client, session, membership_setup):
    """PATCH can update just one field (e.g., Reason)."""
    leave = ScheduleLeave(
        membership_id=membership_setup.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 5),
        reason="Original",
    )
    session.add(leave)
    session.commit()

    # Only changing the reason
    res = client.patch(f"/api/leaves/{leave.id}", json={"reason": "Changed"})

    assert res.status_code == 200
    assert res.json["reason"] == "Changed"
    # Dates should remain untouched
    assert res.json["start_date"] == "2026-01-01"


def test_patch_logic_validation(client, session, membership_setup):
    """PATCH must still validate dates if one is changed."""
    leave = ScheduleLeave(
        membership_id=membership_setup.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 5),  # Ends Jan 5
    )
    session.add(leave)
    session.commit()

    # Try to move Start Date to Jan 10 (which is AFTER existing End Date Jan 5)
    res = client.patch(f"/api/leaves/{leave.id}", json={"start_date": "2026-01-10"})

    assert res.status_code == 400
    assert "Resulting start date would be after" in res.json["error"]


# --- Delete Tests ---


def test_delete_leave(client, session, membership_setup):
    """Standard delete test."""
    leave = ScheduleLeave(
        membership_id=membership_setup.id,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 5),
    )
    session.add(leave)
    session.commit()

    res = client.delete(f"/api/leaves/{leave.id}")
    assert res.status_code == 200

    # Verify DB is empty
    assert session.get(ScheduleLeave, leave.id) is None

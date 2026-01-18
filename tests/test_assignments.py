import pytest
from datetime import date
from app.models import (
    Assignment,
    Schedule,
    MasterStation,
    ScheduleDay,
    Person,
    Group,
    ScheduleMembership,
)


@pytest.fixture
def assignment_env(session):
    """
    Sets up a complete environment for assignment testing.
    Requires: Person -> Group -> MasterStation -> Schedule -> Day -> Membership
    """
    # 1. Setup Global/Master Data
    p = Person(name="Test User")
    g = Group(name="Alpha Group", priority=1)
    stn = MasterStation(name="Officer of the Deck", abbr="OOD")
    session.add_all([p, g, stn])
    session.flush()

    # 2. Setup Schedule Data
    sch = Schedule(
        name="July 2026", start_date=date(2026, 7, 1), end_date=date(2026, 7, 31)
    )
    session.add(sch)
    session.flush()

    # 3. Setup Relationships
    day = ScheduleDay(schedule_id=sch.id, date=date(2026, 7, 4), weight=1.0)
    mem = ScheduleMembership(schedule_id=sch.id, person_id=p.id, group_id=g.id)
    session.add_all([day, mem])
    session.flush()

    # 4. Create the initial empty Assignment slot
    assign = Assignment(
        schedule_id=sch.id,
        day_id=day.id,
        station_id=stn.id,
        membership_id=None,
        availability_estimate=0.0,
    )
    session.add(assign)
    session.commit()

    return {
        "assignment": assign,
        "membership": mem,
        "schedule": sch,
        "station": stn,
        "person": p,
    }


# --- 1. CRUD & OPTIMIZATION TESTS ---


def test_get_assignments_eager_loading(client, assignment_env):
    """Verify N+1 fix: Ensure related names are in the response."""
    res = client.get(f"/api/schedules/{assignment_env['schedule'].id}/assignments")

    assert res.status_code == 200
    data = res.json[0]
    # These fields require the MasterStation and ScheduleDay joins
    assert data["station_name"] == "Officer of the Deck"
    assert data["date"] == "2026-07-04"


def test_manual_assign_and_lock(client, assignment_env):
    """Test the most common user action: assigning a person and locking the slot."""
    payload = {"membership_id": assignment_env["membership"].id, "is_locked": True}
    res = client.patch(
        f"/api/assignments/{assignment_env['assignment'].id}", json=payload
    )

    assert res.status_code == 200
    assert res.json["membership_id"] == assignment_env["membership"].id
    assert res.json["is_locked"] is True
    assert res.json["assigned_person_name"] == "Test User"


def test_update_availability_estimate(client, assignment_env):
    """Verify we can save the manpower estimate float."""
    res = client.patch(
        f"/api/assignments/{assignment_env['assignment'].id}",
        json={"availability_estimate": 5.5},
    )
    assert res.status_code == 200
    assert res.json["availability_estimate"] == 5.5


def test_delete_assignment_slot(client, assignment_env, session):
    """Test manual removal of a watch slot."""
    res = client.delete(f"/api/assignments/{assignment_env['assignment'].id}")
    assert res.status_code == 200

    # Verify it's gone from DB
    assert session.get(Assignment, assignment_env["assignment"].id) is None


# --- 2. INTEGRITY TESTS ---


def test_assign_nonexistent_member_fails(client, assignment_env):
    """Ensure we can't assign an ID that doesn't exist."""
    res = client.patch(
        f"/api/assignments/{assignment_env['assignment'].id}",
        json={"membership_id": 999},
    )
    assert res.status_code == 404


def test_clear_assignment(client, assignment_env, session):
    """Verify we can set a membership back to null (unassign)."""
    # First assign
    assignment_env["assignment"].membership_id = assignment_env["membership"].id
    session.commit()

    # Now clear via API
    res = client.patch(
        f"/api/assignments/{assignment_env['assignment'].id}",
        json={"membership_id": None},
    )
    assert res.status_code == 200
    assert res.json["membership_id"] is None
    assert res.json["assigned_person_name"] is None

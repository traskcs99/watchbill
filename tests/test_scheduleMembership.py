import pytest
from app.models import Schedule, Person, ScheduleMembership, Group
from app.database import db
from datetime import date


@pytest.fixture
def membership_setup(session):
    """Sets up the basic entities needed for membership testing."""
    group = Group(name="Alpha Sector", max_assignments=8)
    person = Person(name="Chief Miller", group=group)
    sched = Schedule(
        name="March 2026",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        status="draft",
    )
    db.session.add_all([group, person, sched])
    db.session.commit()

    return {"person": person, "schedule": sched, "group": group}


def test_membership_lifecycle(client, session, membership_setup):
    """Tests POST, GET, PATCH, and DELETE for ScheduleMembership."""
    p_id = membership_setup["person"].id
    s_id = membership_setup["schedule"].id
    g_id = membership_setup["group"].id

    # 1. CREATE (POST)
    response = client.post(
        "/api/schedule-memberships",
        json={
            "person_id": p_id,
            "schedule_id": s_id,
            "group_id": g_id,
            "override_max_assignments": 4,
        },
    )
    assert response.status_code == 201
    m_id = response.get_json()["id"]

    # 2. READ (GET)
    get_resp = client.get(f"/api/schedule-memberships/{m_id}")
    assert get_resp.status_code == 200
    data = get_resp.get_json()
    assert data["person_name"] == "Chief Miller"
    assert data["override_max_assignments"] == 4
    # Ensure nested fields are initialized as empty lists, not errors
    assert isinstance(data["exclusions"], list)
    assert isinstance(data["leaves"], list)

    # 3. UPDATE (PATCH)
    patch_resp = client.patch(
        f"/api/schedule-memberships/{m_id}", json={"override_min_assignments": 2}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.get_json()["override_min_assignments"] == 2
    assert patch_resp.get_json()["override_max_assignments"] == 4  # Persisted

    # 4. DELETE
    del_resp = client.delete(f"/api/schedule-memberships/{m_id}")
    assert del_resp.status_code == 200

    # Verify 404 after deletion
    final_check = client.get(f"/api/schedule-memberships/{m_id}")
    assert final_check.status_code == 404


def test_duplicate_membership_prevention(client, session, membership_setup):
    """Ensures the same person cannot be added to a schedule twice."""
    payload = {
        "person_id": membership_setup["person"].id,
        "schedule_id": membership_setup["schedule"].id,
        "group_id": membership_setup["group"].id,
    }

    # First one works
    client.post("/api/schedule-memberships", json=payload)

    # Second one fails
    resp = client.post("/api/schedule-memberships", json=payload)
    assert resp.status_code == 400
    assert "already" in resp.get_json()["error"].lower()

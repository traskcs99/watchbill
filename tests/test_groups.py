import pytest
from app.models import Group
from app.database import db


def test_create_group_with_logic_fields(client, session):
    """Test creating a group with both UI sorting and solver logic fields."""
    payload = {
        "name": "First Watch Section",
        "priority": 1,
        "seniorityFactor": 1.5,
        "min_assignments": 2,
        "max_assignments": 8,
    }
    response = client.post("/api/groups", json=payload)
    assert response.status_code == 201

    data = response.get_json()
    assert data["name"] == "First Watch Section"
    assert data["priority"] == 1
    assert data["seniorityFactor"] == 1.5
    assert data["min_assignments"] == 2
    assert data["max_assignments"] == 8


def test_groups_sorting_logic(client, session):
    """Confirm GET /api/groups sorts by priority (UI) regardless of seniority."""
    # Group with high seniority but low priority (should appear second)
    g1 = Group(name="Seniors", priority=2, seniorityFactor=5.0)
    # Group with low seniority but high priority (should appear first)
    g2 = Group(name="Juniors", priority=1, seniorityFactor=1.0)

    db.session.add_all([g1, g2])
    db.session.commit()

    response = client.get("/api/groups")
    data = response.get_json()

    assert data[0]["name"] == "Juniors"  # Priority 1
    assert data[1]["name"] == "Seniors"  # Priority 2


def test_update_group_solver_constraints(client, session):
    """Test updating the mathematical constraints for the solver."""
    group = Group(name="Test Group", priority=10, seniorityFactor=1.0)
    db.session.add(group)
    db.session.commit()

    # Update only the solver-related fields
    payload = {"seniorityFactor": 2.2, "max_assignments": 12}
    response = client.put(f"/api/groups/{group.id}", json=payload)
    assert response.status_code == 200

    # Check database state
    db.session.refresh(group)
    assert group.seniorityFactor == 2.2
    assert group.max_assignments == 12
    assert group.priority == 10  # Ensure UI priority didn't change


def test_group_member_data_in_dict(client, session):
    """Verify to_dict returns member pool IDs for the frontend."""
    from app.models import Person

    group = Group(name="Section A", priority=1)
    db.session.add(group)
    db.session.flush()  # Get group.id

    p1 = Person(name="Alice", group_id=group.id)
    p2 = Person(name="Bob", group_id=group.id)
    db.session.add_all([p1, p2])
    db.session.commit()

    response = client.get("/api/groups")
    data = response.get_json()

    # Locate Section A in the response
    section_a = next(g for g in data if g["name"] == "Section A")
    assert section_a["member_count"] == 2
    assert p1.id in section_a["member_pool_ids"]
    assert p2.id in section_a["member_pool_ids"]

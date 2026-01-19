import pytest
from app.models import Person, MasterStation, Qualification, Group
from app.database import db
from datetime import date


@pytest.fixture
def setup_data(session):
    """Create a group, person, and station for testing."""
    group = Group(
        name="Test Section",
        priority=1,
        seniorityFactor=1.5,
        min_assignments=2,
        max_assignments=6,
    )
    db.session.add(group)
    db.session.flush()

    person = Person(name="Test Sailor", group_id=group.id)
    station = MasterStation(name="Officer of the Deck", abbr="OOD")
    db.session.add_all([person, station])
    db.session.commit()

    return {"person": person, "station": station}


def test_grant_qualification(client, session, setup_data):
    """Test the POST /api/qualifications route."""
    p_id = setup_data["person"].id
    s_id = setup_data["station"].id

    payload = {"person_id": p_id, "station_id": s_id, "earned_date": "2026-01-17"}

    response = client.post("/api/qualifications", json=payload)
    assert response.status_code == 201

    # Verify DB state
    qual = Qualification.query.filter_by(person_id=p_id, station_id=s_id).first()
    assert qual is not None
    assert qual.person.name == "Test Sailor"
    assert qual.station.abbr == "OOD"


def test_prevent_duplicate_qualification(client, session, setup_data):
    """Test that the UniqueConstraint blocks duplicate qualifications."""
    p_id = setup_data["person"].id
    s_id = setup_data["station"].id

    # Create the first one
    qual1 = Qualification(person_id=p_id, station_id=s_id)
    db.session.add(qual1)
    db.session.commit()

    # Attempt to post the same thing
    payload = {"person_id": p_id, "station_id": s_id}
    response = client.post("/api/qualifications", json=payload)

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_revoke_qualification(client, session, setup_data):
    """Test the DELETE /api/qualifications/<id> route."""
    p_id = setup_data["person"].id
    s_id = setup_data["station"].id

    qual = Qualification(person_id=p_id, station_id=s_id)
    db.session.add(qual)
    db.session.commit()

    response = client.delete(f"/api/qualifications/{qual.id}")
    assert response.status_code == 200
    revoked_qual = session.get(Qualification, qual.id)
    assert revoked_qual is None


def test_update_qualification_date(client, session):
    # 1. Setup: Create the PREREQUISITES first
    # We need a Group because Person requires a group_id
    group = Group(name="Test Group", priority=1)
    session.add(group)
    session.flush()  # This generates the group.id without committing yet

    # Create the Person and the Station
    person = Person(name="John Doe", group_id=group.id)
    station = MasterStation(name="Console 1", abbr="C1")
    session.add_all([person, station])
    session.flush()  # This generates person.id and station.id

    # 2. Create the Qualification using the real IDs
    qual = Qualification(person_id=person.id, station_id=station.id, earned_date=None)
    session.add(qual)
    session.commit()  # Now this will succeed because the Foreign Keys exist!

    # 3. Test valid update via the PATCH route
    new_date_str = "2025-12-25"
    response = client.patch(
        f"/api/qualifications/{qual.id}", json={"earned_date": new_date_str}
    )

    assert response.status_code == 200
    # Refresh the object from the DB to check the value
    session.refresh(qual)
    assert qual.earned_date == date(2025, 12, 25)

    # 4. Test invalid date format
    response = client.patch(
        f"/api/qualifications/{qual.id}", json={"earned_date": "invalid-date"}
    )
    assert response.status_code == 400

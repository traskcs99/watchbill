import pytest
from app.models import (
    Person,
    MasterStation,
    Qualification,
    Schedule,
    ScheduleMembership,
    MembershipStationWeight,
    Group,
)
from datetime import date


@pytest.fixture
def member_station_env(session):
    """
    Setup:
    1. A Person (John)
    2. Two Stations (OOD, JOOD)
    3. John is ONLY qualified for JOOD
    4. A Schedule where John is a Member
    """
    # 1. Create a Group (Required for Membership)
    alpha_group = Group(name="Alpha Section")
    session.add(alpha_group)
    session.flush()

    ood = MasterStation(name="Officer of the Deck", abbr="OOD")
    jood = MasterStation(name="Junior Officer of the Deck", abbr="JOOD")
    session.add_all([ood, jood])
    session.flush()

    # 2. Person & Qualification
    john = Person(name="John Doe")
    session.add(john)
    session.flush()

    # John is ONLY qualified for JOOD
    qual = Qualification(person_id=john.id, station_id=jood.id)
    session.add(qual)

    # 3. Schedule & Membership
    sch = Schedule(
        name="Jan 2026", start_date=date(2026, 1, 1), end_date=date(2026, 1, 31)
    )
    session.add(sch)
    session.flush()

    mem = ScheduleMembership(
        schedule_id=sch.id, person_id=john.id, group_id=alpha_group.id
    )
    session.add(mem)
    session.commit()

    return {
        "membership": mem,
        "qualified_station": jood,
        "unqualified_station": ood,
        "person": john,
    }


# --- 1. VALIDATION TEST ---


def test_prevent_unqualified_station_assignment(client, member_station_env):
    """Ensure we cannot assign John to OOD if he isn't qualified for it."""
    mem_id = member_station_env["membership"].id
    unqual_id = member_station_env["unqualified_station"].id

    payload = {"station_id": unqual_id, "weight": 1.0}
    res = client.post(f"/api/memberships/{mem_id}/station-weights", json=payload)

    assert res.status_code == 400
    assert "not qualified" in res.json["error"].lower()


# --- 2. SUCCESSFUL ASSIGNMENT TEST ---


def test_assign_qualified_station_weight(client, session, member_station_env):
    """Ensure John can be assigned to JOOD with a specific weight."""
    mem_id = member_station_env["membership"].id
    qual_id = member_station_env["qualified_station"].id

    payload = {"station_id": qual_id, "weight": 0.75}
    res = client.post(f"/api/memberships/{mem_id}/station-weights", json=payload)

    assert res.status_code == 201
    assert res.json["weight"] == 0.75
    assert res.json["station_name"] == "Junior Officer of the Deck"

    # Verify in DB
    weight_entry = (
        session.query(MembershipStationWeight).filter_by(membership_id=mem_id).first()
    )
    assert weight_entry.weight == 0.75


# --- 3. UPSERT TEST ---


def test_update_existing_station_weight(client, member_station_env):
    """Test that posting again updates the weight instead of creating a duplicate."""
    mem_id = member_station_env["membership"].id
    stn_id = member_station_env["qualified_station"].id

    # Initial set to 1.0
    client.post(
        f"/api/memberships/{mem_id}/station-weights",
        json={"station_id": stn_id, "weight": 1.0},
    )

    # Update to 0.25
    res = client.post(
        f"/api/memberships/{mem_id}/station-weights",
        json={"station_id": stn_id, "weight": 0.25},
    )

    assert res.status_code == 201
    assert res.json["weight"] == 0.25


# --- 4. CASCADE DELETE TEST ---


def test_cascade_delete_membership_removes_weights(client, session, member_station_env):
    """If a person is removed from the schedule, their station preferences must die."""
    mem_id = member_station_env["membership"].id
    stn_id = member_station_env["qualified_station"].id

    # 1. Setup weight
    client.post(
        f"/api/memberships/{mem_id}/station-weights",
        json={"station_id": stn_id, "weight": 1.0},
    )

    # 2. Action: Delete Membership
    membership = session.get(ScheduleMembership, mem_id)
    session.delete(membership)
    session.commit()

    # 3. Verify weights are gone
    weights = (
        session.query(MembershipStationWeight).filter_by(membership_id=mem_id).all()
    )
    assert len(weights) == 0

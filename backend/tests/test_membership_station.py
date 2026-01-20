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


import pytest
from app.models import ScheduleMembership, MembershipStationWeight, Qualification


def test_single_qualification_defaults_to_100_percent(
    client, session, station_test_env
):
    """
    Test that a person with only one qualification is automatically
    assigned 1.0 weight when added to a schedule.
    """
    sch_id = station_test_env["schedule"].id
    person = station_test_env["person"]
    stn_id = station_test_env["station"].id  # e.g., SDO

    # Setup: Ensure person only has 1 qual
    session.query(Qualification).filter_by(person_id=person.id).delete()
    qual = Qualification(person_id=person.id, station_id=stn_id, is_active=True)
    session.add(qual)
    session.commit()

    # Action: Add person to schedule
    res = client.post(
        "/api/schedule-memberships",
        json={"schedule_id": sch_id, "person_id": person.id},
    )

    assert res.status_code == 201
    membership_id = res.get_json()["id"]

    # Verify: Weight should be 1.0 automatically
    weights = MembershipStationWeight.query.filter_by(membership_id=membership_id).all()
    assert len(weights) == 1
    assert weights[0].weight == 1.0


def test_single_qualification_defaults_to_100_percent(
    client, session, member_station_env
):
    """
    Test that adding a person with 1 qual via API triggers the 1.0 weight creation.
    """
    # 1. Setup a fresh person with 1 qualification
    new_person = Person(name="Test User", group_id=1)
    session.add(new_person)
    session.flush()

    q_station = member_station_env["qualified_station"]
    qual = Qualification(
        person_id=new_person.id, station_id=q_station.id, is_active=True
    )
    session.add(qual)
    session.commit()

    # 2. Action: Call the POST route
    res = client.post(
        "/api/schedule-memberships",
        json={
            "schedule_id": member_station_env["membership"].schedule_id,
            "person_id": new_person.id,
        },
    )

    assert res.status_code == 201
    membership_id = res.get_json()["id"]

    # 3. Verify: Check the DB for the automatic weight
    session.expire_all()
    weights = (
        session.query(MembershipStationWeight)
        .filter_by(membership_id=membership_id)
        .all()
    )

    assert len(weights) == 1
    assert weights[0].weight == 1.0
    assert weights[0].station_id == q_station.id


def test_reject_invalid_weight_sum(client, session, member_station_env):
    """
    Test that the backend rejects weights that do not sum to 1.0 (100%).
    """
    membership_id = member_station_env["membership"].id
    q_id = member_station_env["qualified_station"].id
    u_id = member_station_env["unqualified_station"].id

    # Action: Try to set weights summing to 1.2 (120%)
    payload = {"weights": {str(q_id): 0.6, str(u_id): 0.6}}
    res = client.post(
        f"/api/schedule-memberships/{membership_id}/weights/distribute", json=payload
    )

    # Verify: Should fail with 400
    assert res.status_code == 400
    assert "Total weight must equal 100%" in res.get_json()["error"]


def test_successful_weight_distribution(client, session, member_station_env):
    """
    Test splitting a person's workload 70/30 between two stations.
    """
    membership_id = member_station_env["membership"].id
    q_id = member_station_env["qualified_station"].id
    u_id = member_station_env["unqualified_station"].id

    # Action: Distribute Weights 70/30
    payload = {"weights": {str(q_id): 0.7, str(u_id): 0.3}}
    res = client.post(
        f"/api/schedule-memberships/{membership_id}/weights/distribute", json=payload
    )

    assert res.status_code == 200

    # Verify in Database
    session.expire_all()
    weights = (
        session.query(MembershipStationWeight)
        .filter_by(membership_id=membership_id)
        .all()
    )
    assert len(weights) == 2

    weight_map = {w.station_id: w.weight for w in weights}
    assert weight_map[q_id] == 0.7
    assert weight_map[u_id] == 0.3

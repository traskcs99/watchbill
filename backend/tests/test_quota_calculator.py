import pytest
from datetime import date
from app.models import (
    Schedule,
    ScheduleDay,
    ScheduleMembership,
    ScheduleLeave,
    ScheduleStation,
    Person,
    Group,
    MasterStation,  # 🟢 Add this import (or Station)
)
from app.utils.quota_calculator import calculate_schedule_quotas
from app import db


# --- FIXTURES FOR DATA SETUP ---
@pytest.fixture
def quota_test_data(app):
    with app.app_context():
        # 🟢 1. Create a real Group first
        m_station = MasterStation(name="SDO", abbr="SDO")
        db.session.add(m_station)
        db.session.commit()
        test_group = Group(name="Test Group")
        db.session.add(test_group)
        db.session.commit()  # Commit to get the ID

        # 🟢 2. Create real People
        test_people = []
        for i in range(1, 5):
            p = Person(name=f"Member {i}")
            db.session.add(p)
            test_people.append(p)
        db.session.commit()

        # 3. Create Schedule
        schedule = Schedule(
            name="Quota Test Schedule",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 4),
            status="draft",
        )
        db.session.add(schedule)
        db.session.commit()

        # 4. Create Days (Weights: 1, 2, 1, 1) -> Total 5.0
        weights = [1.0, 2.0, 1.0, 1.0]
        for i, w in enumerate(weights):
            day = ScheduleDay(
                schedule_id=schedule.id,
                date=date(2025, 1, i + 1),
                weight=w,
                name=f"Day {i+1}",
                is_holiday=(w > 1.0),
            )
            db.session.add(day)

        # 5. Create Requirement
        st = ScheduleStation(schedule_id=schedule.id, station_id=m_station.id)
        db.session.add(st)
        db.session.commit()

        # 🟢 6. Create Members using the REAL IDs from the people we just created
        mem_a = ScheduleMembership(
            schedule_id=schedule.id,
            person_id=test_people[0].id,
            group_id=test_group.id,
            override_seniorityFactor=1.0,
            override_max_assignments=10,
        )
        mem_b = ScheduleMembership(
            schedule_id=schedule.id,
            person_id=test_people[1].id,
            group_id=test_group.id,
            override_seniorityFactor=0.5,
            override_max_assignments=10,
        )
        mem_c = ScheduleMembership(
            schedule_id=schedule.id,
            person_id=test_people[2].id,
            group_id=test_group.id,
            override_seniorityFactor=1.0,
            override_max_assignments=10,
        )
        mem_d = ScheduleMembership(
            schedule_id=schedule.id,
            person_id=test_people[3].id,
            group_id=test_group.id,
            override_seniorityFactor=1.0,
            override_max_assignments=1,
        )

        db.session.add_all([mem_a, mem_b, mem_c, mem_d])
        db.session.commit()

        # 7. Add Leave for Member C
        leave_c = ScheduleLeave(
            membership_id=mem_c.id,
            start_date=date(2025, 1, 2),
            end_date=date(2025, 1, 2),
        )
        db.session.add(leave_c)
        db.session.commit()

        yield {
            "schedule_id": schedule.id,
            "members": {"A": mem_a.id, "B": mem_b.id, "C": mem_c.id, "D": mem_d.id},
        }

        # Cleanup (Children first!)
        db.session.query(ScheduleLeave).delete()
        db.session.query(ScheduleMembership).delete()
        db.session.query(ScheduleStation).delete()
        db.session.query(ScheduleDay).delete()
        db.session.query(Schedule).delete()
        db.session.query(Person).delete()
        db.session.query(Group).delete()
        db.session.commit()


# --- TESTS ---


def test_quota_calculation_logic(app, quota_test_data):
    """
    Verifies the math logic of the waterfall calculator.
    """
    with app.app_context():
        results = calculate_schedule_quotas(quota_test_data["schedule_id"])

        ids = quota_test_data["members"]
        q_a = results[ids["A"]]
        q_b = results[ids["B"]]
        q_c = results[ids["C"]]
        q_d = results[ids["D"]]

        print(f"\nQuota Results: A={q_a}, B={q_b}, C={q_c}, D={q_d}")

        # 1. Total Distributed Check
        # Total Demand = 5.0 points
        total_distributed = q_a + q_b + q_c + q_d
        assert (
            abs(total_distributed - 5.0) < 0.05
        ), f"Total distributed {total_distributed} should be ~5.0"

        # 2. Cap Check (Member D)
        # D is capped at 1 shift. Max day weight is 2.0. Cap = 2.0.
        # D has weight 1.0 (same as A). In a fair world, share would be > 1.25.
        # Let's see if D got capped.
        assert q_d <= 2.0, "Member D exceeded their Point Cap"

        # 3. Seniority Check (A vs B)
        # A (1.0) vs B (0.5). A should have roughly double B's quota.
        # Allow small variance due to waterfall rounding
        ratio = q_a / q_b
        assert 1.8 <= ratio <= 2.2, f"Member A ({q_a}) should be ~2x Member B ({q_b})"

        # 4. Leave Check (A vs C)
        # A = 5.0 avail. C = 3.0 avail (Missed holiday).
        # C should have roughly 60% of A's quota (3/5).
        ratio_c_a = q_c / q_a
        assert (
            0.55 <= ratio_c_a <= 0.65
        ), f"Member C ({q_c}) should be ~60% of Member A ({q_a})"


def test_quota_api_route(client, quota_test_data):
    """
    Verifies the API endpoint works and returns JSON.
    """
    s_id = quota_test_data["schedule_id"]
    response = client.get(f"/api/schedules/{s_id}/quotas")

    assert response.status_code == 200
    data = response.get_json()

    # Check that we got keys for all members
    ids = quota_test_data["members"]
    assert str(ids["A"]) in data
    assert str(ids["B"]) in data
    assert isinstance(data[str(ids["A"])], (int, float))

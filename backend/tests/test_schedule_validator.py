import pytest
from datetime import date, timedelta
from app.models import (
    Schedule,
    ScheduleDay,
    ScheduleMembership,
    Assignment,
    ScheduleLeave,
    ScheduleExclusion,
    ScheduleStation,
    Person,
    Group,
    MasterStation,
)
from app.utils.schedule_validator import validate_schedule
from app import db


# --- FIXTURE: A Clean Base Schedule ---
@pytest.fixture
def validator_base_data(app):
    with app.app_context():
        # 1. Create Definitions
        group = Group(name="Test Group")
        p1 = Person(name="Conflict Guy")
        s1 = MasterStation(name="Station A", abbr="STA-A")
        s2 = MasterStation(name="Station B", abbr="STA-B")

        db.session.add_all([group, p1, s1, s2])
        db.session.commit()

        # 2. Create Schedule
        schedule = Schedule(
            name="Validation Test",
            start_date=date(2025, 2, 1),
            end_date=date(2025, 2, 2),  # 2 Days
            status="draft",
        )
        db.session.add(schedule)
        db.session.commit()

        # 3. Create Days
        d1 = ScheduleDay(schedule_id=schedule.id, date=date(2025, 2, 1), weight=1.0)
        d2 = ScheduleDay(schedule_id=schedule.id, date=date(2025, 2, 2), weight=1.0)
        db.session.add_all([d1, d2])

        # 4. Create Schedule Stations
        ss1 = ScheduleStation(schedule_id=schedule.id, station_id=s1.id)
        ss2 = ScheduleStation(schedule_id=schedule.id, station_id=s2.id)
        db.session.add_all([ss1, ss2])

        # 5. Create Membership
        mem = ScheduleMembership(
            schedule_id=schedule.id, person_id=p1.id, group_id=group.id
        )
        db.session.add(mem)
        db.session.commit()

        yield {
            "schedule_id": schedule.id,
            "member_id": mem.id,
            "day1_id": d1.id,
            "day2_id": d2.id,
            "stationA_id": ss1.id,
            "stationB_id": ss2.id,
            "date1": d1.date,
            "date2": d2.date,
        }

        # Cleanup
        db.session.query(Assignment).delete()
        db.session.query(ScheduleExclusion).delete()
        db.session.query(ScheduleLeave).delete()
        db.session.query(ScheduleMembership).delete()
        db.session.query(ScheduleStation).delete()
        db.session.query(ScheduleDay).delete()
        db.session.query(Schedule).delete()
        db.session.query(Person).delete()
        db.session.query(Group).delete()
        db.session.query(MasterStation).delete()
        db.session.commit()


# --- TESTS ---


def test_double_booking_detection(app, validator_base_data):
    with app.app_context():
        data = validator_base_data

        # Create Double Booking
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        a2 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationB_id"],
            membership_id=data["member_id"],
        )
        db.session.add_all([a1, a2])
        db.session.commit()

        alerts = validate_schedule(data["schedule_id"])

        assert len(alerts) == 1
        # 🟢 UPDATED to match frontend keys
        assert alerts[0]["type"] == "DOUBLE_BOOKING"
        assert a1.id in alerts[0]["assignment_ids"]
        assert a2.id in alerts[0]["assignment_ids"]


def test_back_to_back_detection(app, validator_base_data):
    with app.app_context():
        data = validator_base_data

        # Create Consecutive Assignments
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        a2 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day2_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        db.session.add_all([a1, a2])
        db.session.commit()

        alerts = validate_schedule(data["schedule_id"])

        assert len(alerts) == 1
        assert alerts[0]["type"] == "BACK_TO_BACK"
        assert alerts[0]["assignment_ids"] == [a2.id]


def test_leave_conflict_detection(app, validator_base_data):
    with app.app_context():
        data = validator_base_data

        # Add Leave
        leave = ScheduleLeave(
            membership_id=data["member_id"],
            start_date=data["date1"],
            end_date=data["date1"],
        )
        db.session.add(leave)

        # Add Assignment on Leave day
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        db.session.add(a1)
        db.session.commit()

        alerts = validate_schedule(data["schedule_id"])

        assert len(alerts) == 1
        # 🟢 UPDATED to match frontend keys
        assert alerts[0]["type"] == "LEAVE_CONFLICT"
        assert alerts[0]["assignment_ids"] == [a1.id]


def test_exclusion_conflict_detection(app, validator_base_data):
    with app.app_context():
        data = validator_base_data

        # Create Exclusion
        excl = ScheduleExclusion(
            membership_id=data["member_id"], day_id=data["day1_id"]
        )
        db.session.add(excl)

        # Add Assignment on Excluded day
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        db.session.add(a1)
        db.session.commit()

        alerts = validate_schedule(data["schedule_id"])

        assert len(alerts) == 1
        # 🟢 UPDATED to match frontend keys
        assert alerts[0]["type"] == "EXCLUSION_CONFLICT"
        assert alerts[0]["assignment_ids"] == [a1.id]


def test_lookback_double_booking_ignored(app, validator_base_data):
    """
    Scenario: Double booking occurs on a historical 'Lookback' day.
    Expectation: Validator IGNORES it (0 alerts).
    """
    with app.app_context():
        data = validator_base_data

        # 1. Mark Day 1 as a Lookback Day
        d1 = db.session.get(ScheduleDay, data["day1_id"])
        d1.is_lookback = True
        db.session.commit()

        # 2. Create Double Booking on Day 1
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        a2 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationB_id"],
            membership_id=data["member_id"],
        )
        db.session.add_all([a1, a2])
        db.session.commit()

        # 3. Validate
        alerts = validate_schedule(data["schedule_id"])
        assert len(alerts) == 0  # Should be ignored


def test_lookback_to_lookback_ignored(app, validator_base_data):
    """
    Scenario: Back-to-back assignments where BOTH days are historical.
    Expectation: Validator IGNORES it (0 alerts).
    """
    with app.app_context():
        data = validator_base_data

        # 1. Mark BOTH days as Lookback
        d1 = db.session.get(ScheduleDay, data["day1_id"])
        d2 = db.session.get(ScheduleDay, data["day2_id"])
        d1.is_lookback = True
        d2.is_lookback = True
        db.session.commit()

        # 2. Create Consecutive Assignments
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        a2 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day2_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        db.session.add_all([a1, a2])
        db.session.commit()

        # 3. Validate
        alerts = validate_schedule(data["schedule_id"])
        assert len(alerts) == 0  # Should be ignored


def test_lookback_transition_fatigue_caught(app, validator_base_data):
    """
    Scenario: Assignment on Last Lookback Day -> First Schedule Day.
    Expectation: Validator FLAGS it (Fatigue carries over).
    """
    with app.app_context():
        data = validator_base_data

        # 1. Day 1 is Lookback (History), Day 2 is Normal (Current Schedule)
        d1 = db.session.get(ScheduleDay, data["day1_id"])
        d2 = db.session.get(ScheduleDay, data["day2_id"])
        d1.is_lookback = True
        d2.is_lookback = False
        db.session.commit()

        # 2. Create Consecutive Assignments
        a1 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day1_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        a2 = Assignment(
            schedule_id=data["schedule_id"],
            day_id=data["day2_id"],
            station_id=data["stationA_id"],
            membership_id=data["member_id"],
        )
        db.session.add_all([a1, a2])
        db.session.commit()

        # 3. Validate
        alerts = validate_schedule(data["schedule_id"])

        assert len(alerts) == 1
        assert alerts[0]["type"] == "BACK_TO_BACK"
        # The alert should flag the Current Day (Day 2), not the historical one
        assert alerts[0]["day_id"] == data["day2_id"]

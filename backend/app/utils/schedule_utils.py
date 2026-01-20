from app import db
from app.models import (
    Person,
    ScheduleMembership,
    MembershipStationWeight,
    Qualification,
    ScheduleDay,
    Holiday,
    Assignment,
)
from .holidays import get_holidays_with_breaks
from datetime import timedelta, date


def populate_holiday_table(start_date_str, end_date_str):
    # This calls the API in holidays.py
    holidays = get_holidays_with_breaks(start_date_str, end_date_str)

    for h in holidays:
        # Convert the string date from the API to a Python date object
        date_obj = date.fromisoformat(h["date"])

        # Check if we already have this holiday to avoid UniqueConstraint errors
        existing = Holiday.query.filter_by(date=date_obj).first()
        if not existing:
            new_h = Holiday(date=date_obj, name=h["name"])
            db.session.add(new_h)

    db.session.commit()


def add_person_to_schedule(schedule_id, person_id, group_id=None, **overrides):
    # 1. PRE-FLIGHT CHECK
    exists = ScheduleMembership.query.filter_by(
        schedule_id=schedule_id, person_id=person_id
    ).first()

    if exists:
        raise ValueError("This person is already a member of the schedule.")

    person = db.session.get(Person, person_id)
    if not person:
        raise ValueError("Person not found.")

    # 2. RESOLVE GROUP ID
    target_group_id = group_id if group_id is not None else person.group_id
    if target_group_id is None:
        raise ValueError("Cannot add member: No Group ID provided.")

    # 3. CREATE MEMBERSHIP
    new_mem = ScheduleMembership(
        schedule_id=schedule_id, person_id=person_id, group_id=target_group_id
    )

    # --- THE FIX: Apply Overrides ---
    # This loop allows the test to pass "override_max_assignments"
    valid_overrides = [
        "override_seniorityFactor",
        "override_min_assignments",
        "override_max_assignments",
    ]
    for key, value in overrides.items():
        if key in valid_overrides and value is not None:
            setattr(new_mem, key, value)

    db.session.add(new_mem)
    db.session.flush()

    # 4. AUTO-WEIGHT LOGIC
    active_quals = [q for q in person.qualifications if q.is_active]
    if len(active_quals) == 1:
        auto_weight = MembershipStationWeight(
            membership_id=new_mem.id, station_id=active_quals[0].station_id, weight=1.0
        )
        db.session.add(auto_weight)

    return new_mem


def generate_schedule_days(schedule):
    """
    Populates a schedule with days.
    Monday-Thursday: 1.0
    Friday: 1.5
    Saturday-Sunday: 2.0
    Holidays: 2.0 (and sets name + is_holiday=True)
    """
    # 1. Fetch holidays that fall within this schedule's range
    holidays = Holiday.query.filter(
        Holiday.date >= schedule.start_date, Holiday.date <= schedule.end_date
    ).all()

    # Create a lookup dictionary: {date_object: "Holiday Name"}
    holiday_map = {h.date: h.name for h in holidays}

    current_date = schedule.start_date
    days_to_add = []
    weekdays_map = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]

    while current_date <= schedule.end_date:
        weekday = current_date.weekday()  # 0=Mon, 4=Fri, 5=Sat, 6=Sun

        # Default Weight Logic
        if weekday < 4:  # Mon, Tue, Wed, Thu
            day_weight = 1.0
        elif weekday == 4:  # Fri
            day_weight = 1.5
        else:  # Sat, Sun
            day_weight = 2.0

        # Default name is the Day of the Week
        day_name = weekdays_map[weekday]
        is_holiday = False

        # Holiday Override Logic
        if current_date in holiday_map:
            day_weight = 2.0
            day_name = holiday_map[current_date]
            is_holiday = True

        new_day = ScheduleDay(
            schedule_id=schedule.id,
            date=current_date,
            weight=day_weight,
            name=day_name,
            label=None,
            is_holiday=is_holiday,
        )
        days_to_add.append(new_day)
        current_date += timedelta(days=1)

    db.session.add_all(days_to_add)
    # The route will handle the commit


# app/utils/schedule_utils.py


def generate_assignments_for_station(db_session, schedule, master_station_id):
    """
    Generates empty Assignment slots for every day in a schedule.
    Uses master_station_id because the Assignment model links to MasterStation.
    """
    new_slots = []

    # Ensure schedule.days exists (the fixture must have added them)
    if not schedule.days:
        return 0

    for day in schedule.days:
        new_slots.append(
            Assignment(
                schedule_id=schedule.id,
                day_id=day.id,
                station_id=master_station_id,  # Correct FK for your model
                membership_id=None,
                availability_estimate=1.0,
                is_locked=False,
            )
        )

    db_session.add_all(new_slots)
    return len(new_slots)

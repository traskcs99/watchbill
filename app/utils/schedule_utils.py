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

from datetime import timedelta


def add_person_to_schedule(schedule_id, person_id, overrides=None):
    """
    Creates ScheduleMembership and initializes local MembershipStationWeights.
    Accepts an optional dictionary of overrides for seniority and assignment limits.
    """
    person = db.session.get(Person, person_id)
    if not person:
        return None

    # 1. Create the Membership record
    membership = ScheduleMembership(
        schedule_id=schedule_id, person_id=person_id, group_id=person.group_id
    )

    # 2. Apply Overrides if provided
    if overrides:
        membership.override_seniorityFactor = overrides.get("override_seniorityFactor")
        membership.override_min_assignments = overrides.get("override_min_assignments")
        membership.override_max_assignments = overrides.get("override_max_assignments")

    db.session.add(membership)
    db.session.flush()  # Generate membership.id

    # 3. Create local weights from global qualifications
    active_quals = [q for q in person.qualifications if q.is_active]
    for qual in active_quals:
        local_weight = MembershipStationWeight(
            membership_id=membership.id, station_id=qual.station_id, weight=1.0
        )
        db.session.add(local_weight)

    db.session.commit()
    return membership


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


def generate_assignments_for_station(db_session, schedule, station_id):
    """
    Generates empty Assignment slots for every day in a schedule
    for a specific MasterStation.
    """
    new_slots = []

    # schedule.days is available if you used the relationship back_populates
    for day in schedule.days:
        new_slots.append(
            Assignment(
                schedule_id=schedule.id,
                day_id=day.id,
                station_id=station_id,
                membership_id=None,
                availability_estimate=0.0,
            )
        )

    db_session.add_all(new_slots)
    return len(new_slots)

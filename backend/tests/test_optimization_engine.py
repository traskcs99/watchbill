import pytest
from sqlalchemy import select
from app.models import (
    Schedule,
    Person,
    ScheduleMembership,
    MasterStation,
    ScheduleStation,
    ScheduleDay,
    ScheduleCandidate,
    Group,
)
from app.utils.schedule_utils import generate_schedule_days
from datetime import date
from app.database import db
from app.utils.optimization_service import run_schedule_optimization


def test_solver_generates_candidates(session):
    """
    Integration Test:
    Creates a small schedule, runs the solver, and verifies candidates are created.
    """
    # 1. Setup Data
    sched = Schedule(
        name="Solver Test", start_date=date(2026, 1, 1), end_date=date(2026, 1, 5)
    )
    session.add(sched)
    session.flush()

    # 2. Create Group (REQUIRED by your schema)
    # Note: seniorityFactor defaults to 1.0 if not specified
    test_group = Group(name="Test Group")
    session.add(test_group)
    session.flush()

    # 3. Create Station & Link
    station = MasterStation(name="Duty Driver", abbr="DD")
    session.add(station)
    session.flush()

    # Note: Using ScheduleStation based on your error logs (was ScheduleStationLink)
    link = ScheduleStation(schedule_id=sched.id, station_id=station.id)
    session.add(link)

    # 4. Create People
    p1 = Person(name="Chief Miller", group_id=test_group.id)
    p2 = Person(name="PO1 Smith", group_id=test_group.id)
    p3 = Person(name="SN Jones", group_id=test_group.id)
    session.add_all([p1, p2, p3])
    session.flush()

    # 5. Create Memberships (With Group ID!)
    m1 = ScheduleMembership(
        schedule_id=sched.id, person_id=p1.id, group_id=test_group.id
    )
    m2 = ScheduleMembership(
        schedule_id=sched.id, person_id=p2.id, group_id=test_group.id
    )
    m3 = ScheduleMembership(
        schedule_id=sched.id, person_id=p3.id, group_id=test_group.id
    )
    session.add_all([m1, m2, m3])

    # 6. Generate Days
    generate_schedule_days(sched)
    session.commit()

    # 7. Run Solver
    result = run_schedule_optimization(sched.id, num_candidates=3)

    # 8. Verify
    assert result["status"] == "success"
    assert result["count"] == 3

    candidates = session.scalars(
        select(ScheduleCandidate).filter_by(run_id=result["run_id"])
    ).all()

    assert len(candidates) == 3
    cand = candidates[0]
    assert isinstance(cand.score, float)
    assert len(cand.assignments_data) > 0


def test_hard_constraint_no_back_to_back(session):
    """
    Verify the solver NEVER assigns the same person two days in a row.
    """
    # 1. Setup Schedule
    sched = Schedule(
        name="B2B Test", start_date=date(2026, 2, 1), end_date=date(2026, 2, 5)
    )
    session.add(sched)
    session.flush()

    # 2. Create Group
    b2b_group = Group(name="B2B Group")
    session.add(b2b_group)
    session.flush()

    # 3. Create Station
    station = MasterStation(name="Test Station", abbr="TS")
    session.add(station)
    session.flush()
    session.add(ScheduleStation(schedule_id=sched.id, station_id=station.id))

    # 4. Create People (Only 2 people for 5 days -> Forced tight schedule)
    p1 = Person(name="Person A", group_id=b2b_group.id)
    p2 = Person(name="Person B", group_id=b2b_group.id)
    session.add_all([p1, p2])
    session.flush()

    # 5. Create Memberships (With Group ID)
    session.add(
        ScheduleMembership(schedule_id=sched.id, person_id=p1.id, group_id=b2b_group.id)
    )
    session.add(
        ScheduleMembership(schedule_id=sched.id, person_id=p2.id, group_id=b2b_group.id)
    )

    generate_schedule_days(sched)
    session.commit()

    # 6. Run Solver (Generate 1 Candidate)
    run_schedule_optimization(sched.id, num_candidates=1)

    # 7. Fetch Result
    cand = session.scalars(
        select(ScheduleCandidate).filter_by(schedule_id=sched.id)
    ).first()

    # 8. Validate Logic
    assignments = cand.assignments_data  # {"dayId_stationId": memberId}

    # Get Day Dates
    days = session.scalars(select(ScheduleDay).filter_by(schedule_id=sched.id)).all()
    day_map = {d.id: d.date for d in days}

    # Build timeline: [ (Date, MemberID), ... ]
    timeline = []
    for key, member_id in assignments.items():
        did, sid = map(int, key.split("_"))
        timeline.append((day_map[did], member_id))

    timeline.sort(key=lambda x: x[0])  # Sort by date

    # Check for consecutive days
    for i in range(len(timeline) - 1):
        curr_date, curr_mem = timeline[i]
        next_date, next_mem = timeline[i + 1]

        # If dates are consecutive (e.g. Feb 1 and Feb 2)
        if (next_date - curr_date).days == 1:
            assert (
                curr_mem != next_mem
            ), f"Back-to-Back violation found on {curr_date} and {next_date}"

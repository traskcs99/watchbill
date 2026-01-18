import pytest
from datetime import date
from app.models import (
    Schedule,
    ScheduleDay,
    MasterStation,
    Person,
    ScheduleMembership,
    MembershipStationWeight,
    Group,
    Qualification,
    ScheduleStation,
)
from app.utils.schedule_summary_util import get_schedule_summary_data


@pytest.fixture
def summary_env(session):
    # 1. Schedule & 10 Days
    sch = Schedule(
        name="Summary Test", start_date=date(2026, 1, 1), end_date=date(2026, 1, 10)
    )
    session.add(sch)
    session.flush()
    for i in range(1, 11):
        session.add(ScheduleDay(schedule_id=sch.id, date=date(2026, 1, i), weight=1.0))

    # 2. Stations & LINK them to the schedule (Crucial Fix)
    ood = MasterStation(name="Officer of the Deck", abbr="OOD")
    jood = MasterStation(name="Junior Officer of the Deck", abbr="JOOD")
    session.add_all([ood, jood])
    session.flush()

    # These links allow the utility to find the stations
    session.add(ScheduleStation(schedule_id=sch.id, station_id=ood.id))
    session.add(ScheduleStation(schedule_id=sch.id, station_id=jood.id))

    # 3. Personnel & Membership
    grp = Group(name="Section 1")
    john = Person(name="John Smith")
    session.add_all([grp, john])
    session.flush()

    session.add(Qualification(person_id=john.id, station_id=ood.id))
    session.add(Qualification(person_id=john.id, station_id=jood.id))

    mem = ScheduleMembership(schedule_id=sch.id, person_id=john.id, group_id=grp.id)
    session.add(mem)
    session.commit()

    return {"schedule": sch, "membership": mem, "ood": ood, "jood": jood}


# --- Tests (Updating keys to match) ---


def test_summary_calculates_correct_demand(summary_env):
    res = get_schedule_summary_data(summary_env["schedule"].id)
    assert res["total_calendar_load"] == 10.0


def test_summary_identifies_unsolvable_schedule(summary_env):
    res = get_schedule_summary_data(summary_env["schedule"].id)
    # is_solvable is false because no MembershipStationWeights are set yet
    assert res["is_solvable"] is False
    assert any("no assigned personnel" in w for w in res["warnings"])


def test_summary_calculates_load_factor(session, summary_env):
    mem_id = summary_env["membership"].id
    ood_id = summary_env["ood"].id
    session.add(
        MembershipStationWeight(membership_id=mem_id, station_id=ood_id, weight=2.0)
    )
    session.commit()

    res = get_schedule_summary_data(summary_env["schedule"].id)
    ood_stats = next(s for s in res["station_health"] if s["abbr"] == "OOD")
    assert ood_stats["supply_weight"] == 2.0
    assert ood_stats["load_factor"] == 5.0  # 10.0 load / 2.0 supply

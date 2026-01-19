from sqlalchemy import func
from ..database import db
from ..models import (
    Schedule,
    ScheduleDay,
    ScheduleMembership,
    MembershipStationWeight,
    ScheduleStation,
    Person,
)


def get_schedule_summary_data(schedule_id):
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return None

    # Initialize warnings list
    warnings = []

    # 1. Calculate Demand
    total_calendar_weight = (
        db.session.query(func.sum(ScheduleDay.weight))
        .filter(ScheduleDay.schedule_id == schedule_id)
        .scalar()
        or 0.0
    )

    # 2. Get all Stations linked to this schedule
    stations_in_schedule = ScheduleStation.query.filter_by(
        schedule_id=schedule_id
    ).all()

    station_analysis = []

    for sch_station in stations_in_schedule:
        station = sch_station.master_station
        # 3. Calculate Supply for this specific Station
        total_personnel_weight = (
            db.session.query(func.sum(MembershipStationWeight.weight))
            .join(ScheduleMembership)
            .filter(
                ScheduleMembership.schedule_id == schedule_id,
                MembershipStationWeight.station_id == station.id,
            )
            .scalar()
            or 0.0
        )

        member_count = (
            db.session.query(func.count(MembershipStationWeight.id))
            .join(ScheduleMembership)
            .filter(
                ScheduleMembership.schedule_id == schedule_id,
                MembershipStationWeight.station_id == station.id,
            )
            .scalar()
            or 0
        )

        # 4. Calculate Load Factor
        load_factor = 0
        if total_personnel_weight > 0:
            load_factor = round(total_calendar_weight / total_personnel_weight, 2)

        # Determine Status and append station-specific warnings
        status = "healthy"
        if member_count == 0:
            status = "critical"
            warnings.append(f"Station {station.abbr} has no assigned personnel.")
        elif load_factor > 10:
            status = "warning"
            warnings.append(
                f"Station {station.abbr} load is high (Avg {load_factor} units)."
            )

        station_analysis.append(
            {
                "station_id": station.id,
                "abbr": station.abbr,
                "name": station.name,
                "assigned_members_count": member_count,
                "supply_weight": float(total_personnel_weight),  # named for clarity
                "load_factor": float(load_factor),
                "status": status,
            }
        )

    # 5. Personnel Overload Check (The "Multi-Role" warning)
    overloaded_people = (
        db.session.query(
            Person.name, func.sum(MembershipStationWeight.weight).label("total_weight")
        )
        .join(ScheduleMembership, Person.id == ScheduleMembership.person_id)
        .join(
            MembershipStationWeight,
            ScheduleMembership.id == MembershipStationWeight.membership_id,
        )
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .group_by(Person.id)
        .having(func.sum(MembershipStationWeight.weight) > 1.0)
        .all()
    )

    for p in overloaded_people:
        warnings.append(
            f"Member {p.name} is over-assigned (Total Weight: {p.total_weight})."
        )

    return {
        "schedule_id": schedule.id,
        "schedule_name": schedule.name,
        "total_calendar_load": float(total_calendar_weight),  # Matches test expectation
        "station_health": station_analysis,
        "warnings": warnings,
        "is_solvable": (
            all(s["assigned_members_count"] > 0 for s in station_analysis)
            if station_analysis
            else False
        ),
    }

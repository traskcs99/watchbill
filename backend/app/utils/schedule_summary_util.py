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


from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import func
from ..database import db
from ..models import (
    Schedule,
    ScheduleDay,
    ScheduleStation,
    ScheduleMembership,
    MembershipStationWeight,
    Assignment,
)


def get_schedule_summary_data(schedule_id):
    """
    Fetches all data for the Schedule Workspace in a single 'Power Query'.
    Solves N+1 issues by eager-loading days, stations, memberships, and assignments.
    """
    # 1. THE POWER QUERY
    # We use selectinload for collections (lists) and joinedload for single objects
    schedule = (
        db.session.query(Schedule)
        .options(
            # Load the calendar days
            selectinload(Schedule.days),
            # Load the station links + the MasterStation info (Abbr, Name)
            selectinload(Schedule.required_stations).joinedload(
                ScheduleStation.master_station
            ),
            # Load the Roster + Personnel details + their specific Weights + Qualifications
            selectinload(Schedule.memberships).options(
                joinedload(ScheduleMembership.person),
                joinedload(ScheduleMembership.group),
                selectinload(ScheduleMembership.station_weights).joinedload(
                    MembershipStationWeight.station
                ),
                selectinload(ScheduleMembership.leaves),
                # Note: qualifications are usually on the Person model
                joinedload(ScheduleMembership.person).selectinload(
                    Person.qualifications
                ),
            ),
            # Load all Assignment slots for the month (The grid data)
            selectinload(Schedule.assignments).options(
                joinedload(Assignment.day),
                joinedload(Assignment.master_station),
                # Nested join: Assignment -> Membership -> Person (to get the name)
                joinedload(Assignment.membership).joinedload(ScheduleMembership.person),
            ),
        )
        .filter(Schedule.id == schedule_id)
        .first()
    )

    if not schedule:
        return None

    # Force a refresh to ensure we aren't looking at a stale session cache
    db.session.refresh(schedule)

    warnings = []

    # 2. Demand Calculation (Using pre-loaded days)
    total_calendar_weight = sum(day.weight for day in schedule.days)

    # 3. Station Health Analysis
    station_analysis = []
    for sch_station in schedule.required_stations:
        master = sch_station.master_station

        # Calculate supply by looking at pre-loaded memberships
        relevant_weights = [
            sw.weight
            for mem in schedule.memberships
            for sw in mem.station_weights
            if sw.station_id == master.id
        ]

        supply_weight = sum(relevant_weights)
        member_count = len(relevant_weights)

        # Calculate Load Factor (Demand / Supply)
        load_factor = (
            round(total_calendar_weight / supply_weight, 2) if supply_weight > 0 else 0
        )
        db.session.refresh(schedule)
        status = "healthy"
        if member_count == 0:
            status = "critical"
            warnings.append(f"Station {master.abbr} has no assigned personnel.")
        elif load_factor > 10:
            status = "warning"
            warnings.append(
                f"Station {master.abbr} load is high (Factor: {load_factor})."
            )

        station_analysis.append(
            {
                "station_id": master.id,
                "abbr": master.abbr,
                "name": master.name,
                "assigned_members_count": member_count,
                "supply_weight": float(supply_weight),
                "load_factor": float(load_factor),
                "status": status,
            }
        )

    # 4. Personnel Overload Check (Total weight across all stations for a person)
    for mem in schedule.memberships:
        total_mem_weight = sum(sw.weight for sw in mem.station_weights)
        if total_mem_weight > 1.0:
            warnings.append(
                f"Member {mem.person.name} is over-assigned (Total Weight: {total_mem_weight})."
            )

    # 5. Build Final Response
    return {
        "schedule_id": schedule.id,
        "schedule_name": schedule.name,
        "total_calendar_load": float(total_calendar_weight),
        "is_solvable": (
            all(s["assigned_members_count"] > 0 for s in station_analysis)
            if station_analysis
            else False
        ),
        "warnings": warnings,
        "station_health": station_analysis,
        "required_stations": [s.to_dict() for s in schedule.required_stations],
        "memberships": [m.to_dict() for m in schedule.memberships],
        "member_count": len(schedule.memberships),
        # Removed "assignments" for performance.
        # Create a separate endpoint like /api/schedules/<id>/assignments for the Calendar grid.
    }

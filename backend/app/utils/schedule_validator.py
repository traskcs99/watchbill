from collections import defaultdict
from datetime import timedelta
from ..models import (
    Assignment,
    ScheduleDay,
    ScheduleMembership,
    ScheduleLeave,
    ScheduleExclusion,
    ScheduleStation,
    MasterStation,
    Person,
)
from ..database import db


def validate_schedule(schedule_id):
    """
    Runs sanity checks on the schedule and returns a list of alerts.
    Ignores conflicts that occur entirely within 'Lookback' days.
    """
    alerts = []

    # 1. FETCH ALL DATA
    assignments = db.session.query(Assignment).filter_by(schedule_id=schedule_id).all()
    if not assignments:
        return []

    # Get Days & Lookback Status
    days = ScheduleDay.query.filter_by(schedule_id=schedule_id).all()
    day_map = {d.id: d.date for d in days}
    date_str_map = {d.id: d.date.strftime("%m/%d") for d in days}
    # 🟢 Create a map to check if a day is a "Lookback" day
    lookback_map = {d.id: getattr(d, "is_lookback", False) for d in days}

    # Get Members
    members = (
        db.session.query(ScheduleMembership)
        .join(Person)
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .all()
    )
    member_map = {m.id: m.person.name for m in members}

    # Get Station Names
    st_records = (
        db.session.query(ScheduleStation, MasterStation)
        .join(MasterStation, ScheduleStation.station_id == MasterStation.id)
        .filter(ScheduleStation.schedule_id == schedule_id)
        .all()
    )
    station_map = {s.ScheduleStation.id: s.MasterStation.abbr for s in st_records}

    # Get Leaves
    leaves = (
        ScheduleLeave.query.join(ScheduleMembership)
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .all()
    )
    leave_map = defaultdict(list)
    for l in leaves:
        leave_map[l.membership_id].append((l.start_date, l.end_date))

    # Get Exclusions
    exclusions = (
        ScheduleExclusion.query.join(ScheduleMembership)
        .filter(ScheduleMembership.schedule_id == schedule_id)
        .all()
    )
    exclusion_set = {(e.day_id, e.membership_id) for e in exclusions}

    # 2. PROCESS ASSIGNMENTS
    member_assignments = defaultdict(list)
    daily_load = defaultdict(list)

    for a in assignments:
        if not a.membership_id:
            continue

        # 🟢 Check Lookback Status
        is_lookback = lookback_map.get(a.day_id, False)

        d_date = day_map.get(a.day_id)
        m_name = member_map.get(a.membership_id, "Unknown")
        s_name = station_map.get(a.station_id, "UNK")
        d_str = date_str_map.get(a.day_id, "Unknown Date")

        entry = {
            "id": a.id,
            "date": d_date,
            "date_str": d_str,
            "day_id": a.day_id,
            "station_name": s_name,
            "member_name": m_name,
            "is_lookback": is_lookback,  # Store for B2B check
        }

        member_assignments[a.membership_id].append(entry)
        daily_load[(a.day_id, a.membership_id)].append(entry)

        # 🟢 SKIP Single-Day Checks if this is a Lookback Day
        if is_lookback:
            continue

        # CHECK 3: LEAVE CONFLICT
        if a.membership_id in leave_map:
            for start, end in leave_map[a.membership_id]:
                if start <= d_date <= end:
                    alerts.append(
                        {
                            "type": "LEAVE_CONFLICT",
                            "day_id": a.day_id,
                            "date": d_str,
                            "member": m_name,
                            "assignment_ids": [a.id],
                            "message": f"Assigned to {s_name} while on leave",
                        }
                    )

        # CHECK 4: EXCLUSION CONFLICT
        if (a.day_id, a.membership_id) in exclusion_set:
            alerts.append(
                {
                    "type": "EXCLUSION_CONFLICT",
                    "day_id": a.day_id,
                    "date": d_str,
                    "member": m_name,
                    "assignment_ids": [a.id],
                    "message": f"Assigned to {s_name} on an excluded day",
                }
            )

    # CHECK 1: DOUBLE BOOKING
    for (day_id, mem_id), entries in daily_load.items():
        # 🟢 SKIP if Lookback Day (we don't care about historical double bookings)
        if lookback_map.get(day_id, False):
            continue

        if len(entries) > 1:
            ids = [e["id"] for e in entries]
            name = entries[0]["member_name"]
            stations_str = ", ".join([e["station_name"] for e in entries])
            alerts.append(
                {
                    "type": "DOUBLE_BOOKING",
                    "day_id": day_id,
                    "date": date_str_map.get(day_id),
                    "member": name,
                    "assignment_ids": ids,
                    "message": f"Double booked: {stations_str}",
                }
            )

    # CHECK 2: BACK-TO-BACK
    for mem_id, entries in member_assignments.items():
        entries.sort(key=lambda x: x["date"])
        for i in range(len(entries) - 1):
            curr, next_asn = entries[i], entries[i + 1]

            # Check consecutive days
            if (next_asn["date"] - curr["date"]) == timedelta(days=1):

                # 🟢 LOGIC: Ignore only if BOTH are lookback days
                if curr["is_lookback"] and next_asn["is_lookback"]:
                    continue

                # If 'curr' is Lookback and 'next' is Normal -> This IS a conflict (Fatigue carries over)
                # If 'curr' is Normal and 'next' is Normal -> This IS a conflict

                date_range = f"{curr['date_str']} -> {next_asn['date_str']}"

                alerts.append(
                    {
                        "type": "BACK_TO_BACK",
                        "day_id": next_asn["day_id"],
                        "date": next_asn["date_str"],
                        "member": curr["member_name"],
                        "assignment_ids": [next_asn["id"]],
                        "message": f"Back-to-back: {curr['station_name']} ({curr['date_str']}) to {next_asn['station_name']} ({next_asn['date_str']})",
                    }
                )

    return alerts

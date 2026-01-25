from ..models import Schedule, ScheduleMembership, ScheduleDay
from ..database import db


def calculate_schedule_quotas(schedule_id):
    """
    Calculates the 'Fair Share' quota (in Points) for every member.
    """
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return {}

    # 1. FETCH DAYS & ANALYZE WEIGHTS
    days = ScheduleDay.query.filter_by(schedule_id=schedule_id).all()
    if not days:
        return {}

    max_day_weight = max((float(d.weight) for d in days), default=1.0)

    total_schedule_points = 0.0
    total_demand_points = 0.0

    # Assumption: daily slots needed is constant based on required_stations length
    daily_slots_count = len(schedule.required_stations)

    for day in days:
        w = float(day.weight)
        total_schedule_points += w
        total_demand_points += w * daily_slots_count

    if total_schedule_points == 0:
        return {}

    # 2. PREPARE POOL
    memberships = ScheduleMembership.query.filter_by(schedule_id=schedule_id).all()
    pool = []

    for m in memberships:
        # --- LEAVE ADJUSTMENT ---
        points_lost = 0.0
        for day in days:
            is_on_leave = any(l.start_date <= day.date <= l.end_date for l in m.leaves)
            if is_on_leave:
                points_lost += float(day.weight)

        member_available_points = max(0, total_schedule_points - points_lost)
        availability_ratio = member_available_points / total_schedule_points

        # --- SENIORITY ---
        # 1. Check Membership Override first
        seniority = 1.0
        if m.override_seniorityFactor is not None:
            seniority = float(m.override_seniorityFactor)
        # 2. Check Group column: seniorityFactor (Found in models.py)
        elif m.group is not None:
            seniority = float(m.group.seniorityFactor)

        # --- MAX ASSIGNMENTS ---
        # 1. Check Membership Override first
        shift_cap = 999
        if m.override_max_assignments is not None:
            shift_cap = float(m.override_max_assignments)
        # 2. Check Group column: max_assignments (Found in models.py)
        elif m.group is not None:
            shift_cap = float(m.group.max_assignments)

        # Convert Shift Cap to Point Cap (using max day weight)
        point_cap = shift_cap * max_day_weight

        # Final Weight
        raw_weight = availability_ratio * seniority

        pool.append(
            {
                "id": m.id,
                "weight": raw_weight,
                "max_load": point_cap,
                "assigned_quota": 0.0,
                "is_locked": False,
            }
        )

    # 3. WATERFALL DISTRIBUTION
    remaining_demand = total_demand_points

    while True:
        # Use ['is_locked'] instead of .is_locked
        active_pool = [p for p in pool if not p["is_locked"]]
        if not active_pool:
            break

        total_active_weight = sum(p["weight"] for p in active_pool)
        if total_active_weight == 0:
            break

        offenders = []
        for p in active_pool:
            # Use ['weight'] and ['max_load']
            share = (p["weight"] / total_active_weight) * remaining_demand
            if share > p["max_load"]:
                offenders.append(p)

        if not offenders:
            for p in active_pool:
                p["assigned_quota"] = (
                    p["weight"] / total_active_weight
                ) * remaining_demand
            break
        else:
            for p in offenders:
                p["assigned_quota"] = p["max_load"]
                p["is_locked"] = True  # Set dictionary key
                remaining_demand -= p["max_load"]

    return {p["id"]: round(p["assigned_quota"], 2) for p in pool}

import pulp as lp
import random
import uuid
from sqlalchemy import select
from ..database import db
from ..models import (
    Schedule,
    ScheduleCandidate,
    ScheduleDay,
    ScheduleMembership,
    Assignment,
    ScheduleStation,
)


def run_schedule_optimization(schedule_id: int, num_candidates: int = 5):
    """
    Generates diverse schedule candidates using Stochastic Weight Perturbation.
    SQLAlchemy 2.0 Compliant.
    """
    # 1. Fetch Schedule
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return {"status": "error", "message": "Schedule not found"}

    # 2. Fetch Days (Sorted by Date is CRITICAL for back-to-back checks)
    stmt_days = (
        select(ScheduleDay)
        .filter_by(schedule_id=schedule_id)
        .order_by(ScheduleDay.date)
    )
    days = db.session.scalars(stmt_days).all()
    active_days = [d for d in days if not d.is_lookback]

    # 3. Fetch Members
    stmt_members = select(ScheduleMembership).filter_by(schedule_id=schedule_id)
    members = db.session.scalars(stmt_members).all()

    # 4. Fetch Locked Assignments
    stmt_locks = select(Assignment).filter_by(schedule_id=schedule_id, is_locked=True)
    locked_assignments = db.session.scalars(stmt_locks).all()
    locked_map = {(a.day_id, a.station_id): a.membership_id for a in locked_assignments}

    # Define Shifts
    shifts = []
    # Note: Ensure schedule.required_stations is populated (lazy loading handled by SA)
    stations = schedule.required_stations

    for day in active_days:
        for station in stations:
            shifts.append((day.id, station.id))

    # Safe Group Weights Access
    group_weights = {
        str(k): float(v) for k, v in (schedule.group_weights or {}).items()
    }

    run_id = str(uuid.uuid4())
    generated_candidates = []

    # Calculate Fair Share
    active_people_count = len(
        [m for m in members if (m.override_max_assignments or 99) > 0]
    )
    fair_share = len(shifts) / active_people_count if active_people_count else 0

    # --- CANDIDATE GENERATION LOOP ---
    for i in range(num_candidates):

        # A. Perturbation
        variation = 1.0 if i == 0 else random.uniform(0.85, 1.15)
        sw_quota = schedule.weight_quota_deviation * variation
        sw_spacing1 = schedule.weight_spacing_1_day * variation

        prob = lp.LpProblem(f"Run_{run_id}_{i}", lp.LpMinimize)

        # B. Variables
        X = {}
        for m in members:
            for day_id, station_id in shifts:
                X[(m.id, day_id, station_id)] = lp.LpVariable(
                    f"x_{m.id}_{day_id}_{station_id}_{i}", 0, 1, lp.LpBinary
                )

        # C. Trackers
        member_penalties = {m.id: [] for m in members}
        solver_objective_terms = []

        # --- D. HARD CONSTRAINTS ---

        # 1. Locks: Force Locked Assignments
        for (l_day, l_station), l_member in locked_map.items():
            if (l_member, l_day, l_station) in X:
                prob += X[(l_member, l_day, l_station)] == 1

        # 2. Fill: Every shift must have exactly 1 person
        for day_id, station_id in shifts:
            prob += lp.lpSum([X[(m.id, day_id, station_id)] for m in members]) == 1

        # 3. One-Per-Day: No one works twice on same day
        for m in members:
            for day in active_days:
                daily_vars = [X[(m.id, day.id, s.id)] for s in stations]
                prob += lp.lpSum(daily_vars) <= 1

        # 🟢 4. NO BACK-TO-BACK SHIFTS (CRITICAL FIX) 🟢
        # Logic: (Work Today) + (Work Tomorrow) <= 1
        sorted_d_ids = [
            d.id for d in active_days
        ]  # Ensure these are sorted chronologically

        for m in members:
            for k in range(len(sorted_d_ids) - 1):
                d_curr = sorted_d_ids[k]
                d_next = sorted_d_ids[k + 1]

                # Sum of all stations for current day (should be 0 or 1)
                work_curr = lp.lpSum([X[(m.id, d_curr, s.id)] for s in stations])

                # Sum of all stations for next day
                work_next = lp.lpSum([X[(m.id, d_next, s.id)] for s in stations])

                # Constraint: You cannot do both
                prob += work_curr + work_next <= 1, f"NoB2B_{m.id}_{d_curr}_{i}"

        # --- E. SOFT CONSTRAINTS & GROUP SENSITIVITY ---

        def get_sensitivity(member):
            # Access relationship safely
            gid = str(member.group_id) if member.group_id else "0"
            return group_weights.get(gid, 1.0)

        # Quota Logic
        for m in members:
            actual = lp.lpSum([X[(m.id, d, s)] for d, s in shifts])
            target = fair_share
            excess = lp.LpVariable(f"excess_{m.id}_{i}", 0)
            shortage = lp.LpVariable(f"shortage_{m.id}_{i}", 0)

            prob += actual - target == excess - shortage

            sensitivity = get_sensitivity(m)

            term = (excess + shortage) * sw_quota * sensitivity
            solver_objective_terms.append(term)

            member_penalties[m.id].append((schedule.weight_quota_deviation, excess))
            member_penalties[m.id].append((schedule.weight_quota_deviation, shortage))

        # Spacing Logic (1 Day Gap / Mon-Wed)
        for m in members:
            for k in range(len(sorted_d_ids) - 2):
                d1 = sorted_d_ids[k]
                d3 = sorted_d_ids[k + 2]  # Check T and T+2

                work_d1 = lp.lpSum([X[(m.id, d1, s.id)] for s in stations])
                work_d3 = lp.lpSum([X[(m.id, d3, s.id)] for s in stations])

                # If d1 + d3 > 1 (meaning 2), then is_gap must be 1
                is_gap = lp.LpVariable(f"gap1_{m.id}_{d1}_{i}", 0, 1, lp.LpBinary)
                prob += is_gap >= work_d1 + work_d3 - 1

                sensitivity = get_sensitivity(m)
                solver_objective_terms.append(is_gap * sw_spacing1 * sensitivity)
                member_penalties[m.id].append((schedule.weight_spacing_1_day, is_gap))

        # F. Solve
        prob += lp.lpSum(solver_objective_terms)

        # Using GLPK or CBC (default)
        # msg=0 suppresses console spam
        prob.solve(lp.PULP_CBC_CMD(msg=0))

        # G. Save Results
        if lp.LpStatus[prob.status] == "Optimal":
            assignment_map = {}
            metric_data = {}
            total_reporting_score = 0.0

            for (m_id, d_id, s_id), var in X.items():
                if var.varValue and var.varValue > 0.5:
                    assignment_map[f"{d_id}_{s_id}"] = m_id

            for m in members:
                raw_score = 0.0
                for base_weight, var in member_penalties[m.id]:
                    if var.varValue and var.varValue > 0:
                        raw_score += var.varValue * base_weight

                total_reporting_score += raw_score
                assigned_count = sum(1 for k, v in assignment_map.items() if v == m.id)

                metric_data[m.person.name] = {
                    "score": round(raw_score, 2),
                    "assigned": assigned_count,
                    "member_id": m.id,
                    "group_factor": get_sensitivity(m),
                }

            cand = ScheduleCandidate(
                schedule_id=schedule_id,
                run_id=run_id,
                score=round(total_reporting_score, 2),
                assignments_data=assignment_map,
                metrics_data=metric_data,
            )
            db.session.add(cand)
            generated_candidates.append(cand)

    db.session.commit()
    return {"status": "success", "run_id": run_id, "count": len(generated_candidates)}

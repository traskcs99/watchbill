import pulp as lp
import random
import uuid
from sqlalchemy import select, delete
from app.database import db
from app.models import (
    Schedule,
    ScheduleCandidate,
    ScheduleDay,
    ScheduleMembership,
    Assignment,
    ScheduleStation,
    Group,
    Person,
    MasterStation,
    ScheduleLeave,
    Qualification as PersonQualification,
)
from app.utils.quota_calculator import calculate_schedule_quotas
import json
import pytest

from datetime import date, timedelta


def run_schedule_optimization(schedule_id: int, num_candidates: int = 5):
    """
    Generates schedule candidates using Stochastic Weight Perturbation.
    Supports Long Weekends (Holiday Adjacency) and Minimax Fairness.
    """
    # 1. Fetch Schedule
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return {"status": "error", "message": "Schedule not found"}

    # 2. Fetch Days (Sorted by Date is CRITICAL)
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
    # Ensure this relationship is populated in your model
    stations = schedule.required_stations

    for day in active_days:
        for station in stations:
            shifts.append((day.id, station.id))

    # --- SENSITIVITY LOGIC ---
    schedule_group_weights = {
        str(k): float(v) for k, v in (schedule.group_weights or {}).items()
    }

    def get_member_priority(member) -> float:
        group_id = member.person.group_id if member.person else None
        if not group_id:
            return 1.0
        if str(group_id) in schedule_group_weights:
            return schedule_group_weights[str(group_id)]
        return 1.0

    # --- QUOTA CALCULATION ---
    quota_targets = calculate_schedule_quotas(schedule_id)
    day_weight_map = {d.id: float(d.weight) for d in active_days}

    # --- LONG WEEKEND CLUSTERING LOGIC ---
    weekend_groups = []
    sorted_active_days = sorted(active_days, key=lambda x: x.date)

    def is_weekend_part(d):
        # Checks for Sat(5), Sun(6), or is_holiday flag
        return d.date.weekday() in [5, 6] or getattr(d, "is_holiday", False)

    potential_indices = [
        i for i, d in enumerate(sorted_active_days) if is_weekend_part(d)
    ]

    if potential_indices:
        current_cluster = [sorted_active_days[potential_indices[0]]]
        for i in range(1, len(potential_indices)):
            prev_idx = potential_indices[i - 1]
            curr_idx = potential_indices[i]
            day_prev = sorted_active_days[prev_idx]
            day_curr = sorted_active_days[curr_idx]

            if (day_curr.date - day_prev.date).days == 1:
                current_cluster.append(day_curr)
            else:
                weekend_groups.append(current_cluster)
                current_cluster = [day_curr]
        if current_cluster:
            weekend_groups.append(current_cluster)

    # Filter: Must contain Sat or Sun to count as a Weekend Block
    final_weekend_groups = []
    for grp in weekend_groups:
        has_sat_sun = any(d.date.weekday() in [5, 6] for d in grp)
        if has_sat_sun:
            final_weekend_groups.append(grp)

    run_id = str(uuid.uuid4())
    generated_candidates = []

    # --- OPTIMIZATION LOOP ---
    for i in range(num_candidates):
        variation = 1.0 if i == 0 else random.uniform(0.85, 1.15)

        sw_quota = (schedule.weight_quota_deviation or 1.0) * variation
        sw_goal = (schedule.weight_goal_deviation or 0.5) * variation
        sw_spacing1 = (schedule.weight_spacing_1_day or 1.5) * variation
        sw_spacing2 = (schedule.weight_spacing_2_day or 1.0) * variation
        sw_same_weekend = (schedule.weight_same_weekend or 1.0) * variation
        sw_consecutive = (schedule.weight_consecutive_weekends or 1.5) * variation

        prob = lp.LpProblem(f"Run_{run_id}_{i}", lp.LpMinimize)

        # Variables
        X = {}
        for m in members:
            for day_id, station_id in shifts:
                X[(m.id, day_id, station_id)] = lp.LpVariable(
                    f"x_{m.id}_{day_id}_{station_id}_{i}", 0, 1, lp.LpBinary
                )

        # Trackers
        member_penalties = {m.id: [] for m in members}
        solver_objective_terms = []

        # --- HARD CONSTRAINTS ---

        # 1. Locks
        for (l_day, l_station), l_member in locked_map.items():
            if (l_member, l_day, l_station) in X:
                prob += X[(l_member, l_day, l_station)] == 1

        # 2. Fill
        for day_id, station_id in shifts:
            prob += lp.lpSum([X[(m.id, day_id, station_id)] for m in members]) == 1

        # 3. One-Per-Day
        for m in members:
            for day in active_days:
                prob += lp.lpSum([X[(m.id, day.id, s.id)] for s in stations]) <= 1

        # 4. No Back-To-Back
        sorted_d_ids = [d.id for d in sorted_active_days]
        for m in members:
            for k in range(len(sorted_d_ids) - 1):
                d_curr = sorted_d_ids[k]
                d_next = sorted_d_ids[k + 1]
                work_curr = lp.lpSum([X[(m.id, d_curr, s.id)] for s in stations])
                work_next = lp.lpSum([X[(m.id, d_next, s.id)] for s in stations])
                prob += work_curr + work_next <= 1

        # 5. Min/Max Counts
        for m in members:
            max_limit = m.override_max_assignments
            min_limit = m.override_min_assignments
            if max_limit is None and m.person.group:
                max_limit = m.person.group.max_assignments
            if min_limit is None and m.person.group:
                min_limit = m.person.group.min_assignments

            if max_limit is None:
                max_limit = 999
            if min_limit is None:
                min_limit = 0

            total_assigned = lp.lpSum([X[(m.id, d, s)] for d, s in shifts])
            prob += total_assigned <= max_limit
            prob += total_assigned >= min_limit

        # --- SOFT CONSTRAINTS ---

        # 1. Quota & Goal Deviation
        for m in members:
            actual_points = lp.lpSum(
                [X[(m.id, d, s)] * day_weight_map.get(d, 1.0) for d, s in shifts]
            )
            target = quota_targets.get(m.id, 0.0)

            excess = lp.LpVariable(f"excess_{m.id}_{i}", 0)
            shortage = lp.LpVariable(f"shortage_{m.id}_{i}", 0)
            prob += actual_points - target == excess - shortage

            priority = get_member_priority(m)
            combined_weight = (sw_quota + sw_goal) * priority

            # (excess + shortage) creates an LpAffineExpression, NOT a Variable
            term = (excess + shortage) * combined_weight
            solver_objective_terms.append(term)
            member_penalties[m.id].append((combined_weight, excess + shortage))

        # 2. Spacing 1-Day
        for m in members:
            for k in range(len(sorted_d_ids) - 2):
                d1 = sorted_d_ids[k]
                d3 = sorted_d_ids[k + 2]
                work_d1 = lp.lpSum([X[(m.id, d1, s.id)] for s in stations])
                work_d3 = lp.lpSum([X[(m.id, d3, s.id)] for s in stations])
                is_gap = lp.LpVariable(f"gap1_{m.id}_{d1}_{i}", 0, 1, lp.LpBinary)
                prob += is_gap >= work_d1 + work_d3 - 1

                priority = get_member_priority(m)
                solver_objective_terms.append(is_gap * sw_spacing1 * priority)
                member_penalties[m.id].append((sw_spacing1 * priority, is_gap))

        # 3. Spacing 2-Day
        for m in members:
            if len(sorted_d_ids) >= 4:
                for k in range(len(sorted_d_ids) - 3):
                    d1 = sorted_d_ids[k]
                    d4 = sorted_d_ids[k + 3]
                    work_d1 = lp.lpSum([X[(m.id, d1, s.id)] for s in stations])
                    work_d4 = lp.lpSum([X[(m.id, d4, s.id)] for s in stations])
                    is_gap2 = lp.LpVariable(f"gap2_{m.id}_{d1}_{i}", 0, 1, lp.LpBinary)
                    prob += is_gap2 >= work_d1 + work_d4 - 1

                    priority = get_member_priority(m)
                    solver_objective_terms.append(is_gap2 * sw_spacing2 * priority)
                    member_penalties[m.id].append((sw_spacing2 * priority, is_gap2))

        # 4. Long Weekend Logic
        worked_weekend_vars = {m.id: [] for m in members}

        for idx, w_days in enumerate(final_weekend_groups):
            for m in members:
                weekend_work_sum = lp.lpSum(
                    [X[(m.id, d.id, s.id)] for d in w_days for s in stations]
                )
                priority = get_member_priority(m)

                if len(w_days) > 1:
                    is_same_weekend = lp.LpVariable(
                        f"same_wknd_{m.id}_{idx}_{i}", 0, 1, lp.LpBinary
                    )
                    prob += is_same_weekend >= weekend_work_sum - 1

                    solver_objective_terms.append(
                        is_same_weekend * sw_same_weekend * priority
                    )
                    member_penalties[m.id].append(
                        (sw_same_weekend * priority, is_same_weekend)
                    )

                is_weekend_worked = lp.LpVariable(
                    f"worked_wknd_{m.id}_{idx}_{i}", 0, 1, lp.LpBinary
                )
                prob += is_weekend_worked >= weekend_work_sum * (1.0 / len(w_days))

                worked_weekend_vars[m.id].append(is_weekend_worked)

        # C. Consecutive Weekends
        for m in members:
            w_vars = worked_weekend_vars[m.id]
            for k in range(len(w_vars) - 1):
                is_consecutive = lp.LpVariable(
                    f"cons_wknd_{m.id}_{k}_{i}", 0, 1, lp.LpBinary
                )
                prob += is_consecutive >= w_vars[k] + w_vars[k + 1] - 1

                priority = get_member_priority(m)
                solver_objective_terms.append(
                    is_consecutive * sw_consecutive * priority
                )
                member_penalties[m.id].append(
                    (sw_consecutive * priority, is_consecutive)
                )

        # F. Minimax Equity
        max_penalty_var = lp.LpVariable(f"MaxPenalty_{i}", 0)
        for m in members:
            member_total_expr = lp.lpSum([w * v for w, v in member_penalties[m.id]])
            prob += max_penalty_var >= member_total_expr

        prob += lp.lpSum(solver_objective_terms) + (100.0 * max_penalty_var)

        # --- SOLVE ---
        prob.solve(lp.PULP_CBC_CMD(msg=0))

        # G. Save Results
        if lp.LpStatus[prob.status] == "Optimal":
            assignment_map = {}
            metric_data = {}
            total_candidate_penalty = 0.0

            for (m_id, d_id, s_id), var in X.items():
                if var.varValue and var.varValue > 0.5:
                    assignment_map[f"{d_id}_{s_id}"] = m_id

            for m in members:
                individual_penalty = 0.0
                # 🟢 FIX: Use lp.value() instead of .varValue
                # This works for both Variables (is_gap) and Expressions (excess + shortage)
                for weight_val, var_or_expr in member_penalties[m.id]:
                    val = lp.value(var_or_expr)
                    if val and val > 0.01:
                        individual_penalty += weight_val * val

                total_candidate_penalty += individual_penalty

                assigned_count = sum(1 for k, v in assignment_map.items() if v == m.id)
                assigned_points = sum(
                    day_weight_map[int(k.split("_")[0])]
                    for k, v in assignment_map.items()
                    if v == m.id
                )

                metric_data[m.person.name] = {
                    "member_id": m.id,
                    "goat_points": round(individual_penalty, 2),
                    "assigned": assigned_count,
                    "points": round(assigned_points, 2),
                    "quota_target": round(quota_targets.get(m.id, 0), 2),
                    "group_priority": round(get_member_priority(m), 2),
                }

            cand = ScheduleCandidate(
                schedule_id=schedule_id,
                run_id=run_id,
                score=round(total_candidate_penalty, 2),
                assignments_data=assignment_map,
                metrics_data=metric_data,
            )
            db.session.add(cand)
            generated_candidates.append(cand)
        db.session.commit()
        percent_complete = int(((i + 1) / num_candidates) * 100)
        yield json.dumps(
            {
                "type": "progress",
                "percent": percent_complete,
                "message": f"Generated Option {i+1} of {num_candidates}",
            }
        ) + "\n"

    yield json.dumps(
        {"type": "complete", "run_id": run_id, "count": len(generated_candidates)}
    ) + "\n"


from app.utils.optimization_service import run_schedule_optimization


@pytest.fixture
def opt_env(session):
    """
    Sets up a minimal optimization environment:
    - 1 Schedule (Jan 2026)
    - 2 Days (Jan 1 = Lookback, Jan 2 = Active)
    - 1 Station (OOD)
    - 2 People (Person A, Person B) - Both Qualified
    """
    # 1. Master Data
    g = Group(name="TestGroup", priority=1)
    stn = MasterStation(name="OOD", abbr="OOD")
    p1 = Person(name="Person A", group=g)
    p2 = Person(name="Person B", group=g)
    session.add_all([g, stn, p1, p2])
    session.flush()

    # 2. Qualifications (Both qualified for OOD)
    session.add(PersonQualification(person_id=p1.id, station_id=stn.id))
    session.add(PersonQualification(person_id=p2.id, station_id=stn.id))

    # 3. Schedule
    sch = Schedule(
        name="Test Schedule", start_date=date(2026, 1, 2), end_date=date(2026, 1, 2)
    )
    session.add(sch)
    session.flush()

    # 4. Schedule Station
    sch_stn = ScheduleStation(schedule_id=sch.id, station_id=stn.id)
    session.add(sch_stn)

    # 5. Memberships
    m1 = ScheduleMembership(schedule_id=sch.id, person_id=p1.id, group_id=g.id)
    m2 = ScheduleMembership(schedule_id=sch.id, person_id=p2.id, group_id=g.id)
    session.add_all([m1, m2])
    session.flush()

    # 6. Days
    # Day 1: Lookback (Jan 1)
    d1 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 1), is_lookback=True)
    # Day 2: Active (Jan 2)
    d2 = ScheduleDay(schedule_id=sch.id, date=date(2026, 1, 2), is_lookback=False)
    session.add_all([d1, d2])
    session.commit()

    return {
        "schedule": sch,
        "days": [d1, d2],
        "members": [m1, m2],
        "people": [p1, p2],
        "station": stn,
        "sch_station": sch_stn,
    }


def test_hard_constraint_qualification(session, opt_env):
    """
    Verify that an unqualified person is NEVER assigned.
    """
    # 1. Disqualify Person A
    db.session.query(PersonQualification).filter_by(
        person_id=opt_env["people"][0].id
    ).delete()
    db.session.commit()
    # 🟢 Clear cache so solver sees the qualification is gone
    session.expire_all()

    # 2. Run Solver
    list(run_schedule_optimization(opt_env["schedule"].id, num_candidates=1))

    # 3. Check Results
    candidate = session.scalars(select(ScheduleCandidate)).first()
    assert candidate is not None

    # Active Day (Jan 2)
    active_day_id = opt_env["days"][1].id
    station_id = opt_env["station"].id

    assigned_member_id = candidate.assignments_data.get(f"{active_day_id}_{station_id}")

    # Should be Person B (m2), NOT Person A (m1)
    assert assigned_member_id == opt_env["members"][1].id


def test_lookback_continuity(session, opt_env):
    """
    Verify that work done on a LOOKBACK day prevents work on the first Active day.
    """
    # 1. Assign Person A to the Lookback Day (Jan 1)
    lookback_assign = Assignment(
        schedule_id=opt_env["schedule"].id,
        day_id=opt_env["days"][0].id,  # Jan 1
        station_id=opt_env["station"].id,
        membership_id=opt_env["members"][0].id,  # Person A
        is_locked=True,
    )
    session.add(lookback_assign)
    session.commit()
    session.expire_all()

    # 2. Run Solver for Active Day (Jan 2)
    list(run_schedule_optimization(opt_env["schedule"].id, num_candidates=1))

    # 3. Verify Person A is NOT assigned to Jan 2
    candidate = session.scalars(select(ScheduleCandidate)).first()
    active_day_id = opt_env["days"][1].id
    station_id = opt_env["station"].id
    assigned_member_id = candidate.assignments_data.get(f"{active_day_id}_{station_id}")

    # Should be Person B
    assert assigned_member_id == opt_env["members"][1].id


def test_infeasible_schedule_reporting(session, opt_env):
    """
    Verify that the solver correctly identifies and reports an infeasible day.
    """
    target_date = date(2026, 1, 2)

    # 1. Put BOTH people on leave for Jan 2 using ScheduleLeave
    l1 = ScheduleLeave(
        membership_id=opt_env["members"][0].id,
        start_date=target_date,
        end_date=target_date,
    )
    l2 = ScheduleLeave(
        membership_id=opt_env["members"][1].id,
        start_date=target_date,
        end_date=target_date,
    )
    session.add_all([l1, l2])
    session.commit()

    # 🟢 CRITICAL: Clear cache so the solver re-fetches the memberships with leaves
    session.expire_all()

    # 🔍 PARANOID CHECK: Verify DB state before Solver runs
    # This block ensures the test environment is actually correct.
    from sqlalchemy.orm import joinedload

    check_members = (
        session.query(ScheduleMembership)
        .options(joinedload(ScheduleMembership.leaves))
        .all()
    )
    leave_count = sum(len(m.leaves) for m in check_members)

    assert (
        leave_count >= 2
    ), "SETUP ERROR: Leaves were not saved to the database correctly!"

    # 2. Run Solver and capture output
    generator = run_schedule_optimization(opt_env["schedule"].id, num_candidates=1)

    results = []
    for chunk in generator:
        if chunk.strip():
            results.append(json.loads(chunk))

    # 3. Verify Error Message
    # We expect a message of type "error" containing "Infeasible"
    error_response = next((r for r in results if r.get("type") == "error"), None)

    assert (
        error_response is not None
    ), "Solver failed to detect infeasibility (Pre-Flight Check passed unexpectedly)"
    assert "Infeasible" in error_response["message"]
    assert "2026-01-02" in error_response["message"]

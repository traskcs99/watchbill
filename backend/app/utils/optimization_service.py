import pulp as lp
import random
import uuid
import json
from datetime import timedelta
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from ..database import db
from ..models import (
    Schedule,
    ScheduleCandidate,
    ScheduleDay,
    ScheduleMembership,
    Assignment,
    ScheduleStation,
    Group,
    Person,
    MasterStation,
)
from .quota_calculator import calculate_schedule_quotas


def run_schedule_optimization(schedule_id: int, num_candidates: int = 5):
    """
    Generates schedule candidates.
    ENFORCES HARD CONSTRAINTS:
    - Qualifications (Member must be qualified for Station)
    - Leaves (Member must not be on leave on Day)
    - Lookback Continuity (Respects work done in the lookback period)
    """

    # 1. CLEANUP
    yield json.dumps(
        {"type": "progress", "percent": 0, "message": "Clearing previous data..."}
    ) + "\n"

    db.session.execute(
        delete(ScheduleCandidate).where(ScheduleCandidate.schedule_id == schedule_id)
    )
    db.session.commit()

    # 2. FETCH DATA
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        yield json.dumps({"type": "error", "message": "Schedule not found"}) + "\n"
        return

    yield json.dumps(
        {"type": "progress", "percent": 5, "message": "Analyzing Constraints..."}
    ) + "\n"

    all_stations = db.session.query(MasterStation).all()
    station_name_map = {s.id: s.name for s in all_stations}

    # Fetch Days
    stmt_days = (
        select(ScheduleDay)
        .filter_by(schedule_id=schedule_id)
        .order_by(ScheduleDay.date)
    )
    days = db.session.scalars(stmt_days).all()
    active_days = [d for d in days if not d.is_lookback]

    # Create a set of Active Day IDs for O(1) filtering later
    active_day_ids = {d.id for d in active_days}

    # Fetch Members
    stmt_members = (
        select(ScheduleMembership)
        .filter_by(schedule_id=schedule_id)
        .options(
            joinedload(ScheduleMembership.person), joinedload(ScheduleMembership.leaves)
        )
    )
    members = db.session.scalars(stmt_members).unique().all()

    # Fetch Locks
    stmt_locks = select(Assignment).filter_by(schedule_id=schedule_id, is_locked=True)
    locked_assignments = db.session.scalars(stmt_locks).all()
    locked_map = {(a.day_id, a.station_id): a.membership_id for a in locked_assignments}

    # FETCH HISTORY (Assignments including Lookback)
    stmt_history = (
        select(Assignment)
        .join(ScheduleDay)
        .filter(Assignment.schedule_id == schedule_id)
        .filter(Assignment.membership_id.is_not(None))
        .options(joinedload(Assignment.day))
    )
    history_records = db.session.scalars(stmt_history).all()
    history_work_map = {(a.membership_id, a.day.date) for a in history_records}

    stations = schedule.required_stations

    # --- SENSITIVITY & CONFIG ---
    schedule_group_weights = {
        str(k): float(v) for k, v in (schedule.group_weights or {}).items()
    }

    def get_member_priority(member) -> float:
        group_id = member.person.group_id if member.person else None
        if group_id and str(group_id) in schedule_group_weights:
            return schedule_group_weights[str(group_id)]
        return 1.0

    quota_targets = calculate_schedule_quotas(schedule_id)
    day_weight_map = {d.id: float(d.weight) for d in active_days}

    # --- VALIDITY CHECK (The "Hard Constraints") ---
    valid_shifts = set()

    def is_member_on_leave(member, date_obj):
        for l in member.leaves:
            if l.start_date <= date_obj <= l.end_date:
                return True
        return False

    for m in members:
        # Lazy load qualifications safely
        qualified_station_ids = {int(q.station_id) for q in m.person.qualifications}

        for d in active_days:
            if is_member_on_leave(m, d.date):
                continue

            for s in stations:
                if int(s.station_id) not in qualified_station_ids:
                    continue

                valid_shifts.add((m.id, d.id, s.id))

    # Force Locks
    for (l_day_id, l_station_id), l_member_id in locked_map.items():
        if l_member_id is not None:
            valid_shifts.add((l_member_id, l_day_id, l_station_id))

    # Pre-Flight Check
    unfillable_slots = []
    for d in active_days:
        for s in stations:
            has_coverage = any((m.id, d.id, s.id) in valid_shifts for m in members)
            if not has_coverage:
                st_name = station_name_map.get(s.station_id, f"Station {s.station_id}")
                unfillable_slots.append((d, s, st_name))

    if unfillable_slots:
        bad_day, bad_station, bad_st_name = unfillable_slots[0]
        error_msg = f"Infeasible! No one can work {bad_day.date} ({bad_st_name})."
        yield json.dumps({"type": "error", "message": error_msg}) + "\n"
        return

    # --- LONG WEEKEND LOGIC ---
    weekend_groups = []
    sorted_active_days = sorted(active_days, key=lambda x: x.date)

    def is_weekend_part(d):
        return d.date.weekday() in [5, 6] or getattr(d, "is_holiday", False)

    potential_indices = [
        i for i, d in enumerate(sorted_active_days) if is_weekend_part(d)
    ]
    if potential_indices:
        current_cluster = [sorted_active_days[potential_indices[0]]]
        for i in range(1, len(potential_indices)):
            prev = potential_indices[i - 1]
            curr = potential_indices[i]
            if (
                sorted_active_days[curr].date - sorted_active_days[prev].date
            ).days == 1:
                current_cluster.append(sorted_active_days[curr])
            else:
                weekend_groups.append(current_cluster)
                current_cluster = [sorted_active_days[curr]]
        if current_cluster:
            weekend_groups.append(current_cluster)

    final_weekend_groups = [
        g for g in weekend_groups if any(d.date.weekday() in [5, 6] for d in g)
    ]

    run_id = str(uuid.uuid4())
    generated_candidates = []

    # --- OPTIMIZATION LOOP ---
    for i in range(num_candidates):

        percent = int(((i) / num_candidates) * 100) + 10
        yield json.dumps(
            {
                "type": "progress",
                "percent": percent,
                "message": f"Solving Iteration {i+1}...",
            }
        ) + "\n"

        var_factor = 1.0 if i == 0 else random.uniform(0.85, 1.15)
        sw_quota = (schedule.weight_quota_deviation or 1.0) * var_factor
        sw_goal = (schedule.weight_goal_deviation or 0.5) * var_factor
        sw_spacing1 = (schedule.weight_spacing_1_day or 1.5) * var_factor
        sw_spacing2 = (schedule.weight_spacing_2_day or 1.0) * var_factor
        sw_same_weekend = (schedule.weight_same_weekend or 1.0) * var_factor
        sw_consecutive = (schedule.weight_consecutive_weekends or 1.5) * var_factor

        prob = lp.LpProblem(f"Run_{run_id}_{i}", lp.LpMinimize)

        # Variables
        X = {}
        for m_id, d_id, s_id in valid_shifts:
            X[(m_id, d_id, s_id)] = lp.LpVariable(
                f"x_{m_id}_{d_id}_{s_id}_{i}", 0, 1, lp.LpBinary
            )

        member_penalties = {m.id: [] for m in members}
        solver_objective_terms = []

        # --- HARD CONSTRAINTS ---

        # 1. Locks
        for (l_day, l_station), l_member in locked_map.items():
            if (l_member, l_day, l_station) in X:
                prob += X[(l_member, l_day, l_station)] == 1

        # 2. Shift Coverage
        for day in active_days:
            for station in stations:
                available_vars = [
                    X[(m.id, day.id, station.id)]
                    for m in members
                    if (m.id, day.id, station.id) in X
                ]
                prob += lp.lpSum(available_vars) == 1

        # 3. One Shift Per Day
        for m in members:
            for day in active_days:
                daily_vars = [
                    X[(m.id, day.id, s.id)]
                    for s in stations
                    if (m.id, day.id, s.id) in X
                ]
                if daily_vars:
                    prob += lp.lpSum(daily_vars) <= 1

        # 4. No Back-To-Back (Active Days)
        sorted_d_ids = [d.id for d in sorted_active_days]
        for m in members:
            for k in range(len(sorted_d_ids) - 1):
                d_curr = sorted_d_ids[k]
                d_next = sorted_d_ids[k + 1]
                vars_curr = [
                    X[(m.id, d_curr, s.id)]
                    for s in stations
                    if (m.id, d_curr, s.id) in X
                ]
                vars_next = [
                    X[(m.id, d_next, s.id)]
                    for s in stations
                    if (m.id, d_next, s.id) in X
                ]
                if vars_curr and vars_next:
                    prob += lp.lpSum(vars_curr + vars_next) <= 1

        # 4b. No Back-To-Back (Lookback Transition)
        for m in members:
            for day in active_days:
                prev_date = day.date - timedelta(days=1)
                if (m.id, prev_date) in history_work_map:
                    daily_vars = [
                        X[(m.id, day.id, s.id)]
                        for s in stations
                        if (m.id, day.id, s.id) in X
                    ]
                    if daily_vars:
                        prob += lp.lpSum(daily_vars) == 0

        # 5. Min/Max Limits
        for m in members:
            max_limit = m.override_max_assignments or (
                m.person.group.max_assignments if m.person.group else 999
            )
            min_limit = m.override_min_assignments or (
                m.person.group.min_assignments if m.person.group else 0
            )
            total_vars = [
                X[(m.id, d.id, s.id)]
                for d in active_days
                for s in stations
                if (m.id, d.id, s.id) in X
            ]
            if total_vars:
                prob += lp.lpSum(total_vars) <= max_limit
                prob += lp.lpSum(total_vars) >= min_limit

        # --- SOFT CONSTRAINTS ---

        # 1. Quota
        for m in members:
            m_vars = [
                (X[(m.id, d.id, s.id)], day_weight_map.get(d.id, 1.0))
                for d in active_days
                for s in stations
                if (m.id, d.id, s.id) in X
            ]
            actual_points = lp.lpSum([v * w for v, w in m_vars])
            target = quota_targets.get(m.id, 0.0)

            excess = lp.LpVariable(f"exc_{m.id}_{i}", 0)
            shortage = lp.LpVariable(f"sht_{m.id}_{i}", 0)

            prob += actual_points - target == excess - shortage

            prio = get_member_priority(m)

            # Asymmetric weights (Excess is 2x worse)
            cost_shortage = shortage * (sw_quota) * prio
            cost_excess = excess * (sw_quota * 2.0) * prio

            solver_objective_terms.append(cost_shortage + cost_excess)

            member_penalties[m.id].append(
                {"w": sw_quota * prio, "v": shortage, "r": "Quota Deviation"}
            )
            member_penalties[m.id].append(
                {"w": sw_quota * 2.0 * prio, "v": excess, "r": "Quota (Over)"}
            )

        # 2. Spacing (1 Day)
        for m in members:
            for k in range(len(sorted_d_ids) - 2):
                d1 = sorted_d_ids[k]
                d3 = sorted_d_ids[k + 2]
                vars_d1 = [
                    X[(m.id, d1, s.id)] for s in stations if (m.id, d1, s.id) in X
                ]
                vars_d3 = [
                    X[(m.id, d3, s.id)] for s in stations if (m.id, d3, s.id) in X
                ]
                if vars_d1 and vars_d3:
                    is_gap = lp.LpVariable(f"g1_{m.id}_{d1}_{i}", 0, 1, lp.LpBinary)
                    prob += is_gap >= lp.lpSum(vars_d1 + vars_d3) - 1
                    prio = get_member_priority(m)
                    solver_objective_terms.append(is_gap * sw_spacing1 * prio)
                    member_penalties[m.id].append(
                        {"w": sw_spacing1 * prio, "v": is_gap, "r": "1-Day Spacing"}
                    )
            # Lookback spacing
            for day in active_days:
                date_minus_2 = day.date - timedelta(days=2)
                if (m.id, date_minus_2) in history_work_map:
                    vars_today = [
                        X[(m.id, day.id, s.id)]
                        for s in stations
                        if (m.id, day.id, s.id) in X
                    ]
                    if vars_today:
                        prio = get_member_priority(m)
                        term = lp.lpSum(vars_today) * sw_spacing1 * prio
                        solver_objective_terms.append(term)
                        member_penalties[m.id].append(
                            {
                                "w": sw_spacing1 * prio,
                                "v": lp.lpSum(vars_today),
                                "r": "1-Day Spacing (Lookback)",
                            }
                        )

        # 3. Spacing (2 Day)
        for m in members:
            if len(sorted_d_ids) >= 4:
                for k in range(len(sorted_d_ids) - 3):
                    d1 = sorted_d_ids[k]
                    d4 = sorted_d_ids[k + 3]
                    vars_d1 = [
                        X[(m.id, d1, s.id)] for s in stations if (m.id, d1, s.id) in X
                    ]
                    vars_d4 = [
                        X[(m.id, d4, s.id)] for s in stations if (m.id, d4, s.id) in X
                    ]
                    if vars_d1 and vars_d4:
                        is_gap2 = lp.LpVariable(
                            f"g2_{m.id}_{d1}_{i}", 0, 1, lp.LpBinary
                        )
                        prob += is_gap2 >= lp.lpSum(vars_d1 + vars_d4) - 1
                        prio = get_member_priority(m)
                        solver_objective_terms.append(is_gap2 * sw_spacing2 * prio)
                        member_penalties[m.id].append(
                            {
                                "w": sw_spacing2 * prio,
                                "v": is_gap2,
                                "r": "2-Day Spacing",
                            }
                        )

        # 4. Long Weekends
        worked_weekend_vars = {m.id: [] for m in members}
        for idx, w_days in enumerate(final_weekend_groups):
            for m in members:
                w_vars = [
                    X[(m.id, d.id, s.id)]
                    for d in w_days
                    for s in stations
                    if (m.id, d.id, s.id) in X
                ]
                if not w_vars:
                    worked_weekend_vars[m.id].append(0)
                    continue
                work_sum = lp.lpSum(w_vars)
                prio = get_member_priority(m)
                if len(w_days) > 1:
                    is_same_weekend = lp.LpVariable(
                        f"swk_{m.id}_{idx}_{i}", 0, 1, lp.LpBinary
                    )
                    prob += is_same_weekend >= work_sum - 1
                    solver_objective_terms.append(
                        is_same_weekend * sw_same_weekend * prio
                    )
                    member_penalties[m.id].append(
                        {
                            "w": sw_same_weekend * prio,
                            "v": is_same_weekend,
                            "r": "Same Weekend",
                        }
                    )
                is_worked = lp.LpVariable(f"wwk_{m.id}_{idx}_{i}", 0, 1, lp.LpBinary)
                prob += is_worked >= work_sum * (1.0 / len(w_days))
                worked_weekend_vars[m.id].append(is_worked)

        # 5. Consecutive Weekends
        for m in members:
            w_vars = worked_weekend_vars[m.id]
            for k in range(len(w_vars) - 1):
                v1 = w_vars[k]
                v2 = w_vars[k + 1]
                if isinstance(v1, int) and v1 == 0:
                    continue
                if isinstance(v2, int) and v2 == 0:
                    continue
                is_cons = lp.LpVariable(f"cwk_{m.id}_{k}_{i}", 0, 1, lp.LpBinary)
                prob += is_cons >= v1 + v2 - 1
                prio = get_member_priority(m)
                solver_objective_terms.append(is_cons * sw_consecutive * prio)
                member_penalties[m.id].append(
                    {
                        "w": sw_consecutive * prio,
                        "v": is_cons,
                        "r": "Consecutive Weekends",
                    }
                )

        # 6. STATION GOAL (BALANCE) PENALTY
        for m in members:
            all_m_vars = [var for (m_id, d_id, s_id), var in X.items() if m_id == m.id]

            if not all_m_vars:
                continue

            total_shifts_var = lp.lpSum(all_m_vars)

            raw_weights = m.station_weights or []
            weight_map = {}
            for w in raw_weights:
                if hasattr(w, "station_id") and hasattr(w, "weight"):
                    weight_map[int(w.station_id)] = float(w.weight)
                elif isinstance(w, dict):
                    weight_map[int(w.get("station_id"))] = float(w.get("weight", 0))

            q_ids = {int(q.station_id) for q in m.person.qualifications}

            total_config_weight = 0.0
            target_weights = {}

            for s in stations:
                if int(s.station_id) in q_ids:
                    w_val = weight_map.get(int(s.station_id), 1.0)
                    total_config_weight += w_val
                    target_weights[int(s.station_id)] = w_val

            if total_config_weight <= 0:
                continue

            for s in stations:
                if int(s.station_id) not in q_ids:
                    continue

                target_ratio = target_weights[int(s.station_id)] / total_config_weight

                station_vars = [
                    var
                    for (m_id, d_id, s_id), var in X.items()
                    if m_id == m.id and s_id == s.station_id
                ]
                actual_station_count = lp.lpSum(station_vars)

                diff_expr = actual_station_count - (total_shifts_var * target_ratio)
                pos_dev = lp.LpVariable(f"sdev_{m.id}_{s.station_id}_{i}", 0)

                prob += pos_dev >= diff_expr
                prob += pos_dev >= -diff_expr

                prio = get_member_priority(m)

                solver_objective_terms.append(pos_dev * sw_goal * prio)
                member_penalties[m.id].append(
                    {
                        "w": sw_goal * prio,
                        "v": pos_dev,
                        "r": "goal_deviation",
                    }
                )

        # F. Minimax Equity
        max_penalty = lp.LpVariable(f"MaxPen_{i}", 0)
        for m in members:
            if member_penalties[m.id]:
                m_total = lp.lpSum(
                    [item["w"] * item["v"] for item in member_penalties[m.id]]
                )
                prob += max_penalty >= m_total

        prob += lp.lpSum(solver_objective_terms) + (100.0 * max_penalty)

        # --- SOLVE ---
        # Scale time: 2s -> 5s -> 10s -> 15s -> 20s
        dynamic_time = int(2 + (i * 4.5))

        # Scale precision: 5% -> 4% -> 3% -> 1% -> 0%
        dynamic_gap = max(0.0, 0.05 - (i * 0.012))

        # Update the progress message to let the user know this one is thinking harder
        yield json.dumps(
            {
                "type": "progress",
                "percent": percent,
                "message": f"Solving Iteration {i+1} (Targeting {int(dynamic_gap*100)}% gap)...",
            }
        ) + "\n"

        # Solve with the dynamic limits
        prob.solve(lp.PULP_CBC_CMD(msg=0, timeLimit=dynamic_time, gapRel=dynamic_gap))

        # --- SAVE ---
        is_valid = (prob.status == lp.LpStatusOptimal) or (
            lp.value(prob.objective) is not None
            and prob.status != lp.LpStatusInfeasible
        )

        if is_valid:
            assignment_map = {}
            metric_data = {}
            total_pen = 0.0

            for (m_id, d_id, s_id), var in X.items():
                if var.varValue and var.varValue > 0.5:
                    assignment_map[f"{d_id}_{s_id}"] = m_id

            for m in members:
                pen_breakdown = {}
                indiv_pen = 0.0

                for item in member_penalties[m.id]:
                    val = lp.value(item["v"])
                    if val and val > 0.01:
                        points = val * item["w"]
                        indiv_pen += points
                        reason = item["r"]
                        pen_breakdown[reason] = pen_breakdown.get(reason, 0) + points

                pen_breakdown = {k: round(v, 2) for k, v in pen_breakdown.items()}
                total_pen += indiv_pen

                # Filter Assignments (Exclude Lookback from count)
                assigned_ids = [
                    k
                    for k, v in assignment_map.items()
                    if v == m.id and int(k.split("_")[0]) in active_day_ids
                ]

                # Count only Active Days
                assigned_count = len(assigned_ids)

                # Sum Points only for Active Days
                points = sum(
                    day_weight_map.get(int(k.split("_")[0]), 0.0) for k in assigned_ids
                )

                metric_data[m.person.name] = {
                    "member_id": m.id,
                    "goat_points": round(indiv_pen, 2),
                    "breakdown": pen_breakdown,
                    "assigned": assigned_count,
                    "points": round(points, 2),
                    "quota_target": round(quota_targets.get(m.id, 0), 2),
                    "group_priority": round(get_member_priority(m), 2),
                }

            cand = ScheduleCandidate(
                schedule_id=schedule_id,
                run_id=run_id,
                score=round(total_pen, 2),
                assignments_data=assignment_map,
                metrics_data=metric_data,
            )
            db.session.add(cand)
            generated_candidates.append(cand)

            db.session.commit()

            # 🟢 FORCE FLUSH with whitespace padding
            padding = " " * 4096

            yield json.dumps(
                {
                    "type": "candidate",
                    "candidate": {
                        "id": cand.id,
                        "run_id": cand.run_id,
                        "score": cand.score,
                        "assignments_data": cand.assignments_data,
                        "metrics_data": cand.metrics_data,
                        "created_at": str(cand.created_at) if cand.created_at else None,
                    },
                    "message": f"Found Option {i+1} (Score: {cand.score})",
                }
            ) + padding + "\n"

    yield json.dumps(
        {"type": "complete", "run_id": run_id, "count": len(generated_candidates)}
    ) + "\n"

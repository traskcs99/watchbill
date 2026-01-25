/**
 * Calculates Availability for a SPECIFIC SLOT.
 * 1. Supply = Sum of weights of people qualified for THIS station.
 * 2. Demand = Phantom Load from Neighbors (D-1, D+1) + Today's other assignments.
 */
export function calculateSlotAvailability(
    targetStationId, // The ID of the station we are looking at (e.g., 1 for SDO)
    currentDay,
    allDays,
    memberships,
    allAssignments,
    allExclusions,
    requiredStations // The list of ALL stations [SDO, EDO]
) {
    if (!currentDay || !allDays) return 0;

    const dayIndex = allDays.findIndex(d => d.id === currentDay.id);
    const prevDay = allDays[dayIndex - 1];
    const nextDay = allDays[dayIndex + 1];

    // 1. Supply: (No changes here - correct)
    const qualifiedPeople = memberships.filter(m => {
        const isQual = m.qualifications?.some(q => {
            const qId = typeof q === 'object' ? q.station_id : q;
            return Number(qId) === Number(targetStationId);
        });
        if (!isQual) return false;

        const onLeave = currentDay.leaves?.some(l => Number(l.membership_id) === Number(m.id));
        const excluded = allExclusions.some(e =>
            Number(e.day_id) === Number(currentDay.id) &&
            Number(e.membership_id) === Number(m.id)
        );
        return !onLeave && !excluded;
    });

    let rawSupply = qualifiedPeople.reduce((sum, m) => sum + (m.weight || 1.0), 0);

    // 2. Neighbor Demand (CRITICAL FIX)
    const getLoad = (day) => {
        if (!day) return 0;

        // 🟢 FIX: Filter requiredStations to only count THIS station type
        // If we are looking at SDO (ID 1), we only count the SDO requirement (1 slot).
        // We ignore EDO (ID 2).
        const relevantRequiredCount = requiredStations.filter(st =>
            Number(st.station_id) === Number(targetStationId)
        ).length;

        // 🟢 FIX: Filter assignments to only count THIS station type
        const relevantAssignCount = allAssignments.filter(a =>
            a.day_id === day.id &&
            a.membership_id &&
            Number(a.station_id) === Number(targetStationId)
        ).length;

        // The cost is the Max(Required, Assigned).
        // e.g. If SDO requires 1 slot, cost is 1.0.
        return Math.max(relevantRequiredCount, relevantAssignCount) * 1.0;
    };

    const prevLoad = getLoad(prevDay);
    const nextLoad = getLoad(nextDay);

    // 3. Today's Competition (CRITICAL FIX)
    // Only count OTHER assignments if they are for the SAME station type 
    // (e.g. if SDO requires 2 people, and 1 is filled, that consumes 1 SDO person).
    // Assignments to EDO do NOT consume SDO people.
    const todayOthers = allAssignments.filter(a =>
        a.day_id === currentDay.id &&
        a.membership_id &&
        Number(a.station_id) === Number(targetStationId) && // 🟢 Must match station
        // Note: We don't filter out "self" here because we are calculating POOL availability.
        // If 1 slot is filled, the remaining pool is smaller for the 2nd slot.
        // But usually this function is called for a specific *unassigned* slot context.
        // Let's stick to the standard "Other slots filled today" logic:
        true
    ).length;

    // Wait, simpler logic for "todayOthers": 
    // We essentially want: "How many people of THIS type are already working today?"
    const peopleWorkingTodaySameStation = allAssignments.filter(a =>
        a.day_id === currentDay.id &&
        a.membership_id &&
        Number(a.station_id) === Number(targetStationId)
    ).length;

    // 4. Result
    // Supply - Yesterday's Load - Tomorrow's Load - Today's Load
    let effective = rawSupply - prevLoad - nextLoad - peopleWorkingTodaySameStation;

    return Math.max(0, effective);
}
import React from 'react';
import {
    Box, Typography, TextField, Switch, Divider, FormControl,
    InputLabel, Select, MenuItem, Checkbox, Tooltip
} from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';

/**
 * Calculates Availability for a SPECIFIC SLOT.
 * 1. Supply = Sum of weights of people qualified for THIS station.
 * 2. Demand = Phantom Load from Neighbors (D-1, D+1) + Today's other assignments.
 */
function calculateSlotAvailability(
    targetStationId,
    currentDay,
    allDays,
    memberships,
    allAssignments, // <--- GLOBAL HISTORY
    exclusions,
    requiredStations
) {
    if (!currentDay || !allDays) return 0;

    const dayIndex = allDays.findIndex(d => d.id === currentDay.id);
    const prevDay = allDays[dayIndex - 1];
    const nextDay = allDays[dayIndex + 1];

    // 1. RAW SUPPLY: Qualified People Present Today
    const qualifiedPeople = memberships.filter(m => {
        // A. Qualification Check
        const qualEntry = m.qualifications?.find(q => {
            const qId = typeof q === 'object' ? q.station_id : q;
            return Number(qId) === Number(targetStationId);
        });
        if (!qualEntry) return false;

        // B. Leave & Exclusion Check
        const onLeave = currentDay.leaves?.some(l => Number(l.membership_id) === Number(m.id));
        const excluded = exclusions.some(e =>
            Number(e.day_id) === Number(currentDay.id) &&
            Number(e.membership_id) === Number(m.id)
        );

        return !onLeave && !excluded;
    });

    // Sum weights
    let rawSupply = qualifiedPeople.reduce((sum, m) => {
        let weight = m.weight || 1.0;
        const qual = m.qualifications?.find(q => {
            const qId = typeof q === 'object' ? q.station_id : q;
            return Number(qId) === Number(targetStationId);
        });
        if (qual && typeof qual === 'object' && qual.weight) {
            weight = qual.weight;
        }
        return sum + weight;
    }, 0);

    // 2. PHANTOM DEMAND (Neighbor Days)
    const getNeighborLoad = (neighborDay) => {
        if (!neighborDay) return 0;
        // Use Global Assignments to find neighbor load
        const neighborAssigns = allAssignments ? allAssignments.filter(a => a.day_id === neighborDay.id && a.membership_id) : [];
        const requiredSlots = requiredStations ? requiredStations.length : 0;

        // Cost: 1 Slot = 1.0 Load Cost
        return Math.max(requiredSlots, neighborAssigns.length) * 1.0;
    };

    const prevLoad = getNeighborLoad(prevDay);
    const nextLoad = getNeighborLoad(nextDay);

    // 3. TODAY'S COMPETITION (Other slots filled today)
    const otherAssignmentsToday = allAssignments ? allAssignments.filter(a =>
        a.day_id === currentDay.id &&
        a.membership_id &&
        Number(a.station_id) !== Number(targetStationId)
    ).length : 0;

    // 4. RESULT
    let effective = rawSupply - prevLoad - nextLoad - otherAssignmentsToday;
    return Math.max(0, effective);
}

export default function DayDetailView({
    day,
    days,              // <--- PASSED FROM PARENT
    allAssignments,    // <--- PASSED FROM PARENT (New Prop)
    requiredStations,
    assignments,       // (Filtered list for dropdowns)
    memberships,
    exclusions,
    onUpdateDay,
    onAssign,
    onToggleExclusion
}) {
    // MODIFICATION: Allow editing on historical days
    if (!day) return <Typography color="text.disabled" variant="body2">Select a day to begin.</Typography>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 1. HEADER */}
            <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                        {day.is_lookback ? 'HISTORICAL DAY' : 'DAY LABEL'}
                    </Typography>
                    {day.is_lookback && (
                        <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 900 }}>
                            EDITABLE
                        </Typography>
                    )}
                </Box>
                <TextField
                    fullWidth
                    variant="standard"
                    slotProps={{ input: { style: { fontSize: '1rem', fontWeight: 600 } } }}
                    value={day.name || ''}
                    onChange={(e) => onUpdateDay(day.id, { name: e.target.value })}
                />
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>HOLIDAY</Typography>
                    <Switch size="small" checked={day.is_holiday} onChange={(e) => onUpdateDay(day.id, { is_holiday: e.target.checked })} />
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>WEIGHT</Typography>
                    <TextField
                        type="number" variant="standard" sx={{ width: 40 }}
                        value={day.weight} onChange={(e) => onUpdateDay(day.id, { weight: parseFloat(e.target.value) })}
                    />
                </Box>
            </Box>

            <Divider />

            {/* 2. STATION ASSIGNMENTS */}
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>STATION ASSIGNMENTS</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {requiredStations.map(st => {
                    // Find assignment in the filtered list (or global fallback)
                    const currentAssign = (assignments || []).find(a => Number(a.station_id) === Number(st.station_id));

                    // --- CALCULATE AVAILABILITY HERE ---
                    const slotAvailability = calculateSlotAvailability(
                        st.station_id,
                        day,
                        days,
                        memberships,
                        allAssignments, // <--- Using the global list
                        exclusions,
                        requiredStations
                    );

                    // Color Logic
                    let capColor = 'text.secondary';
                    if (slotAvailability <= 0.5) capColor = 'error.main';
                    else if (slotAvailability < 1.5) capColor = 'warning.main';
                    else capColor = 'success.main';

                    return (
                        <FormControl key={st.id} fullWidth size="small">
                            {/* Label + Gauge */}
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.2}>
                                <InputLabel sx={{ fontSize: '0.75rem', position: 'relative', transform: 'none', color: 'text.secondary' }}>
                                    {st.abbr}
                                </InputLabel>
                                {!day.is_lookback && (
                                    <Tooltip title="Net Availability (Supply - Neighbor Demand)">
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                            <SpeedIcon sx={{ fontSize: '0.8rem', color: capColor }} />
                                            <Typography variant="caption" sx={{ fontWeight: 800, color: capColor, fontSize: '0.7rem' }}>
                                                {slotAvailability.toFixed(2)}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                )}
                            </Box>

                            <Select
                                sx={{
                                    fontSize: '0.85rem', height: '38px',
                                    bgcolor: day.is_lookback ? 'action.hover' : 'transparent'
                                }}
                                value={currentAssign?.membership_id || ""}
                                onChange={(e) => onAssign(day.id, st.station_id, e.target.value)}
                                displayEmpty
                                renderValue={(selected) => {
                                    if (!selected) {
                                        return (
                                            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                                Unassigned (Pool: {slotAvailability.toFixed(1)})
                                            </Typography>
                                        );
                                    }
                                    const mem = memberships.find(m => m.id === selected);
                                    return mem ? (mem.name || mem.person_name) : 'Unknown';
                                }}
                            >
                                <MenuItem value=""><em>Unassigned</em></MenuItem>
                                {memberships
                                    .filter(m => {
                                        // Qual Check
                                        const isQual = m.qualifications?.some(q => {
                                            const qId = typeof q === 'object' ? q.station_id : q;
                                            return Number(qId) === Number(st.station_id);
                                        });
                                        // Leave Check
                                        const onLeave = day.leaves?.some(l => Number(l.membership_id) === Number(m.id));
                                        return isQual && !onLeave;
                                    })
                                    .map(m => {
                                        // Exclusion Check
                                        const isEx = exclusions.some(e =>
                                            Number(e.day_id) === Number(day.id) &&
                                            Number(e.membership_id) === Number(m.id)
                                        );
                                        return (
                                            <MenuItem key={m.id} value={m.id}>
                                                <Typography sx={{
                                                    fontSize: '0.85rem',
                                                    textDecoration: isEx ? 'line-through' : 'none',
                                                    color: isEx ? 'error.main' : 'text.primary',
                                                    fontWeight: isEx ? 700 : 400
                                                }}>
                                                    {m.name || m.person_name} {isEx ? '(EX)' : ''}
                                                </Typography>
                                            </MenuItem>
                                        );
                                    })
                                }
                            </Select>
                        </FormControl>
                    );
                })}
            </Box>

            <Divider />

            {/* 3. QUICK EXCLUSIONS GRID */}
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>QUICK EXCLUSIONS</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, maxHeight: 300, overflowY: 'auto' }}>
                {memberships.map(m => {
                    const memberId = m.id;
                    const isEx = exclusions.some(e =>
                        Number(e.day_id) === Number(day.id) &&
                        Number(e.membership_id) === Number(memberId)
                    );
                    const onLeave = day.leaves?.some(l => Number(l.membership_id) === Number(memberId));

                    return (
                        <Box
                            key={m.id}
                            onClick={() => !onLeave && onToggleExclusion(day.id, memberId)}
                            sx={{
                                display: 'flex', alignItems: 'center', p: 0.4, borderRadius: 1,
                                cursor: onLeave ? 'default' : 'pointer',
                                bgcolor: onLeave ? 'action.hover' : 'transparent',
                                opacity: onLeave ? 0.7 : 1,
                                '&:hover': { bgcolor: onLeave ? 'transparent' : '#f5f5f5' }
                            }}
                        >
                            <Checkbox
                                size="small"
                                checked={Boolean(isEx || onLeave)}
                                disabled={onLeave}
                                sx={{ p: 0 }}
                            />
                            <Typography sx={{
                                fontSize: '0.8rem',
                                color: (isEx || onLeave) ? 'text.disabled' : 'text.primary',
                                fontWeight: (isEx || onLeave) ? 700 : 400,
                                display: 'flex', alignItems: 'center', gap: 0.5
                            }}>
                                <Box component="span" sx={{ textDecoration: (isEx || onLeave) ? 'line-through' : 'none' }}>
                                    {m.name || m.person_name}
                                </Box>
                                {onLeave && (
                                    <Box component="span" sx={{ fontSize: '0.65rem', color: 'warning.main', fontWeight: 900 }}>
                                        (LEAVE)
                                    </Box>
                                )}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
import React, { useEffect, useState, useMemo } from 'react';
import {
    Box, Card, CardActionArea, Typography, Grid, LinearProgress, Stack
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; // 🟢 NEW
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // 🟢 NEW

// Helper for consistent colors
const getStationColor = (abbr) => {
    const colors = {
        'SDO': '#1976d2', // Blue
        'EDO': '#2e7d32', // Green
        'OOD': '#ed6c02', // Orange
        'CDO': '#9c27b0', // Purple
        'SADO': '#d32f2f' // Red
    };
    return colors[abbr] || '#757575';
};

export default function WorkloadTab({
    scheduleId,
    memberships,
    assignments,
    days,
    stations,
    onToggleHighlight,
    highlightedMemberId
}) {
    const [quotas, setQuotas] = useState({});

    // 1. Fetch Quotas
    // 🟢 UPDATE: Added 'memberships' dependency so quota recalculates when config changes
    useEffect(() => {
        if (!scheduleId) return;
        fetch(`/api/schedules/${scheduleId}/quotas`)
            .then(res => res.json())
            .then(setQuotas)
            .catch(console.error);
    }, [scheduleId, memberships]);

    // 2. Heavy Lifting: Calculate ALL Metrics
    const { workloadData, summaryMetrics, stationMetrics } = useMemo(() => {
        const dayInfo = {};
        let totalPossiblePoints = 0;

        // A. Analyze Days
        days.forEach(d => {
            const w = parseFloat(d.weight || 1.0);
            const isLookback = d.is_lookback || d.isLookback || false;
            dayInfo[d.id] = { weight: w, isLookback };

            if (!isLookback) {
                totalPossiblePoints += (w * stations.length);
            }
        });

        // B. Initialize Station Metrics
        const stationStats = {};
        stations.forEach(s => {
            const name = s.abbr || s.name;
            stationStats[s.id] = {
                name,
                actual: 0,
                target: 0,
                color: getStationColor(name)
            };
        });

        Object.values(dayInfo).forEach(d => {
            if (!d.isLookback) {
                Object.keys(stationStats).forEach(sId => {
                    stationStats[sId].target += d.weight;
                });
            }
        });

        // C. Initialize Member Data
        const memberMap = {};
        memberships.forEach(m => {
            memberMap[m.id] = {
                member: m,
                actualPoints: 0,
                assignmentCount: 0,
                stationBreakdown: {}
            };
        });

        // D. Process Assignments
        let totalFilledPoints = 0;

        assignments.forEach(a => {
            const day = dayInfo[a.day_id];
            if (!day || day.isLookback) return;
            if (!a.membership_id) return;

            const weight = day.weight;

            if (memberMap[a.membership_id]) {
                const m = memberMap[a.membership_id];
                const sName = stationStats[a.station_id]?.name || 'UNK';

                m.actualPoints += weight;
                m.assignmentCount += 1;
                m.stationBreakdown[sName] = (m.stationBreakdown[sName] || 0) + 1;
            }

            totalFilledPoints += weight;
            if (stationStats[a.station_id]) {
                stationStats[a.station_id].actual += weight;
            }
        });

        return {
            workloadData: Object.values(memberMap).sort((a, b) => b.actualPoints - a.actualPoints),
            summaryMetrics: {
                actual: totalFilledPoints,
                target: totalPossiblePoints,
                percent: totalPossiblePoints ? (totalFilledPoints / totalPossiblePoints) * 100 : 0
            },
            stationMetrics: Object.values(stationStats)
        };
    }, [assignments, memberships, days, stations, quotas]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* --- SECTION 1: HEADER DASHBOARD --- */}
            <Box sx={{
                p: 2, mb: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e0e0e0',
                position: 'sticky', top: 0, zIndex: 10, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)'
            }}>
                <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">TOTAL SCHEDULE PROGRESS</Typography>
                        <Typography variant="caption" fontWeight="bold">
                            {summaryMetrics.actual.toFixed(1)} / {summaryMetrics.target.toFixed(1)} Pts
                        </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={summaryMetrics.percent} sx={{ height: 10, borderRadius: 5, bgcolor: '#eee' }} />
                </Box>
                <Grid container spacing={2}>
                    {stationMetrics.map(stat => (
                        <Grid item xs={6} md={4} key={stat.name}>
                            <Box display="flex" justifyContent="space-between" mb={0.2}>
                                <Typography variant="caption" fontWeight="bold" sx={{ color: stat.color }}>{stat.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{stat.actual.toFixed(1)}/{stat.target.toFixed(1)}</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={stat.target ? (stat.actual / stat.target) * 100 : 0} sx={{ height: 6, borderRadius: 3, bgcolor: '#f5f5f5', '& .MuiLinearProgress-bar': { bgcolor: stat.color } }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* --- SECTION 2: MEMBER CARDS --- */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                <Grid container spacing={1}>
                    {workloadData.map((data) => {
                        const { member, actualPoints, stationBreakdown, assignmentCount } = data;
                        const quota = quotas[member.id] || 0;
                        const progressPercent = quota > 0 ? (actualPoints / quota) * 100 : 0;

                        // 🟢 1. CALCULATE LIMITS (Override > Default > Fallback)
                        // Note: Depending on your API, these might be named differently (e.g., override_min_assignments)
                        // This logic assumes your 'member' object structure from the Config Tab is consistent here.
                        // If 'overrides' object exists, use it. Otherwise check direct props or group defaults.
                        const min = member.override_min_assignments ?? member.group_defaults?.min_assignments ?? 0;
                        const max = member.override_max_assignments ?? member.group_defaults?.max_assignments ?? 999;

                        // 🟢 2. VALIDATION CHECKS
                        const isUnder = assignmentCount < min;
                        const isOver = assignmentCount > max;
                        const isSelected = highlightedMemberId === member.id;

                        // 🟢 3. COLOR LOGIC
                        let borderColor = 'divider';
                        let cardBg = 'white';
                        let progressBarColor = 'primary';

                        if (isSelected) {
                            borderColor = 'primary.main';
                            cardBg = 'primary.50';
                        } else if (isOver) {
                            borderColor = 'error.main'; // Red Border
                            cardBg = '#fff5f5'; // Light Red BG
                            progressBarColor = 'error';
                        } else if (isUnder) {
                            borderColor = 'warning.main'; // Orange Border
                            cardBg = '#fffde7'; // Light Orange/Yellow BG
                            progressBarColor = 'warning';
                        } else if (progressPercent >= 100) {
                            progressBarColor = 'success';
                        } else if (progressPercent < 80) {
                            progressBarColor = 'warning';
                        }

                        return (
                            <Grid item xs={6} key={member.id}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: '100%',
                                        borderColor: borderColor,
                                        bgcolor: cardBg,
                                        // Thicker border if there is an issue or selected
                                        borderWidth: (isSelected || isOver || isUnder) ? 2 : 1,
                                        transform: isSelected ? 'scale(1.02)' : 'none',
                                        transition: 'all 0.2s',
                                        boxShadow: isSelected ? 3 : 0
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() => onToggleHighlight && onToggleHighlight(member.id)}
                                        sx={{
                                            height: '100%',
                                            p: 1.5,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'stretch',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="body2" fontWeight="bold" noWrap title={member.person_name} sx={{ maxWidth: '60%' }}>
                                                {member.person_name}
                                            </Typography>
                                            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                                                {actualPoints.toFixed(1)} / {quota}
                                            </Typography>
                                        </Box>

                                        {/* 🟢 4. WARNING TEXT */}
                                        {(isOver || isUnder) && (
                                            <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                                                {isOver ? <ErrorOutlineIcon color="error" sx={{ fontSize: 14 }} /> : <WarningAmberIcon color="warning" sx={{ fontSize: 14 }} />}
                                                <Typography variant="caption" color={isOver ? "error" : "warning.dark"} fontWeight="bold">
                                                    {isOver ? `Over Max (${max})` : `Under Min (${min})`}
                                                </Typography>
                                            </Box>
                                        )}

                                        <LinearProgress
                                            variant="determinate"
                                            value={Math.min(progressPercent, 100)}
                                            color={progressBarColor}
                                            sx={{ height: 6, borderRadius: 3, mb: 1, bgcolor: '#e0e0e0', width: '100%' }}
                                        />

                                        <Stack direction="row" spacing={0.5} overflow="hidden">
                                            {Object.entries(stationBreakdown).map(([st, count]) => (
                                                <Box key={st} component="span" sx={{ fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.05)', px: 0.5, borderRadius: 1, color: getStationColor(st), fontWeight: 'bold', border: '1px solid rgba(0,0,0,0.1)' }}>
                                                    {st}:{count}
                                                </Box>
                                            ))}
                                        </Stack>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
        </Box>
    );
}
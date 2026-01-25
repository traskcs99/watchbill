import React, { useEffect, useState, useMemo } from 'react';
import {
    Box, Card, CardContent, Typography, Grid, LinearProgress, Tooltip, Stack
} from '@mui/material';

// Helper for consistent colors
const getStationColor = (abbr) => {
    const colors = {
        'SDO': '#1976d2', // Blue
        'JDO': '#2e7d32', // Green
        'OOD': '#ed6c02', // Orange
        'CDO': '#9c27b0', // Purple
        'SADO': '#d32f2f' // Red
    };
    return colors[abbr] || '#757575';
};

export default function WorkloadTab({ scheduleId, memberships, assignments, days, stations }) {
    const [quotas, setQuotas] = useState({});

    // 1. Fetch Quotas
    useEffect(() => {
        if (!scheduleId) return;
        fetch(`/api/schedules/${scheduleId}/quotas`)
            .then(res => res.json())
            .then(setQuotas)
            .catch(console.error);
    }, [scheduleId]);

    // 2. Heavy Lifting: Calculate ALL Metrics in one pass
    const { workloadData, summaryMetrics, stationMetrics } = useMemo(() => {
        const dayInfo = {};
        let totalPossiblePoints = 0;

        // A. Analyze Days & Calculate Total Demand (Denominator)
        days.forEach(d => {
            const w = parseFloat(d.weight || 1.0);
            const isLookback = d.is_lookback || d.isLookback || false;
            dayInfo[d.id] = { weight: w, isLookback };

            if (!isLookback) {
                // Total Points needed = Days * Stations per day * Weight
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

        // Calculate Station Targets based on Day Weights
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

        // D. Process Assignments (Actuals)
        let totalFilledPoints = 0;

        assignments.forEach(a => {
            const day = dayInfo[a.day_id];

            // SKIP if day not found or is lookback
            if (!day || day.isLookback) return;

            // 🟢 CRITICAL FIX: Only count if someone is actually assigned!
            if (!a.membership_id) return;

            const weight = day.weight;

            // 1. Update Member Stats
            if (memberMap[a.membership_id]) {
                const m = memberMap[a.membership_id];
                const sName = stationStats[a.station_id]?.name || 'UNK';

                m.actualPoints += weight;
                m.assignmentCount += 1;
                m.stationBreakdown[sName] = (m.stationBreakdown[sName] || 0) + 1;
            }

            // 2. Update Global Stats
            totalFilledPoints += weight;

            // 3. Update Station Stats
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

            {/* --- SECTION 1: HEADER DASHBOARD (Sticky) --- */}
            <Box sx={{
                p: 2,
                mb: 2,
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0px 4px 10px rgba(0,0,0,0.05)'
            }}>
                {/* Total Progress */}
                <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">TOTAL SCHEDULE PROGRESS</Typography>
                        <Typography variant="caption" fontWeight="bold">
                            {summaryMetrics.actual.toFixed(1)} / {summaryMetrics.target.toFixed(1)} Pts
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={summaryMetrics.percent}
                        sx={{ height: 10, borderRadius: 5, bgcolor: '#eee' }}
                    />
                </Box>

                {/* Per-Station Breakdown */}
                <Grid container spacing={2}>
                    {stationMetrics.map(stat => (
                        <Grid item xs={6} md={4} key={stat.name}>
                            <Box display="flex" justifyContent="space-between" mb={0.2}>
                                <Typography variant="caption" fontWeight="bold" sx={{ color: stat.color }}>{stat.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {stat.actual.toFixed(1)}/{stat.target.toFixed(1)}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={stat.target ? (stat.actual / stat.target) * 100 : 0}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: '#f5f5f5',
                                    '& .MuiLinearProgress-bar': { bgcolor: stat.color }
                                }}
                            />
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* --- SECTION 2: COMPACT MEMBER CARDS --- */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                <Grid container spacing={1}>
                    {workloadData.map((data) => {
                        const { member, actualPoints, stationBreakdown } = data;
                        const quota = quotas[member.id] || 0;
                        const progressPercent = quota > 0 ? (actualPoints / quota) * 100 : 0;

                        // Status Color Logic
                        let barColor = 'primary';
                        if (progressPercent > 100) barColor = 'error';
                        else if (progressPercent < 80) barColor = 'warning';
                        else barColor = 'success';

                        return (
                            <Grid item xs={6} key={member.id}>
                                <Card variant="outlined" sx={{
                                    height: '100%',
                                    p: 1.5,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}>
                                    {/* Top Row: Name Left, Score Right */}
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography
                                            variant="body2"
                                            fontWeight="bold"
                                            noWrap
                                            title={member.person_name}
                                            sx={{ maxWidth: '65%' }}
                                        >
                                            {member.person_name}
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary">
                                            {actualPoints.toFixed(1)} / {quota}
                                        </Typography>
                                    </Box>

                                    {/* Progress Bar */}
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(progressPercent, 100)}
                                        color={barColor}
                                        sx={{ height: 6, borderRadius: 3, mb: 1, bgcolor: '#f0f0f0' }}
                                    />

                                    {/* Micro Station Legend */}
                                    <Stack direction="row" spacing={0.5} overflow="hidden">
                                        {Object.entries(stationBreakdown).map(([st, count]) => (
                                            <Box
                                                key={st}
                                                component="span"
                                                sx={{
                                                    fontSize: '0.65rem',
                                                    bgcolor: '#f5f5f5',
                                                    px: 0.5,
                                                    borderRadius: 1,
                                                    color: getStationColor(st),
                                                    fontWeight: 'bold',
                                                    border: '1px solid #eee'
                                                }}
                                            >
                                                {st}:{count}
                                            </Box>
                                        ))}
                                    </Stack>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
        </Box>
    );
}
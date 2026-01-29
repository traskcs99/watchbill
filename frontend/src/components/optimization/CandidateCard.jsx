import React, { useMemo } from 'react';
import {
    Card, CardContent, Typography, Box, Button,
    Table, TableBody, TableCell, TableHead, TableRow,
    Chip, Divider, Tooltip, Zoom
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';

// 🟢 1. PENALTY LABEL MAPPING
const PENALTY_LABELS = {
    "goal_deviation": "Station Goals", // <--- This is the one for Station Weights
    "quota_deviation": "Shift Quota",
    "spacing": "Spacing Violation",
    "consecutive_work": "Consecutive Days",
    "same_day": "Double Watch",
    "pattern": "Pattern Mismatch"
};

export default function CandidateCard({
    candidate,
    isBest,
    isApplied,
    masterStations = [],
    memberships = [],
    onApply,
    onToggleHighlight
}) {

    // Sort metrics
    const rows = Object.entries(candidate.metrics_data || {})
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => (b.goat_points || 0) - (a.goat_points || 0));

    // 1. ANALYZE ACTUAL BREAKDOWN
    const assignmentBreakdown = useMemo(() => {
        const data = {};
        if (!candidate.assignments_data) return data;

        Object.entries(candidate.assignments_data).forEach(([key, memberId]) => {
            const stationId = key.split('_')[1];
            const st = masterStations.find(s => String(s.id) === String(stationId));
            const stName = st ? st.abbr : `Stn ${stationId}`;

            if (!data[memberId]) data[memberId] = { total: 0, stations: {} };

            data[memberId].total += 1;
            data[memberId].stations[stName] = (data[memberId].stations[stName] || 0) + 1;
        });
        return data;
    }, [candidate.assignments_data, masterStations]);

    // 2. HELPER: Get Weight Config Details
    const getWeightDetails = (memberId, stationName) => {
        // Force String comparison
        const member = memberships.find(m => String(m.id) === String(memberId));
        if (!member) return { goalPct: 0, rawWeight: 0 };

        // 1. Find Station ID
        const station = masterStations.find(s => s.abbr === stationName);
        if (!station) return { goalPct: 0, rawWeight: 0 };
        const stationId = station.id;

        // 2. Parse Weights
        const rawWeights = member.station_weights || [];
        let weightMap = {};
        if (Array.isArray(rawWeights)) {
            rawWeights.forEach(w => {
                if (w.station_id !== undefined && w.weight !== undefined) {
                    weightMap[Number(w.station_id)] = Number(w.weight);
                }
            });
        }

        // 3. Calculate Totals
        let qualIds = [];
        if (Array.isArray(member.qualifications)) {
            qualIds = member.qualifications.map(q => (typeof q === 'object' && q !== null) ? Number(q.station_id) : Number(q));
        }

        let totalWeight = 0;
        let targetWeight = 0;

        masterStations.forEach(mst => {
            if (qualIds.includes(mst.id)) {
                // Default to 1.0 if not found
                const w = weightMap[mst.id] !== undefined ? weightMap[mst.id] : 1.0;
                totalWeight += w;
                if (mst.id === stationId) targetWeight = w;
            }
        });

        const goalPct = totalWeight > 0 ? Math.round((targetWeight / totalWeight) * 100) : 0;

        return {
            goalPct,
            rawWeight: weightMap[stationId] !== undefined ? weightMap[stationId] : 1.0
        };
    };

    return (
        <Card
            variant="outlined"
            sx={{
                width: '100%',
                minWidth: 0,
                flexShrink: 0,
                border: isApplied ? '2px solid #2e7d32' : (isBest ? '2px solid #1976d2' : '1px solid #ddd'),
                bgcolor: isApplied ? '#f1f8e9' : 'white',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
                boxShadow: isApplied ? '0 4px 12px rgba(46, 125, 50, 0.2)' : 'none'
            }}
        >
            {isApplied ? (
                <Chip
                    label="Displayed"
                    color="success"
                    icon={<VisibilityIcon style={{ fontSize: 14 }} />}
                    size="small"
                    sx={{ position: 'absolute', top: 10, right: 10, fontSize: '0.7rem', height: 20, fontWeight: 'bold' }}
                />
            ) : isBest ? (
                <Chip
                    label="Best"
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 10, right: 10, fontSize: '0.7rem', height: 20 }}
                />
            ) : null}

            <CardContent sx={{ flexGrow: 1, p: 1.5, '&:last-child': { pb: 2 } }}>
                <Box mb={1} pr={4}>
                    <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                        Score: {Number(candidate.score || 0).toFixed(0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        ID: {candidate.run_id ? candidate.run_id.substring(0, 6) : 'N/A'}
                    </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                    <Table size="small" stickyHeader padding="none">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontSize: '0.65rem', py: 0.5, pl: 0.5, width: '55px', lineHeight: 1 }}>Name</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.65rem', py: 0.5, lineHeight: 1 }}>Shifts</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.65rem', py: 0.5, fontWeight: 'bold', lineHeight: 1 }}>WA</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.65rem', py: 0.5, lineHeight: 1 }}>Quota</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.65rem', py: 0.5, color: 'text.secondary', lineHeight: 1 }}>Pen</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => {
                                const stats = assignmentBreakdown[row.member_id] || { total: 0, stations: {} };

                                // BREAKDOWN TOOLTIP (Shifts)
                                const breakdownTooltip = (
                                    <Box sx={{ p: 0.5, minWidth: 180 }}>
                                        <Typography variant="caption" fontWeight="bold" display="block" sx={{ borderBottom: '1px solid rgba(255,255,255,0.2)', mb: 0.5 }}>
                                            Actual vs Goal
                                        </Typography>
                                        {Object.entries(stats.stations).map(([stName, count]) => {
                                            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                                            const { goalPct, rawWeight } = getWeightDetails(row.member_id, stName);
                                            const diff = pct - goalPct;
                                            const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
                                            const color = Math.abs(diff) > 15 ? '#ffcc80' : 'inherit';

                                            return (
                                                <Box key={stName} display="flex" justifyContent="space-between" gap={2} sx={{ mb: 0.5 }}>
                                                    <Typography variant="caption">{stName}:</Typography>
                                                    <Box textAlign="right">
                                                        <Typography variant="caption" fontWeight="bold" display="block">
                                                            {count} ({pct}%)
                                                        </Typography>
                                                        <Typography variant="caption" color={color} sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
                                                            Goal: {goalPct}% (Wt: {rawWeight})
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                        {stats.total === 0 && <Typography variant="caption">No shifts</Typography>}
                                    </Box>
                                );

                                // 🟢 2. PENALTY TOOLTIP (Updated)
                                const penaltyTooltip = (
                                    <Box sx={{ p: 0.5, minWidth: 140 }}>
                                        <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5, borderBottom: '1px solid #fff' }}>
                                            Penalty Breakdown
                                        </Typography>
                                        {row.breakdown && Object.keys(row.breakdown).length > 0 ? (
                                            Object.entries(row.breakdown).map(([reason, pts]) => {
                                                // Map backend key to nice name
                                                const label = PENALTY_LABELS[reason] || reason;
                                                // Highlight "Station Goal" penalty
                                                const isGoalPenalty = reason === 'goal_deviation';

                                                return (
                                                    <Box key={reason} display="flex" justifyContent="space-between" gap={2} sx={{ mb: 0.2 }}>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: isGoalPenalty ? '#ffcc80' : 'inherit', // Orange for Goal
                                                                fontWeight: isGoalPenalty ? 'bold' : 'normal'
                                                            }}
                                                        >
                                                            {label}:
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            fontWeight="bold"
                                                            sx={{ color: isGoalPenalty ? '#ffcc80' : 'inherit' }}
                                                        >
                                                            {pts}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })
                                        ) : (
                                            <Typography variant="caption" fontStyle="italic">No penalties</Typography>
                                        )}
                                    </Box>
                                );

                                return (
                                    <TableRow
                                        key={row.name}
                                        hover
                                        onClick={() => onToggleHighlight && onToggleHighlight(row.member_id)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell component="th" scope="row" sx={{ fontSize: '0.7rem', py: 0.5, pl: 0.5, maxWidth: '55px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: (row.goat_points || 0) > 10 ? 'bold' : 'normal', color: (row.goat_points || 0) > 10 ? 'error.main' : 'text.primary' }}>
                                            <Tooltip title={row.name} placement="top-start">
                                                <span>{row.name.split(" ").pop()}</span>
                                            </Tooltip>
                                        </TableCell>

                                        <TableCell align="center" sx={{ fontSize: '0.7rem' }}>
                                            <Tooltip title={breakdownTooltip} arrow placement="left" TransitionComponent={Zoom}>
                                                <span style={{ cursor: 'help', textDecoration: 'underline dotted', textDecorationColor: '#ccc' }}>
                                                    {row.assigned}
                                                </span>
                                            </Tooltip>
                                        </TableCell>

                                        <TableCell align="center" sx={{ fontSize: '0.7rem', fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                                            {Number(row.points || 0).toFixed(1)}
                                        </TableCell>

                                        <TableCell align="center" sx={{ fontSize: '0.7rem' }}>
                                            {Number(row.quota_target || 0).toFixed(1)}
                                        </TableCell>

                                        <TableCell align="center" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                            <Tooltip title={penaltyTooltip} arrow TransitionComponent={Zoom} placement="left">
                                                <span style={{ cursor: 'help' }}>
                                                    {Number(row.goat_points || 0).toFixed(0)}
                                                </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Box>
            </CardContent>

            <Box sx={{ p: 1.5, pt: 0 }}>
                <Button
                    variant={isApplied ? "contained" : (isBest ? "contained" : "outlined")}
                    color={isApplied ? "success" : "primary"}
                    fullWidth
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onApply(candidate.id);
                    }}
                    startIcon={isApplied ? <CheckIcon /> : <CheckCircleIcon />}
                    disabled={isApplied}
                >
                    {isApplied ? "Displayed" : "Apply Schedule"}
                </Button>
            </Box>
        </Card>
    );
}
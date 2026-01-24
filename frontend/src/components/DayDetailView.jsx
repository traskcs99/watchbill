import React from 'react';
import {
    Box, Typography, TextField, Switch, Divider, FormControl,
    InputLabel, Select, MenuItem, Checkbox
} from '@mui/material';

export default function DayDetailView({
    day,
    requiredStations,
    assignments,
    memberships,
    exclusions,
    onUpdateDay,
    onAssign,
    onToggleExclusion
}) {
    // 🟢 MODIFICATION: Removed the guard clause that returned null for lookback days.
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
                    <Switch
                        size="small"
                        checked={day.is_holiday}
                        onChange={(e) => onUpdateDay(day.id, { is_holiday: e.target.checked })}
                    />
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>WEIGHT</Typography>
                    <TextField
                        type="number" variant="standard" sx={{ width: 40 }}
                        value={day.weight}
                        onChange={(e) => onUpdateDay(day.id, { weight: parseFloat(e.target.value) })}
                    />
                </Box>
            </Box>

            <Divider />

            {/* 2. STATION ASSIGNMENTS */}
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>STATION ASSIGNMENTS</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {requiredStations.map(st => {
                    const currentAssign = assignments.find(a => Number(a.station_id) === Number(st.station_id));

                    return (
                        <FormControl key={st.id} fullWidth size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>{st.abbr}</InputLabel>
                            <Select
                                label={st.abbr}
                                sx={{
                                    fontSize: '0.85rem',
                                    height: '38px',
                                    // 🟢 Added a subtle background color for lookback days to signal historical mode
                                    bgcolor: day.is_lookback ? 'action.hover' : 'transparent'
                                }}
                                value={currentAssign?.membership_id || ""}
                                onChange={(e) => onAssign(day.id, st.station_id, e.target.value)}
                            >
                                <MenuItem value=""><em>Unassigned</em></MenuItem>
                                {memberships
                                    .filter(m => {
                                        const isQual = m.qualifications?.some(q => Number(q.station_id || q) === Number(st.station_id));
                                        const onLeave = day.leaves?.some(l => Number(l.membership_id) === Number(m.id));
                                        return isQual && !onLeave;
                                    })
                                    .map(m => {
                                        const isEx = Array.isArray(exclusions) && exclusions.some(e =>
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
                    const isEx = Array.isArray(exclusions) && exclusions.some(e =>
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
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                            }}>
                                <Box component="span" sx={{
                                    textDecoration: (isEx || onLeave) ? 'line-through' : 'none'
                                }}>
                                    {m.name || m.person_name}
                                </Box>
                                {onLeave && (
                                    <Box component="span" sx={{
                                        fontSize: '0.65rem',
                                        color: 'text.disabled',
                                        fontWeight: 900,
                                        textDecoration: 'none'
                                    }}>
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
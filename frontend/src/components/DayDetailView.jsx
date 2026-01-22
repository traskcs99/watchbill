import React from 'react';
import {
    Box, Typography, TextField, Switch, Divider, FormControl,
    InputLabel, Select, MenuItem, Chip, List, ListItem,
    ListItemButton, Checkbox, ListItemText
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
    if (!day) return <Typography color="text.disabled">Select a day to begin.</Typography>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* 1. NAME & METADATA */}
            <TextField
                label="Day Name/Label"
                fullWidth
                size="small"
                value={day.name || ''}
                onChange={(e) => onUpdateDay(day.id, { name: e.target.value })}
            />

            <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={700}>Holiday</Typography>
                    <Switch
                        checked={day.is_holiday}
                        onChange={(e) => onUpdateDay(day.id, { is_holiday: e.target.checked })}
                    />
                </Box>
                <TextField
                    label="Weight"
                    type="number"
                    size="small"
                    inputProps={{ step: 0.5, min: 0 }}
                    value={day.weight}
                    onChange={(e) => onUpdateDay(day.id, { weight: parseFloat(e.target.value) })}
                    sx={{ width: 90 }}
                />
            </Box>

            <Divider />

            {/* 2. ASSIGNMENTS */}
            <Typography variant="subtitle2" color="primary" fontWeight={800}>ASSIGNMENTS</Typography>
            {requiredStations.map(st => {
                const assign = assignments.find(a => a.station_id === st.station_id);
                return (
                    <FormControl key={st.id} fullWidth size="small">
                        <InputLabel>{st.abbr} Assignment</InputLabel>
                        <Select
                            label={`${st.abbr} Assignment`}
                            value={assign?.membership_id || ""}
                            onChange={(e) => onAssign(day.id, st.station_id, e.target.value)}
                        >
                            <MenuItem value=""><em>Unassigned</em></MenuItem>
                            {memberships.map(m => (
                                <MenuItem key={m.id} value={m.id}>{m.person_name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );
            })}

            <Divider />

            {/* 3. EXCLUSIONS */}
            <Typography variant="subtitle2" color="primary" fontWeight={800}>DAY EXCLUSIONS</Typography>
            <List dense sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                {memberships.map(m => {
                    const isExcluded = exclusions.some(e => e.membership_id === m.id);
                    return (
                        <ListItem key={m.id} disablePadding>
                            <ListItemButton onClick={() => onToggleExclusion(day.id, m.id)} dense>
                                <Checkbox edge="start" checked={isExcluded} disableRipple />
                                <ListItemText primary={m.person_name} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Box>
    );
}
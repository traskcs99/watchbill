import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Slider, Divider, Tooltip, Button } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';
import SaveIcon from '@mui/icons-material/Save';

export default function OptimizationSettings({ schedule, groups, onSave }) {

    // Local state for smooth sliding (visual update)
    const [localSchedule, setLocalSchedule] = useState(schedule || {});
    const [isDirty, setIsDirty] = useState(false);

    // Sync from parent when schedule changes (e.g. initial load or after save)
    useEffect(() => {
        setLocalSchedule(schedule || {});
        setIsDirty(false);
    }, [schedule]);

    // --- HANDLERS ---

    // 1. VISUAL DRAG (Updates local state & marks as dirty)
    const handleDragGlobal = (key, val) => {
        setLocalSchedule(prev => ({ ...prev, [key]: val }));
        setIsDirty(true);
    };

    const handleDragGroup = (groupId, val) => {
        setLocalSchedule(prev => ({
            ...prev,
            group_weights: {
                ...prev.group_weights,
                [String(groupId)]: val
            }
        }));
        setIsDirty(true);
    };

    // 2. SAVE CLICK (Passes the entire updated object up)
    const handleSaveClick = () => {
        onSave(localSchedule);
        setIsDirty(false);
    };

    // --- CONFIG ---
    const globalSettings = [
        { key: 'weight_quota_deviation', label: 'Fairness (Quota)', def: 1.0, tooltip: "Priority of keeping assignments equal." },
        { key: 'weight_goal_deviation', label: 'Goal Accuracy', def: 0.5, tooltip: "Priority of hitting exact target numbers." },
        { key: 'weight_spacing_1_day', label: '1-Day Spacing', def: 4.0, tooltip: "Heavy penalty for back-to-back shifts." },
        { key: 'weight_spacing_2_day', label: '2-Day Spacing', def: 1.0, tooltip: "Penalty for working with only 1 day off in between." },
        { key: 'weight_same_weekend', label: 'Same Weekend', def: 2.0, tooltip: "Penalty for working multiple days in one weekend." },
        { key: 'weight_consecutive_weekends', label: 'Consec. Wknds', def: 1.5, tooltip: "Penalty for working weekends back-to-back." },
    ];

    // Helper Component with FLEX layout for maximum slider width
    // Removed 'onCommit' since we save manually now
    const SettingRow = ({ label, value, tooltip, onDrag, isGroup }) => (
        <Box display="flex" alignItems="center" sx={{ height: 36, width: '100%' }}>

            {/* LABEL (Fixed 30% width) */}
            <Box sx={{ width: '30%', minWidth: '100px', pr: 1 }}>
                <Tooltip title={tooltip || ""}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'help'
                        }}
                    >
                        {label}
                    </Typography>
                </Tooltip>
            </Box>

            {/* SLIDER (Takes all remaining space) */}
            <Box sx={{ flex: 1, px: 1, display: 'flex', alignItems: 'center' }}>
                <Slider
                    size="small"
                    value={typeof value === 'number' ? value : 1.0}
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    onChange={(_, v) => onDrag(v)}
                    sx={{
                        color: isGroup ? (value > 1.5 ? 'primary.main' : 'grey.400') : 'secondary.main',
                        '& .MuiSlider-thumb': {
                            width: 14,
                            height: 14,
                            transition: '0.2s',
                            '&:hover, &.Mui-focusVisible': {
                                boxShadow: '0 0 0 8px rgba(25, 118, 210, 0.16)'
                            },
                        },
                        '& .MuiSlider-rail': { opacity: 0.3 }
                    }}
                />
            </Box>

            {/* VALUE BADGE (Fixed small width) */}
            <Box sx={{ width: '50px', display: 'flex', justifyContent: 'flex-end' }}>
                <Box
                    sx={{
                        bgcolor: isGroup ? 'primary.50' : 'grey.100',
                        color: isGroup ? 'primary.main' : 'text.primary',
                        borderRadius: 1,
                        py: 0.5,
                        textAlign: 'center',
                        width: '100%'
                    }}
                >
                    <Typography variant="caption" fontWeight="bold">
                        {Number(value || 1.0).toFixed(1)}x
                    </Typography>
                </Box>
            </Box>
        </Box>
    );

    return (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'white' }}>

            {/* 🟢 HEADER WITH SAVE BUTTON */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center">
                    <TuneIcon fontSize="small" color="secondary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        Algorithm Priorities
                    </Typography>
                </Box>
                <Button
                    variant={isDirty ? "contained" : "outlined"}
                    color="primary"
                    size="small"
                    onClick={handleSaveClick}
                    startIcon={<SaveIcon />}
                    disabled={!isDirty} // Only enable if changes exist
                    sx={{ height: 28, textTransform: 'none', fontSize: '0.8rem' }}
                >
                    {isDirty ? "Save Changes" : "Saved"}
                </Button>
            </Box>

            <Box mb={2}>
                {globalSettings.map((s) => (
                    <SettingRow
                        key={s.key}
                        label={s.label}
                        value={localSchedule[s.key] !== undefined ? localSchedule[s.key] : s.def}
                        tooltip={s.tooltip}
                        onDrag={(v) => handleDragGlobal(s.key, v)}
                        isGroup={false}
                    />
                ))}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* SECTION 2: RANK PROTECTION */}
            <Box display="flex" alignItems="center" mb={1}>
                <SecurityIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Rank Protection
                </Typography>
                <Tooltip title="Higher values give this group priority for 'good' schedules.">
                    <InfoIcon fontSize="small" sx={{ ml: 0.5, color: 'text.disabled', width: 14, height: 14 }} />
                </Tooltip>
            </Box>

            <Box>
                {groups.map((group) => {
                    const weights = localSchedule.group_weights || {};
                    const val = weights[String(group.id)] || weights[group.id] || 1.0;

                    return (
                        <SettingRow
                            key={group.id}
                            label={group.name}
                            value={val}
                            tooltip={`Protection factor for ${group.name}`}
                            onDrag={(v) => handleDragGroup(group.id, v)}
                            isGroup={true}
                        />
                    );
                })}
            </Box>
        </Paper>
    );
}
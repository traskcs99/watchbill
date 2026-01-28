import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Slider, Divider, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import TuneIcon from '@mui/icons-material/Tune';
import SecurityIcon from '@mui/icons-material/Security';

export default function OptimizationSettings({ schedule, groups, onSave }) {

    // Local state for smooth sliding (visual update)
    const [localSchedule, setLocalSchedule] = useState(schedule || {});

    // Sync from parent when schedule changes (e.g. initial load)
    useEffect(() => {
        setLocalSchedule(schedule || {});
    }, [schedule]);

    // --- HANDLERS ---

    // 1. VISUAL DRAG (Immediate UI update)
    const handleDragGlobal = (key, val) => {
        setLocalSchedule(prev => ({ ...prev, [key]: val }));
    };

    const handleDragGroup = (groupId, val) => {
        setLocalSchedule(prev => ({
            ...prev,
            group_weights: {
                ...prev.group_weights,
                [String(groupId)]: val
            }
        }));
    };

    // 2. COMMIT (Save to DB on release)
    const handleCommitGlobal = (key, val) => {
        onSave(key, val);
    };

    const handleCommitGroup = (groupId, val) => {
        const currentWeights = localSchedule.group_weights || {};
        const updatedWeights = { ...currentWeights, [String(groupId)]: val };
        onSave('group_weights', updatedWeights);
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
    const SettingRow = ({ label, value, tooltip, onDrag, onCommit, isGroup }) => (
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
                    onChange={(_, v) => onDrag(v)}         // Instant slide
                    onChangeCommitted={(_, v) => onCommit(v)} // Save on drop
                    sx={{
                        color: isGroup ? (value > 1.5 ? 'primary.main' : 'grey.400') : 'secondary.main',
                        '& .MuiSlider-thumb': {
                            width: 14, // Slightly larger hit target
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

            {/* SECTION 1: ALGORITHMS */}
            <Box display="flex" alignItems="center" mb={1}>
                <TuneIcon fontSize="small" color="secondary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Algorithm Priorities
                </Typography>
            </Box>

            <Box mb={2}>
                {globalSettings.map((s) => (
                    <SettingRow
                        key={s.key}
                        label={s.label}
                        value={localSchedule[s.key] !== undefined ? localSchedule[s.key] : s.def}
                        tooltip={s.tooltip}
                        onDrag={(v) => handleDragGlobal(s.key, v)}
                        onCommit={(v) => handleCommitGlobal(s.key, v)}
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
                            onCommit={(v) => handleCommitGroup(group.id, v)}
                            isGroup={true}
                        />
                    );
                })}
            </Box>
        </Paper>
    );
}
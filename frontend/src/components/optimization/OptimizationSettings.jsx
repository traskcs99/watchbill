import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Button, Divider, Slider, Grid } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import GroupWeightTuner from './GroupWeightTuner';

export default function OptimizationSettings({ schedule, groups, onSave }) {
    const [config, setConfig] = useState({
        weight_quota_deviation: 1.0,
        weight_spacing_1_day: 1.5,
        weight_spacing_2_day: 1.0,
        weight_same_weekend: 1.0,
        weight_consecutive_weekends: 1.0,
        weight_goal_deviation: 1.0,
        group_weights: {}
    });

    useEffect(() => {
        if (schedule) {
            setConfig({
                weight_quota_deviation: schedule.weight_quota_deviation ?? 1.0,
                weight_spacing_1_day: schedule.weight_spacing_1_day ?? 1.5,
                weight_spacing_2_day: schedule.weight_spacing_2_day ?? 1.0,
                weight_same_weekend: schedule.weight_same_weekend ?? 1.0,
                weight_consecutive_weekends: schedule.weight_consecutive_weekends ?? 1.0,
                weight_goal_deviation: schedule.weight_goal_deviation ?? 1.0,
                group_weights: schedule.group_weights ?? {}
            });
        }
    }, [schedule]);

    const handleSliderChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleGroupChange = (groupId, value) => {
        setConfig(prev => ({
            ...prev,
            group_weights: { ...prev.group_weights, [String(groupId)]: value }
        }));
    };

    // This helper ensures the label is on top and the bar stretches 100%
    const renderFullWidthSlider = (label, field) => (
        <Box key={field} sx={{ width: '100%', mb: 4 }}>
            {/* Top Row: Label and Value */}
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body1" fontWeight="bold" sx={{ color: '#333' }}>
                    {label}
                </Typography>
                <Typography variant="h6" color="primary" sx={{ fontWeight: '800', fontFamily: 'monospace' }}>
                    {config[field]?.toFixed(1)}
                </Typography>
            </Box>

            {/* Bottom Row: The Bar (now guaranteed to be full width) */}
            <Slider
                value={config[field] || 0}
                min={0}
                max={10}
                step={0.5}
                onChange={(e, val) => handleSliderChange(field, val)}
                sx={{
                    width: '100%',
                    height: 8,
                    '& .MuiSlider-track': { border: 'none' },
                    '& .MuiSlider-thumb': { width: 24, height: 24 }
                }}
            />
        </Box>
    );

    return (
        <Paper sx={{ p: 3, width: '100%', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">Watchbill Strategy</Typography>

            <Box sx={{ width: '100%', mt: 3 }}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 'bold' }}>
                    Global Optimization Weights
                </Typography>
                <Grid container>
                    {renderFullWidthSlider("Fairness (Quota)", "weight_quota_deviation")}
                    {renderFullWidthSlider("Goal Accuracy", "weight_goal_deviation")}
                    {renderFullWidthSlider("1-Day Spacing", "weight_spacing_1_day")}
                    {renderFullWidthSlider("2-Day Spacing", "weight_spacing_2_day")}
                    {renderFullWidthSlider("Same Weekend Penalty", "weight_same_weekend")}
                    {renderFullWidthSlider("Consecutive Weekends Penalty", "weight_consecutive_weekends")}
                </Grid>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 'bold' }}>
                Rank Protection (Seniority)
            </Typography>

            <GroupWeightTuner
                groups={groups}
                groupWeights={config.group_weights}
                onChange={handleGroupChange}
            />

            <Box display="flex" justifyContent="flex-end" sx={{ mt: 4 }}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<SaveIcon />}
                    onClick={() => onSave(config)}
                >
                    Apply Strategy
                </Button>
            </Box>
        </Paper>
    );
}
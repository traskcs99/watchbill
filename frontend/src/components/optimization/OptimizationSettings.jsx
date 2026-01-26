import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, Button, Divider, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import GroupWeightTuner from './GroupWeightTuner';

export default function OptimizationSettings({ schedule, groups, onSave }) {
    const [config, setConfig] = useState({
        weight_quota_deviation: 1.0,
        weight_spacing_1_day: 1.5,
        group_weights: {}
    });

    useEffect(() => {
        if (schedule) {
            setConfig({
                weight_quota_deviation: schedule.weight_quota_deviation ?? 1.0,
                weight_spacing_1_day: schedule.weight_spacing_1_day ?? 1.5,
                group_weights: schedule.group_weights ?? {}
            });
        }
    }, [schedule]);

    const handleGroupChange = (groupId, value) => {
        setConfig(prev => ({
            ...prev,
            group_weights: { ...prev.group_weights, [groupId]: value }
        }));
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Watchbill Strategy</Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
                Adjust these values to change how the solver prioritizes fairness vs seniority.
            </Alert>

            <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                RANK PROTECTION FACTORS
            </Typography>

            <GroupWeightTuner
                groups={groups}
                groupWeights={config.group_weights}
                onChange={handleGroupChange}
            />

            <Divider sx={{ my: 4 }} />

            <Box display="flex" justifyContent="flex-end">
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => onSave(config)}
                >
                    Save Optimization Settings
                </Button>
            </Box>
        </Paper>
    );
}
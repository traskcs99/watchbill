import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Slider,
    Divider
} from '@mui/material';

export default function WeightDistributionDialog({
    open,
    onClose,
    member,
    masterStations,
    onSave
}) {
    // 1. ADD MISSING STATE
    const [localWeights, setLocalWeights] = useState({});

    // 2. ADD INITIALIZATION LOGIC
    useEffect(() => {
        if (open && member) {
            const initial = {};
            const weights = member.station_weights || [];
            const quals = member.qualifications || [];

            // Map existing weights or default to 0 for all qualifications
            quals.forEach(qId => {
                const existing = weights.find(sw => Number(sw.station_id) === Number(qId));
                initial[qId] = existing ? existing.weight : 0.0;
            });
            setLocalWeights(initial);
        }
    }, [open, member]);

    // 3. YOUR SLIDER LOGIC
    const handleSliderChange = (stationId, newValue) => {
        setLocalWeights(prev => {
            const stationIds = Object.keys(prev);
            if (stationIds.length <= 1) return { [stationId]: 1.0 };

            const otherIds = stationIds.filter(id => id !== stationId.toString());
            const remainingPool = Math.max(0, 1.0 - newValue);
            const previousOtherTotal = otherIds.reduce((sum, id) => sum + prev[id], 0);

            const updated = { ...prev, [stationId]: newValue };

            otherIds.forEach(id => {
                if (previousOtherTotal === 0) {
                    updated[id] = remainingPool / otherIds.length;
                } else {
                    const proportion = prev[id] / previousOtherTotal;
                    updated[id] = remainingPool * proportion;
                }
            });

            return updated;
        });
    };

    // 4. ADD THE MISSING RENDER LOGIC
    if (!open || !member) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle component="div">
                <Typography variant="h6" component="div">
                    Weight Distribution
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" component="div">
                    {member?.person_name}
                </Typography>
            </DialogTitle>

            <DialogContent dividers>
                <Typography variant="caption" color="primary" sx={{ mb: 2, display: 'block' }}>
                    Total workload must equal 100%
                </Typography>

                {Object.keys(localWeights).map((stationId) => {
                    const station = masterStations.find(ms => ms.id === Number(stationId));
                    const weightValue = localWeights[stationId];

                    return (
                        <Box key={stationId} sx={{ mb: 3 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight="bold">
                                    {station?.name || `Station ${stationId}`}
                                </Typography>
                                <Typography variant="body2" color="primary">
                                    {Math.round(weightValue * 100)}%
                                </Typography>
                            </Box>
                            <Slider
                                value={weightValue * 100}
                                min={0}
                                max={100}
                                step={5}
                                onChange={(_, val) => handleSliderChange(stationId, val / 100)}
                                disabled={Object.keys(localWeights).length <= 1}
                            />
                        </Box>
                    );
                })}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => onSave(member.id, localWeights)}
                >
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog >
    );
}
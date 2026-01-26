import React from 'react';
import { Box, Typography, Slider, Grid, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function GroupWeightTuner({ groups, groupWeights, onChange }) {
    return (
        <Grid container spacing={3}>
            {groups.map((group) => {
                // Use the schedule override if it exists, otherwise the group default
                const currentValue = groupWeights[group.id] ?? group.seniorityFactor ?? 1.0;

                return (
                    <Grid item xs={12} md={6} key={group.id}>
                        <Box sx={{ px: 1 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight="bold">
                                    {group.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                                    {currentValue}x Protection
                                </Typography>
                            </Box>

                            <Slider
                                value={currentValue}
                                min={1}
                                max={15}
                                step={0.5}
                                onChange={(e, val) => onChange(group.id, val)}
                                valueLabelDisplay="auto"
                                marks={[
                                    { value: 1, label: 'Standard' },
                                    { value: 10, label: 'VIP' }
                                ]}
                            />
                        </Box>
                    </Grid>
                );
            })}
        </Grid>
    );
}
import React from 'react';
import { Box, Typography, Slider } from '@mui/material';

export default function GroupWeightTuner({ groups, groupWeights, onChange }) {
    return (
        <Box sx={{ width: '100%' }}>
            {groups.map((group) => {
                // Determine value: 1. DB override, 2. Group default, 3. Hardcoded 1.0
                const currentValue =
                    (groupWeights[group.id] ?? groupWeights[String(group.id)])
                    ?? group.seniorityFactor
                    ?? 1.0;

                return (
                    <Box key={group.id} sx={{ width: '100%', mb: 4 }}>
                        {/* Top Row: Label and Value */}
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1 }}
                        >
                            <Typography variant="body1" fontWeight="bold" sx={{ color: '#333' }}>
                                {group.name} Protection
                            </Typography>
                            <Typography
                                variant="h6"
                                color="primary"
                                sx={{ fontWeight: '800', fontFamily: 'monospace' }}
                            >
                                {Number(currentValue).toFixed(1)}x
                            </Typography>
                        </Box>

                        {/* Bottom Row: The Full-Width Bar */}
                        <Slider
                            value={Number(currentValue)}
                            min={1}
                            max={15}
                            step={0.5}
                            onChange={(e, val) => onChange(String(group.id), val)}
                            sx={{
                                width: '100%',
                                height: 8,
                                '& .MuiSlider-track': { border: 'none' },
                                '& .MuiSlider-thumb': {
                                    width: 24,
                                    height: 24,
                                    backgroundColor: '#fff',
                                    border: '2px solid currentColor'
                                }
                            }}
                        />
                    </Box>
                );
            })}
        </Box>
    );
}
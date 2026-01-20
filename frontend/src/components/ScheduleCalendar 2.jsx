import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export default function ScheduleCalendar({ days, selectedDay, onSelectDay }) {

    const getPaddingCells = () => {
        if (days.length === 0) return [];
        const firstDate = new Date(days[0].date + "T00:00:00");
        let dayOfWeek = firstDate.getDay();
        const count = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        return Array(count).fill(null);
    };

    return (
        <Box sx={{ flex: 3, overflowY: 'auto' }}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                        <Typography key={h} align="center" variant="caption" fontWeight="bold" color="text.secondary">
                            {h.toUpperCase()}
                        </Typography>
                    ))}
                    {getPaddingCells().map((_, i) => <Box key={`pad-${i}`} sx={{ minHeight: 100 }} />)}
                    {days.map((day) => (
                        <Paper
                            key={day.id}
                            elevation={0}
                            onClick={() => onSelectDay(day)}
                            sx={{
                                minHeight: 110, p: 1, cursor: 'pointer',
                                border: selectedDay?.id === day.id ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                bgcolor: day.is_holiday ? '#fff9c4' : 'white',
                                '&:hover': { bgcolor: '#f0f7ff' }
                            }}
                        >
                            <Typography variant="caption" fontWeight="bold">
                                {new Date(day.date + "T00:00:00").getDate()}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            </Paper>
        </Box>
    );
}
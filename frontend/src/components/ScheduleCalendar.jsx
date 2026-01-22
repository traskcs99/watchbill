import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import ScheduleDayCell from './ScheduleDayCell'; // Import the new cell

export default function ScheduleCalendar({
    days,
    selectedDay,
    onSelectDay,
    requiredStations,
    assignments = [], // New Prop
    leaves = [],     // New Prop
    exclusions = []  // New Prop
}) {

    // Grid Padding Logic (Days of week alignment)
    const getPaddingCells = () => {
        if (days.length === 0) return [];
        const firstDate = new Date(days[0].date + "T00:00:00");
        let dayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon
        // Adjust logic if your week starts on Monday
        const count = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        return Array(count).fill(null);
    };

    return (
        <Box sx={{ flex: 3, overflowY: 'auto', pr: 1 }}>
            <Paper sx={{ p: 2, borderRadius: 2, minHeight: '80vh', bgcolor: '#f8f9fa' }}>
                {/* Header Row */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                        <Typography key={h} align="center" variant="caption" fontWeight="bold" color="text.secondary">
                            {h.toUpperCase()}
                        </Typography>
                    ))}
                </Box>

                {/* Calendar Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                    {getPaddingCells().map((_, i) => <Box key={`pad-${i}`} />)}

                    {days.map((day) => (
                        <Box
                            key={day.id}
                            sx={{
                                // Highlight selected day with a blue ring outside the component
                                outline: selectedDay?.id === day.id ? '2px solid #1976d2' : 'none',
                                borderRadius: 1
                            }}
                        >
                            <ScheduleDayCell
                                day={day}
                                requiredStations={requiredStations}
                                // Filter data relevant to this specific day
                                assignments={assignments.filter(a => a.day_id === day.id)}
                                leaves={day.leaves && day.leaves.length > 0 ? day.leaves : leaves.filter(l =>
                                    new Date(day.date) >= new Date(l.start_date) &&
                                    new Date(day.date) <= new Date(l.end_date)
                                )}
                                exclusions={exclusions.filter(e => e.schedule_day_id === day.id)}
                                onInspect={onSelectDay}
                            />
                        </Box>
                    ))}
                </Box>
            </Paper>
        </Box>
    );
}
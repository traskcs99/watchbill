import React from 'react';
import { Box } from '@mui/material';
import ScheduleDayCell from './ScheduleDayCell';

export default function ScheduleCalendar({
    days,
    selectedDayId,
    onSelectDay,
    assignments,
    leaves,
    exclusions,
    memberships,
    requiredStations,
    alerts,
    highlightedMemberId
}) {
    return (
        <Box sx={{
            flex: 1,
            overflowY: 'auto',
            p: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1
        }}>
            {days.map((day) => (
                <ScheduleDayCell
                    key={day.id}
                    day={day}
                    isSelected={day.id === selectedDayId}

                    // Interaction
                    onInspect={() => onSelectDay(day)}

                    // Data
                    assignments={assignments.filter(a => a.day_id === day.id)}

                    // 🟢 FIX 1: Filter Leaves by Date (assuming leaves_exploded has a date string)
                    // If your leaves logic relies on date strings:
                    leaves={leaves.filter(l => l.date === day.date)}

                    // 🟢 FIX 2: Filter Exclusions by Day ID
                    exclusions={exclusions.filter(e => e.day_id === day.id)}

                    memberships={memberships}
                    requiredStations={requiredStations}

                    // Validation & Highlights
                    dayAlerts={alerts ? alerts.filter(a => a.day_id === day.id) : []}
                    highlightedMemberId={highlightedMemberId}
                />
            ))}
        </Box>
    );
}
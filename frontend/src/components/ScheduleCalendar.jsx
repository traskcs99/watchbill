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
    highlightedMemberId,
    onToggleLock // 🟢 Ensure this is passed down
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

                    // Actions
                    onInspect={() => onSelectDay(day)}
                    onToggleLock={onToggleLock}

                    // Data Slices
                    assignments={assignments.filter(a => a.day_id === day.id)}
                    leaves={leaves.filter(l => l.date === day.date)}
                    exclusions={exclusions.filter(e => e.day_id === day.id)}

                    // Globals
                    memberships={memberships}
                    requiredStations={requiredStations}

                    // Validation
                    dayAlerts={alerts ? alerts.filter(a => a.day_id === day.id) : []}
                    highlightedMemberId={highlightedMemberId}

                    // Pass full arrays for calculator if needed
                    allAssignments={assignments}
                    allExclusions={exclusions}
                    allDays={days}
                />
            ))}
        </Box>
    );
}
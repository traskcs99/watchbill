import React, { useMemo } from 'react';
import ScheduleDayCell from './ScheduleDayCell';
import { Box } from '@mui/material';

export default function ScheduleCalendar({
    days,
    assignments,
    exclusions,
    requiredStations,
    onSelectDay
}) {
    // 1. Group assignments by day_id ONCE
    const assignmentsByDay = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.day_id]) map[a.day_id] = [];
            map[a.day_id].push(a);
        });
        return map;
    }, [assignments]);

    // 2. Group exclusions by day_id ONCE
    const exclusionsByDay = useMemo(() => {
        const map = {};
        exclusions.forEach(e => {
            const dId = e.day_id;
            if (!map[dId]) map[dId] = [];
            map[dId].push(e);
        });
        return map;
    }, [exclusions]);

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            flex: 4
        }}>
            {days.map((day) => (
                <ScheduleDayCell
                    key={day.id}
                    day={day}
                    requiredStations={requiredStations}
                    // Pass the pre-grouped array. If empty, pass static empty array.
                    assignments={assignmentsByDay[day.id] || []}
                    exclusions={exclusionsByDay[day.id] || []}
                    // Since we refactored backend, use day.leaves directly
                    leaves={day.leaves || []}
                    onInspect={onSelectDay}
                />
            ))}
        </Box>
    );
}
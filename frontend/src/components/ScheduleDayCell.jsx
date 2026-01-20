import React from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';

export default function DayCell({
    day,
    requiredStations = [],
    assignments = [],
    leaves = [],
    exclusions = [],
    onInspect
}) {
    const isHoliday = day.is_holiday;

    const glowStyle = isHoliday ? {
        boxShadow: '0 0 10px 2px rgba(255, 215, 0, 0.4)',
        borderColor: '#ffc107',
        backgroundColor: '#fffdf0'
    } : {};

    const getAssignmentForStation = (stationId) => {
        return assignments.find(a => a.station_id === stationId);
    };

    return (
        <Paper
            elevation={isHoliday ? 3 : 1}
            onClick={() => onInspect(day)}
            sx={{
                minHeight: 160,
                p: 1,
                cursor: 'pointer',
                border: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                    bgcolor: '#f0f7ff',
                    borderColor: '#1976d2',
                    transform: 'translateY(-2px)',
                },
                ...glowStyle
            }}
        >
            {/* HEADER: Day Number */}
            <Box display="flex" justifyContent="flex-start">
                <Typography
                    variant="h6"
                    fontWeight="bold"
                    color={isHoliday ? "warning.dark" : "text.primary"}
                >
                    {new Date(day.date + "T00:00:00").getDate()}
                </Typography>
            </Box>

            {/* MIDDLE: Station Rows */}
            <Box sx={{ flexGrow: 1, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {requiredStations.map(st => {
                    const assign = getAssignmentForStation(st.id);
                    return (
                        <Box
                            key={st.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid',
                                borderColor: assign ? '#d1e3f8' : '#f0f0f0',
                                borderRadius: '4px',
                                px: 0.5,
                                py: 0.2
                            }}
                        >
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem' }}>
                                {st.abbr}
                            </Typography>
                            {assign ? (
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#1565c0' }}>
                                    {assign.person_name.split(' ')[0]}
                                </Typography>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                    <Typography sx={{ fontSize: '0.65rem', color: 'success.main', fontWeight: 'bold' }}>
                                        {day.availability_estimate}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>av</Typography>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* STATUS ICONS */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                {leaves.length > 0 && (
                    <Tooltip title={`${leaves.length} on leave`}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5252' }} />
                    </Tooltip>
                )}
                {exclusions.length > 0 && <BlockIcon sx={{ fontSize: 14, color: '#9e9e9e' }} />}
            </Box>

            {/* FOOTER: Holiday Name or Weekday Name */}
            <Box display="flex" justifyContent="space-between" alignItems="center" pt={0.5} borderTop="1px solid #eee">
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: '0.6rem',
                        fontWeight: isHoliday ? 'bold' : 'medium',
                        color: isHoliday ? 'warning.dark' : 'text.secondary',
                        textTransform: 'uppercase'
                    }}
                >
                    {day.name}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                    {day.weight}
                </Typography>
            </Box>
        </Paper>
    );
}
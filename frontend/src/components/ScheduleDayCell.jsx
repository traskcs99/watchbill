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
                minHeight: 180,
                p: 1,
                cursor: 'pointer',
                border: '1px solid #e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                    bgcolor: '#f0f7ff',
                    borderColor: '#1976d2',
                    transform: 'translateY(-2px)',
                },
                ...glowStyle
            }}
        >
            {/* HEADER: Day Number & Clean Badge */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                <Typography
                    sx={{
                        fontSize: '1.1rem', // Scaled down from h5
                        fontWeight: 800,
                        lineHeight: 1,
                        color: isHoliday ? "warning.dark" : "text.primary"
                    }}
                >
                    {new Date(day.date + "T00:00:00").getDate()}
                </Typography>

                {/* Simplified Badge: Number only */}
                <Box sx={{
                    bgcolor: '#e8f5e9',
                    color: '#2e7d32',
                    px: 0.6,
                    py: 0.1,
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    border: '1px solid #81c784',
                    lineHeight: 1
                }}>
                    {day.availability_estimate}
                </Box>
            </Box>

            {/* MIDDLE: Station Rows */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {requiredStations.map(st => {
                    const assign = assignments.find(a => a.station_id === st.station_id);
                    const hasAssignment = !!assign?.assigned_person_name;

                    return (
                        <Box
                            key={st.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between', // Pushes label left, pill right
                                borderBottom: '1px solid #f5f5f5',
                                pb: 0.3
                            }}
                        >
                            {/* Left: Station Abbr */}
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 800,
                                    color: 'text.secondary',
                                    fontSize: '0.65rem',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {st.abbr}:
                            </Typography>

                            {/* Right: The Pill */}
                            <Box
                                sx={{
                                    // Colors: Blue if assigned, Green if showing estimate
                                    bgcolor: hasAssignment ? '#e3f2fd' : '#e8f5e9',
                                    color: hasAssignment ? '#1565c0' : '#2e7d32',
                                    border: '1px solid',
                                    borderColor: hasAssignment ? '#bbdefb' : '#c8e6c9',

                                    borderRadius: '4px',
                                    px: 0.8,
                                    py: 0.1,
                                    minWidth: '45px', // Keeps pills consistent size
                                    textAlign: 'right',
                                    display: 'flex',
                                    justifyContent: 'center'
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        lineHeight: 1.2
                                    }}
                                >
                                    {hasAssignment
                                        ? assign.assigned_person_name.split(' ')[0]
                                        : (assign?.availability_estimate ?? day.availability_estimate)
                                    }
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            {/* LEAVE & EXCLUSIONS SECTION */}
            <Box sx={{ mt: 1, mb: 1 }}>
                {leaves.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'text.secondary' }}>LV:</Typography>
                        {leaves.map((l, i) => (
                            <Box key={i} sx={{
                                bgcolor: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb',
                                borderRadius: '4px', px: 0.5, py: 0.1, fontSize: '0.6rem', fontWeight: 'bold'
                            }}>
                                {l.person_name}
                            </Box>
                        ))}
                    </Box>
                )}
                {exclusions.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'text.secondary' }}>EX:</Typography>
                        <BlockIcon sx={{ fontSize: 14, color: '#9e9e9e' }} />
                    </Box>
                )}
            </Box>

            {/* FOOTER: Fixed Layout */}
            <Box sx={{ borderTop: '1px solid #eee', pt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: '0.6rem',
                        fontWeight: isHoliday ? 800 : 600,
                        color: isHoliday ? 'warning.dark' : 'text.secondary',
                        textTransform: 'uppercase',
                        maxWidth: '75%',
                        lineHeight: 1.1
                    }}
                >
                    {day.name}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                    w: {day.weight}
                </Typography>
            </Box>
        </Paper>
    );
}
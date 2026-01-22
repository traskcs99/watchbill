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
    const isLookback = day.is_lookback; // Ensure this comes from your backend

    // 1. BASE STYLES: Differentiate between active days, holidays, and lookback days
    const getPaperStyles = () => {
        if (isLookback) {
            return {
                bgcolor: '#fcfcfc',
                borderColor: '#eeeeee',
                opacity: 0.7, // Makes the whole cell look "faded"
                filter: 'grayscale(0.5)', // Subtle desaturation
            };
        }
        if (isHoliday) {
            return {
                boxShadow: '0 0 10px 2px rgba(255, 215, 0, 0.4)',
                borderColor: '#ffc107',
                backgroundColor: '#fffdf0'
            };
        }
        return {
            bgcolor: 'background.paper',
            borderColor: '#e0e0e0'
        };
    };

    const getAssignmentForStation = (stationId) => {
        return assignments.find(a => a.station_id === stationId);
    };

    return (
        <Paper
            elevation={isLookback ? 0 : (isHoliday ? 3 : 1)}
            onClick={() => !isLookback && onInspect(day)} // Disable click for lookback days if desired
            sx={{
                minHeight: 180,
                p: 1,
                cursor: isLookback ? 'default' : 'pointer',
                border: '1px solid',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                    bgcolor: isLookback ? '#fcfcfc' : '#f0f7ff',
                    borderColor: isLookback ? '#eeeeee' : '#1976d2',
                    transform: isLookback ? 'none' : 'translateY(-2px)',
                },
                ...getPaperStyles()
            }}
        >
            {/* HEADER: Day Number & Availability Badge */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                <Typography
                    sx={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        lineHeight: 1,
                        color: isLookback ? 'text.disabled' : (isHoliday ? "warning.dark" : "text.primary")
                    }}
                >
                    {new Date(day.date + "T00:00:00").getDate()}
                </Typography>

                {!isLookback && (
                    <Box sx={{
                        bgcolor: '#e8f5e9',
                        color: '#2e7d32',
                        px: 0.6, py: 0.1, borderRadius: '6px',
                        fontSize: '0.7rem', fontWeight: 800,
                        border: '1px solid #81c784',
                        lineHeight: 1
                    }}>
                        {day.availability_estimate}
                    </Box>
                )}
            </Box>

            {/* MIDDLE: Station Rows */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {requiredStations.map(st => {
                    const assign = getAssignmentForStation(st.station_id);
                    const hasAssignment = !!assign?.assigned_person_name;

                    return (
                        <Box key={st.id} sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            borderBottom: '1px solid #f5f5f5', pb: 0.3
                        }}>
                            <Typography variant="caption" sx={{
                                fontWeight: 800,
                                color: isLookback ? 'text.disabled' : 'text.secondary',
                                fontSize: '0.65rem'
                            }}>
                                {st.abbr}:
                            </Typography>

                            <Box sx={{
                                bgcolor: isLookback ? '#f5f5f5' : (hasAssignment ? '#e3f2fd' : '#e8f5e9'),
                                color: isLookback ? '#9e9e9e' : (hasAssignment ? '#1565c0' : '#2e7d32'),
                                border: '1px solid',
                                borderColor: isLookback ? '#e0e0e0' : (hasAssignment ? '#bbdefb' : '#c8e6c9'),
                                borderRadius: '4px', px: 0.8, py: 0.1, minWidth: '45px', textAlign: 'right', display: 'flex', justifyContent: 'center'
                            }}>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.2 }}>
                                    {hasAssignment
                                        ? assign.assigned_person_name.split(' ')[0]
                                        : (isLookback ? '-' : (assign?.availability_estimate ?? day.availability_estimate))
                                    }
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* LEAVE/EXCLUSION FOOTER */}
            <Box sx={{ mt: 1, mb: 1, minHeight: '20px' }}>
                {leaves.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: 'text.disabled' }}>LV:</Typography>
                        {leaves.map((l, i) => (
                            <Box key={i} sx={{
                                bgcolor: isLookback ? '#f5f5f5' : '#e3f2fd',
                                color: isLookback ? '#9e9e9e' : '#1565c0',
                                border: '1px solid',
                                borderColor: isLookback ? '#e0e0e0' : '#bbdefb',
                                borderRadius: '4px', px: 0.5, py: 0.1, fontSize: '0.55rem', fontWeight: 'bold'
                            }}>
                                {l.person_name}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            {/* FOOTER: Fixed Layout */}
            <Box sx={{ borderTop: '1px solid #eee', pt: 0.5, mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{
                    fontSize: '0.6rem',
                    fontWeight: isLookback ? 400 : 800,
                    color: isLookback ? 'text.disabled' : (isHoliday ? 'warning.dark' : 'text.secondary'),
                    textTransform: 'uppercase'
                }}>
                    {isLookback ? 'Historical' : day.name}
                </Typography>
                {!isLookback && (
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontWeight: 700 }}>
                        W:{day.weight}
                    </Typography>
                )}
            </Box>
        </Paper>
    );
}
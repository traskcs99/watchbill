import React, { memo, useMemo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
// Import the calculator (Make sure you created the file in Step 1)
import { calculateSlotAvailability } from '../utils/availabilityCalculator';

const ScheduleDayCell = memo(({
    day,
    requiredStations = [],
    assignments = [], // Local
    leaves = [],
    exclusions = [],

    // Global Props for Calculator
    allAssignments = [],
    allExclusions = [],
    allDays = [],
    memberships = [],
    isSelected, // 🟢 ADD THIS LINE HERE
    onInspect
}) => {
    const isHoliday = day.is_holiday;
    const isLookback = day.is_lookback;

    // 1. Memoized Styles (Your original styles)
    const paperStyles = useMemo(() => {
        // 1. SELECTION (Highest Priority)
        // This ensures lookback days get the blue outline when clicked.
        if (isSelected) {
            return {
                border: '2px solid #1976d2',
                bgcolor: isLookback ? '#f0f7ff' : '#e3f2fd',
                boxShadow: '0 0 8px rgba(25, 118, 210, 0.4)',
                opacity: 1, // Remove the faded lookback effect when selected
                filter: 'none', // Remove grayscale when selected
                zIndex: 2,
                transform: 'translateY(-2px)',
            };
        }

        // 2. LOOKBACK (Original Style)
        if (isLookback) {
            return {
                bgcolor: '#fcfcfc',
                borderColor: '#eeeeee',
                opacity: 0.7,
                filter: 'grayscale(0.5)',
            };
        }

        // 3. HOLIDAY (Original Style)
        if (isHoliday) {
            return {
                boxShadow: '0 0 10px 2px rgba(25, 118, 210, 0.15)',
                borderColor: '#90caf9',
                backgroundColor: '#f0f7ff'
            };
        }

        // 4. DEFAULT (Original Style)
        return {
            bgcolor: 'background.paper',
            borderColor: '#e0e0e0'
        };
    }, [isLookback, isHoliday, isSelected]);

    const dayNumber = useMemo(() => day.date.split('-')[2], [day.date]);

    return (
        <Paper
            elevation={isLookback ? 0 : (isHoliday ? 3 : 1)}
            onClick={() => onInspect(day)}
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
                ...paperStyles
            }}
        >
            {/* HEADER: Day Number */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                <Typography
                    sx={{
                        fontSize: '1.1rem',
                        fontWeight: isHoliday ? 900 : 500,
                        lineHeight: 1,
                        color: isLookback ? 'text.disabled' : "text.primary"
                    }}
                >
                    {dayNumber}
                </Typography>
            </Box>

            {/* MIDDLE: Station Rows (UPDATED LOGIC HERE) */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {requiredStations.map(st => {
                    const assign = assignments.find(a => a.station_id === st.station_id);
                    const hasAssignment = !!assign?.assigned_person_name;

                    // --- NEW CALCULATION LOGIC ---
                    let displayValue = "-";
                    let availScore = 0;

                    if (hasAssignment) {
                        displayValue = assign.assigned_person_name.split(' ')[0];
                    } else if (!isLookback) {
                        // Calculate Estimate dynamically
                        availScore = calculateSlotAvailability(
                            st.station_id, day, allDays, memberships, allAssignments, allExclusions, requiredStations
                        );
                        displayValue = `${availScore.toFixed(1)}`;
                    }

                    // Dynamic Color for Estimate
                    let boxColor = '#e8f5e9'; // Default Green background
                    let textColor = '#2e7d32'; // Default Green text
                    let borderColor = '#c8e6c9';

                    if (!hasAssignment && !isLookback) {
                        if (availScore <= 0.5) {
                            boxColor = '#ffebee'; textColor = '#c62828'; borderColor = '#ef9a9a'; // Red
                        } else if (availScore < 1.5) {
                            boxColor = '#fff3e0'; textColor = '#ef6c00'; borderColor = '#ffcc80'; // Orange
                        }
                    }

                    return (
                        <Box
                            key={st.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid #f5f5f5',
                                pb: 0.3,
                                opacity: isLookback ? 0.6 : 1
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 200,
                                    color: isLookback ? 'text.disabled' : 'text.primary',
                                    fontSize: '0.65rem',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {st.abbr}:
                            </Typography>

                            <Box sx={{
                                bgcolor: isLookback ? '#f5f5f5' : (hasAssignment ? '#e3f2fd' : boxColor),
                                color: isLookback ? '#9e9e9e' : (hasAssignment ? '#1565c0' : textColor),
                                border: '1px solid',
                                borderColor: isLookback ? '#e0e0e0' : (hasAssignment ? '#bbdefb' : borderColor),
                                borderRadius: '4px', px: 0.8, py: 0.1, minWidth: '45px', textAlign: 'right', display: 'flex', justifyContent: 'center'
                            }}>
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.2 }}>
                                    {displayValue}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* LEAVE FOOTER (Preserved) */}
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

            {/* EXCLUSION FOOTER (Preserved) */}
            {exclusions.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: 'text.disabled' }}>EX:</Typography>
                    {exclusions.map((ex, i) => (
                        <Box key={i} sx={{
                            bgcolor: isLookback ? '#f5f5f5' : '#f5f5f5',
                            color: '#616161',
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px', px: 0.5, py: 0.1, fontSize: '0.55rem', fontWeight: 'bold'
                        }}>
                            {ex.person_name}
                        </Box>
                    ))}
                </Box>
            )}

            {/* FIXED FOOTER (Preserved) */}
            <Box sx={{ borderTop: '1px solid #eee', pt: 0.5, mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{
                    fontSize: '0.6rem',
                    fontWeight: isLookback ? 400 : (isHoliday ? 900 : 500),
                    color: isLookback ? 'text.disabled' : 'text.secondary',
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
        </Paper >
    );
});

export default ScheduleDayCell;
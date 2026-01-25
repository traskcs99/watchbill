import React, { memo, useMemo } from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
// Import the calculator
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

    // Interaction & Validation Props
    isSelected,
    onInspect,
    dayAlerts = [],         // 🟢 NEW
    highlightedMemberId     // 🟢 NEW
}) => {
    const isHoliday = day.is_holiday;
    const isLookback = day.is_lookback;

    // 🟢 1. Check for Conflicts on this Day
    const hasIssues = dayAlerts.length > 0;
    const badAssignmentIds = useMemo(() => {
        const ids = new Set();
        dayAlerts.forEach(a => a.assignment_ids?.forEach(id => ids.add(id)));
        return ids;
    }, [dayAlerts]);

    // 🟢 2. Check Highlighting Status
    // Is the highlighted person excluded on THIS specific day?
    const isHighlightedExcluded = highlightedMemberId && exclusions.some(e => e.membership_id === highlightedMemberId);

    // 3. Memoized Styles
    const paperStyles = useMemo(() => {
        // PRIORITY 1: Highlighted Person is Excluded (RED GLOW)
        if (isHighlightedExcluded) {
            return {
                border: '2px solid #d32f2f',
                bgcolor: '#ffebee',
                boxShadow: '0 0 12px rgba(211, 47, 47, 0.5)',
                transform: 'scale(0.98)',
                zIndex: 2
            };
        }

        // PRIORITY 2: Selection (Blue Outline)
        if (isSelected) {
            return {
                border: '2px solid #1976d2',
                bgcolor: isLookback ? '#f0f7ff' : '#e3f2fd',
                boxShadow: '0 0 8px rgba(25, 118, 210, 0.4)',
                opacity: 1,
                filter: 'none',
                zIndex: 2,
                transform: 'translateY(-2px)',
            };
        }

        // PRIORITY 3: Validation Conflicts (Red Background Tint)
        if (hasIssues) {
            return {
                bgcolor: '#fff5f5', // Light red background
                borderColor: '#ef9a9a' // Light red border
            };
        }

        // PRIORITY 4: Lookback (Faded)
        if (isLookback) {
            return {
                bgcolor: '#fcfcfc',
                borderColor: '#eeeeee',
                opacity: 0.7,
                filter: 'grayscale(0.5)',
            };
        }

        // PRIORITY 5: Holiday (Blue Tint)
        if (isHoliday) {
            return {
                boxShadow: '0 0 10px 2px rgba(25, 118, 210, 0.15)',
                borderColor: '#90caf9',
                backgroundColor: '#f0f7ff'
            };
        }

        // DEFAULT
        return {
            bgcolor: 'background.paper',
            borderColor: '#e0e0e0'
        };
    }, [isLookback, isHoliday, isSelected, isHighlightedExcluded, hasIssues]);

    const dayNumber = useMemo(() => day.date.split('-')[2], [day.date]);

    return (
        <Paper
            elevation={isLookback ? 0 : (isHoliday ? 3 : 1)}
            onClick={() => onInspect(day)}
            sx={{
                minHeight: 250,
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
            {/* HEADER: Day Number & Warnings */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                <Typography
                    sx={{
                        fontSize: '1.1rem',
                        fontWeight: isHoliday ? 900 : 500,
                        lineHeight: 1,
                        color: isHighlightedExcluded ? '#d32f2f' : (isLookback ? 'text.disabled' : "text.primary")
                    }}
                >
                    {dayNumber}
                </Typography>

                {/* 🟢 Validation Icon */}
                {hasIssues && (
                    <Tooltip title={`${dayAlerts.length} Conflicts`}>
                        <WarningIcon color="error" fontSize="small" />
                    </Tooltip>
                )}
            </Box>

            {/* MIDDLE: Station Rows */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {requiredStations.map(st => {
                    const assign = assignments.find(a => a.station_id === st.station_id);
                    const hasAssignment = !!assign?.assigned_person_name;

                    // 🟢 HIGHLIGHTING LOGIC
                    const isTarget = highlightedMemberId && assign?.membership_id === highlightedMemberId;
                    const isDimmed = highlightedMemberId && !isTarget; // Dim if highlighting someone else
                    const isBad = assign && badAssignmentIds.has(assign.id); // Red if conflict

                    // --- CALCULATOR LOGIC (Preserved) ---
                    let displayValue = "-";
                    let availScore = 0;

                    if (hasAssignment) {
                        displayValue = assign.assigned_person_name.split(' ')[0];
                    } else if (!isLookback) {
                        availScore = calculateSlotAvailability(
                            st.station_id, day, allDays, memberships, allAssignments, allExclusions, requiredStations
                        );
                        displayValue = `${availScore.toFixed(1)}`;
                    }

                    // --- COLOR LOGIC ---
                    let boxColor = '#e8f5e9'; // Default Green
                    let textColor = '#2e7d32';
                    let borderColor = '#c8e6c9';

                    // 1. Conflict Color (Red)
                    if (isBad) {
                        boxColor = '#ffebee'; textColor = '#c62828'; borderColor = '#ef9a9a';
                    }
                    // 2. Availability Color (Orange/Red for low scores)
                    else if (!hasAssignment && !isLookback) {
                        if (availScore <= 0.5) {
                            boxColor = '#ffebee'; textColor = '#c62828'; borderColor = '#ef9a9a';
                        } else if (availScore < 1.5) {
                            boxColor = '#fff3e0'; textColor = '#ef6c00'; borderColor = '#ffcc80';
                        }
                    }
                    // 3. Standard Assignment Color (Blue)
                    else if (hasAssignment) {
                        boxColor = '#e3f2fd'; textColor = '#1565c0'; borderColor = '#bbdefb';
                    }

                    // 🟢 4. OVERRIDE: Highlighting Target (Solid Blue Glow)
                    if (isTarget) {
                        boxColor = '#1976d2';
                        textColor = '#ffffff';
                        borderColor = '#1565c0';
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

                                // 🟢 Dimming Effect
                                opacity: isLookback ? 0.6 : (isDimmed ? 0.3 : 1),
                                transition: 'opacity 0.2s',
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
                                bgcolor: isLookback ? '#f5f5f5' : boxColor,
                                color: isLookback ? '#9e9e9e' : textColor,
                                border: '1px solid',
                                borderColor: isLookback ? '#e0e0e0' : borderColor,
                                borderRadius: '4px', px: 0.8, py: 0.1, minWidth: '45px', textAlign: 'right', display: 'flex', justifyContent: 'center',

                                // 🟢 Active Glow Transformation
                                transform: isTarget ? 'scale(1.05)' : 'none',
                                boxShadow: isTarget ? '0 2px 4px rgba(25, 118, 210, 0.4)' : 'none',
                                fontWeight: isTarget ? 700 : 'normal'
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
                    {exclusions.map((ex, i) => {
                        // 🟢 Highlight specific exclusion if selected
                        const isExclusionTarget = highlightedMemberId && ex.membership_id === highlightedMemberId;

                        return (
                            <Box key={i} sx={{
                                bgcolor: isExclusionTarget ? '#ffebee' : '#f5f5f5',
                                color: isExclusionTarget ? '#d32f2f' : '#616161',
                                border: '1px solid',
                                borderColor: isExclusionTarget ? '#ef9a9a' : '#e0e0e0',
                                borderRadius: '4px', px: 0.5, py: 0.1, fontSize: '0.55rem', fontWeight: 'bold'
                            }}>
                                {ex.person_name}
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* FIXED FOOTER (Preserved) */}
            <Box sx={{ borderTop: '1px solid #eee', pt: 0.5, mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                {/* 🟢 REVERTED: Standard wrapping allowed here */}
                <Typography variant="caption" sx={{
                    fontSize: '0.6rem',
                    fontWeight: isLookback ? 400 : (isHoliday ? 900 : 500),
                    color: isLookback ? 'text.disabled' : 'text.secondary',
                    textTransform: 'uppercase',
                    // maxWidth removed, noWrap removed
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
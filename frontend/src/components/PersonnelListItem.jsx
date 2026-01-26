import React from 'react';
import {
    Box, Typography, IconButton, Chip, ListItem,
    ListItemText, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings'; // 🟢 NEW IMPORT

// StatItem helper stays here as it's private to this list item
const StatItem = ({ label, override, groupDefault }) => {
    const isOverride = override !== null && override !== undefined;
    const val = isOverride ? override : (groupDefault ?? '-');
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                {label}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.3}>
                <Typography variant="caption" fontWeight={isOverride ? "bold" : "medium"} color={isOverride ? "primary.main" : "text.primary"}>
                    {val}
                </Typography>
                {!isOverride && groupDefault !== undefined && (
                    <PeopleIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                )}
            </Box>
        </Box>
    );
};

export default function PersonnelListItem({
    member,
    masterStations,
    onRemove,
    onOpenLeave,
    onOpenWeight,
    onDeleteLeave,
    onOpenConfig // 🟢 NEW PROP
}) {

    // --- LEAVE PILL LOGIC ---
    const renderLeavePills = () => {
        if (!member.leaves || member.leaves.length === 0) return null;

        return member.leaves.map((leave) => {
            const start = new Date(leave.start_date + "T00:00:00");
            const end = new Date(leave.end_date + "T00:00:00");
            const isSameDay = leave.start_date === leave.end_date;

            // Format: "1/20" or "1/20-22" (shorthand for same month ranges)
            let label = "";
            if (isSameDay) {
                label = `${start.getMonth() + 1}/${start.getDate()}`;
            } else if (start.getMonth() === end.getMonth()) {
                label = `${start.getMonth() + 1}/${start.getDate()}-${end.getDate()}`;
            } else {
                label = `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`;
            }

            return (
                <Chip
                    key={leave.id}
                    label={label}
                    size="small"
                    onDelete={() => onDeleteLeave(leave.id)}
                    sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: 'error.light',
                        color: 'error.contrastText',
                        '& .MuiChip-deleteIcon': { fontSize: 12, color: 'white' }
                    }}
                />
            );
        });
    };

    return (
        <ListItem
            divider
            secondaryAction={
                <IconButton size="small" onClick={() => onRemove(member.id)}>
                    <DeleteIcon fontSize="inherit" color="error" />
                </IconButton>
            }
        >
            <ListItemText
                primaryTypographyProps={{ component: 'div' }}
                primary={
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="bold">{member.person_name}</Typography>
                        <Typography variant="caption" color="text.secondary">({member.group_name})</Typography>
                        <Tooltip title="Manage Leave">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenLeave(member);
                                }}
                            >
                                <CalendarMonthIcon fontSize="inherit" color="action" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                }
                secondaryTypographyProps={{ component: 'div' }}
                secondary={
                    <Box sx={{ mt: 1 }}>
                        {/* Stats Section */}
                        <Box display="flex" gap={2} mb={1} alignItems="flex-end">
                            <StatItem label="Min" override={member.overrides?.min_assignments} groupDefault={member.group_defaults?.min_assignments} />
                            <StatItem label="Max" override={member.overrides?.max_assignments} groupDefault={member.group_defaults?.max_assignments} />

                            {/* 🟢 Modified Seniority Section with Gear Icon */}
                            <Box display="flex" alignItems="center">
                                <StatItem label="Seniority" override={member.overrides?.seniorityFactor} groupDefault={member.group_defaults?.seniorityFactor} />
                                <Tooltip title="Edit Seniority & Limits">
                                    <IconButton
                                        size="small"
                                        onClick={() => onOpenConfig(member)}
                                        sx={{
                                            ml: 0.5,
                                            p: 0.5,
                                            // Highlight gear if any override exists
                                            color: (member.overrides?.seniorityFactor || member.overrides?.min_assignments || member.overrides?.max_assignments)
                                                ? 'primary.main'
                                                : 'action.disabled'
                                        }}
                                    >
                                        <SettingsIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        {/* Qualifications & Weights */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                            {member.station_weights.map(sw => {
                                const station = masterStations.find(ms => Number(ms.id) === Number(sw.station_id));
                                return (
                                    <Chip
                                        key={sw.id}
                                        label={`${station?.abbr || '??'}: ${Math.round(sw.weight * 100)}%`}
                                        color="primary" size="small"
                                        onClick={() => {
                                            console.log("Opening weight for member:", member.id);
                                            onOpenWeight(member);
                                        }}
                                        sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
                                    />
                                );
                            })}
                            {member.qualifications
                                ?.filter(qId => {
                                    return !member.station_weights.some(sw => Number(sw.station_id) === Number(qId))
                                })
                                .map(qId => (
                                    <Chip
                                        key={qId}
                                        label={`+ ${masterStations.find(m => m.id === qId)?.abbr || '??'}`}
                                        variant="outlined" size="small"
                                        onClick={() => {
                                            console.log("QUAL CHIP CLICKED for:", member.person_name);
                                            onOpenWeight(member);
                                        }}
                                        sx={{ height: 20, fontSize: '0.65rem', borderStyle: 'dashed', cursor: 'pointer' }}
                                    />
                                ))
                            }
                        </Box>

                        {/* Leave Pills Container */}
                        {member.leaves?.length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {renderLeavePills()}
                            </Box>
                        )}
                    </Box>
                }
            />
        </ListItem>
    );
}
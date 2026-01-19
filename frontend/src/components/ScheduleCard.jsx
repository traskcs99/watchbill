import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    CardActions,
    Chip,
    Box
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
export default function ScheduleCard({ schedule, onDelete }) {
    const navigate = useNavigate();
    const handleOpen = () => {
        // Navigates to the route you defined in App.jsx: /schedules/:scheduleId
        navigate(`/schedules/${schedule.id}`); //
    };

    // Helper to choose color based on status
    const getStatusColor = (status) => {
        switch (status) {
            case 'published': return 'success'; // Green
            case 'draft': return 'warning';     // Orange
            case 'archived': return 'default';  // Grey
            default: return 'primary';
        }
    };

    return (
        <Card sx={{ minWidth: 275, boxShadow: 3, borderRadius: 2 }}>
            <CardContent>
                {/* Header: Name and Status */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        {schedule.name}
                    </Typography>
                    <Chip
                        label={schedule.status.toUpperCase()}
                        color={getStatusColor(schedule.status)}
                        size="small"
                        variant="outlined"
                    />
                </Box>

                {/* Dates Section */}
                <Box display="flex" alignItems="center" color="text.secondary" mb={1}>
                    <CalendarMonthIcon fontSize="small" sx={{ mr: 1 }} />
                    <Typography variant="body2">
                        {schedule.start_date} — {schedule.end_date}
                    </Typography>
                </Box>

                {/* ID for debugging (Optional) */}
                <Typography variant="caption" color="text.disabled">
                    ID: {schedule.id}
                </Typography>
            </CardContent>

            <CardActions>
                <Button size="small" variant="contained" disableElevation onClick={handleOpen}>
                    Open
                </Button>
                <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                        if (window.confirm("Delete this schedule?")) {
                            onDelete(schedule.id); // <--- CALLING THE PARENT FUNCTION
                        }
                    }}
                >
                    <DeleteIcon />
                </IconButton>
            </CardActions>
        </Card>
    );
}
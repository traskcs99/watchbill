import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Breadcrumbs, Link, Paper,
    CircularProgress, Chip, Button, Divider,
    TextField, Switch, FormControlLabel, IconButton,
    Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export default function ScheduleWorkspace() {
    const { scheduleId } = useParams();
    const [schedule, setSchedule] = useState(null);
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [summary, setSummary] = useState(null);
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
    const [masterStations, setMasterStations] = useState([]);

    // 1. Define fetchData outside so it can be reused
    const fetchData = useCallback(async () => {
        try {
            const [schRes, daysRes, summaryRes, masterRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/days`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/summary`).then(res => res.json()),
                fetch('/api/master-stations').then(res => res.json())
            ]);
            setSchedule(schRes);
            setDays(daysRes);
            setSummary(summaryRes);
            setMasterStations(masterRes);
            setLoading(false);
        } catch (err) {
            console.error("Error loading workspace:", err);
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddStation = async (stationId) => {
        try {
            const res = await fetch(`/api/schedules/${scheduleId}/stations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ station_id: stationId })
            });

            if (res.ok) {
                setIsStationDialogOpen(false);
                await fetchData(); // Now this works!
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            console.error("Link failed:", err);
        }
    };

    // 2. Add the Remove Function (New!)
    const handleRemoveStation = async (scheduleStationId) => {
        if (!window.confirm("Remove this station? This will delete all unassigned slots for this month.")) return;

        try {
            const res = await fetch(`/api/schedules/${scheduleId}/stations/${scheduleStationId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchData(); // Refresh the chips and calendar
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const getPaddingCells = () => {
        if (days.length === 0) return [];
        const firstDate = new Date(days[0].date + "T00:00:00");
        let dayOfWeek = firstDate.getDay();
        const count = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        return Array(count).fill(null);
    };

    if (loading) return <Box p={5} textAlign="center"><CircularProgress /></Box>;
    if (!schedule) return <Typography p={5}>Schedule not found.</Typography>;

    return (
        <Box sx={{ p: 3 }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
                <Link underline="hover" color="inherit" href="/">Schedules</Link>
                <Typography color="text.primary" fontWeight="bold">{schedule.name}</Typography>
                <Typography color="primary">Configuration</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', gap: 2, height: '80vh' }}>
                {/* LEFT: CALENDAR */}
                <Box sx={{ flex: 3, overflowY: 'auto', pr: 1 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(h => (
                            <Typography key={h} align="center" variant="caption" fontWeight="bold" color="text.secondary">
                                {h.toUpperCase()}
                            </Typography>
                        ))}
                        {getPaddingCells().map((_, i) => <Box key={`pad-${i}`} sx={{ minHeight: 100 }} />)}
                        {days.map((day) => (
                            <Paper
                                key={day.id}
                                elevation={1}
                                onClick={() => setSelectedDay(day)}
                                sx={{
                                    minHeight: 100, p: 1, cursor: 'pointer',
                                    border: selectedDay?.id === day.id ? '2px solid #1a237e' : '1px dotted #ccc'
                                }}
                            >
                                <Typography variant="caption" fontWeight="bold">
                                    {new Date(day.date + "T00:00:00").getDate()}
                                </Typography>
                            </Paper>
                        ))}
                    </Box>
                </Box>

                {/* RIGHT: INSPECTOR / SUMMARY */}
                <Paper sx={{ flex: 1, p: 2, border: '1px solid #ddd', borderRadius: 2, bgcolor: 'white', overflowY: 'auto' }}>
                    {selectedDay ? (
                        <Box>
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Typography variant="h6">Day Details</Typography>
                                <Button size="small" onClick={() => setSelectedDay(null)}>Back</Button>
                            </Box>
                            <Typography variant="subtitle2">Date: {selectedDay.date}</Typography>
                        </Box>
                    ) : (
                        <Box>
                            <Typography variant="h6" gutterBottom fontWeight="bold">Schedule Summary</Typography>
                            {summary && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Roster Strength</Typography>
                                        <Typography variant="h5">{summary.member_count} Members</Typography>
                                    </Paper>
                                    <Box sx={{ mt: 2 }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="subtitle2" fontWeight="bold">Required Stations</Typography>
                                            <Button size="small" variant="outlined" onClick={() => setIsStationDialogOpen(true)}>Add Station</Button>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {summary?.required_stations?.map((st) => (
                                                <Chip
                                                    key={st.id}
                                                    label={st.abbr}
                                                    color="primary"
                                                    variant="outlined"
                                                    size="small"
                                                    // Use the schedule_station ID to delete
                                                    onDelete={() => handleRemoveStation(st.id)}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </Paper>
            </Box>

            {/* STATION PICKER DIALOG */}
            <Dialog open={isStationDialogOpen} onClose={() => setIsStationDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Station to Schedule</DialogTitle>
                <DialogContent>
                    <List>
                        {masterStations
                            // FILTER: Only show stations NOT already in the required_stations list
                            .filter(ms => !summary?.required_stations?.some(rs => rs.station_id === ms.id))
                            .map((st) => (
                                <ListItem
                                    key={st.id}
                                    secondaryAction={
                                        <Button size="small" variant="contained" onClick={() => handleAddStation(st.id)}>
                                            Add
                                        </Button>
                                    }
                                >
                                    <ListItemText primary={st.name} secondary={st.abbr} />
                                </ListItem>
                            ))}

                        {/* If everything is already added */}
                        {masterStations.filter(ms => !summary?.required_stations?.some(rs => rs.station_id === ms.id)).length === 0 && (
                            <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                All available stations have been added.
                            </Typography>
                        )}
                    </List>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
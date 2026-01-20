import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Breadcrumbs, Link, Paper,
    CircularProgress, Chip, Button, Divider,
    IconButton, Dialog, DialogTitle, DialogContent,
    List, ListItem, ListItemText, Tabs, Tab
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentIcon from '@mui/icons-material/Assignment';

// IMPORT THE NEW DIALOG
import WeightDistributionDialog from '../components/WeightDistributionDialog';

export default function ScheduleWorkspace() {
    const { scheduleId } = useParams();
    const [schedule, setSchedule] = useState(null);
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [summary, setSummary] = useState(null);
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
    const [masterStations, setMasterStations] = useState([]);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [weightMap, setWeightMap] = useState({});

    // FIXED: Removed the stray 'd' at the end of this line
    const [allPersonnel, setAllPersonnel] = useState([]);

    const [weightDialogOpen, setWeightDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);

    // TAB STATE
    const [activeTab, setActiveTab] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const [schRes, daysRes, summaryRes, masterRes, peopleRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/days`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/summary`).then(res => res.json()),
                fetch('/api/master-stations').then(res => res.json()),
                fetch('/api/personnel').then(res => res.json())
            ]);
            setSchedule(schRes);
            setDays(daysRes);
            setSummary(summaryRes);
            setMasterStations(masterRes);
            setAllPersonnel(peopleRes);
            setLoading(false);
        } catch (err) {
            console.error("Error loading workspace:", err);
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    useEffect(() => {
        if (selectedDay) setActiveTab(0);
    }, [selectedDay]);

    const handleAddStation = async (stationId) => {
        const res = await fetch(`/api/schedules/${scheduleId}/stations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station_id: stationId })
        });
        if (res.ok) {
            setIsStationDialogOpen(false);
            await fetchData();
        }
    };

    const handleRemoveStation = async (scheduleStationId) => {
        if (!window.confirm("Remove station?")) return;
        const res = await fetch(`/api/schedules/${scheduleId}/stations/${scheduleStationId}`, {
            method: 'DELETE'
        });
        if (res.ok) await fetchData();
    };

    const handleAddMember = async (personId) => {
        try {
            const res = await fetch('/api/schedule-memberships', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schedule_id: parseInt(scheduleId),
                    person_id: personId
                })
            });

            if (res.ok) {
                await fetchData();
                setIsMemberDialogOpen(false);
            } else {
                const err = await res.json();
                console.error("Server Error:", err.error);
            }
        } catch (err) {
            console.error("Network/App Error:", err);
        }
    };

    const handleRemoveMember = async (id) => {
        if (!window.confirm("Remove person from schedule?")) return;
        const res = await fetch(`/api/schedule-memberships/${id}`, { method: 'DELETE' });
        if (res.ok) await fetchData();
    };

    // --- NEW HANDLER FOR SAVING WEIGHTS ---
    const handleSaveWeights = async (membershipId, weights) => {
        try {
            const res = await fetch(`/api/schedule-memberships/${membershipId}/weights/distribute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weights })
            });
            if (res.ok) {
                setWeightDialogOpen(false);
                fetchData();
            } else {
                alert("Failed to save weights");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenWeightSlider = (mem) => {
        if (!mem) {
            console.warn("No member provided to weight slider");
            return;
        }

        setEditingMember(mem);

        const initialWeights = {};
        const quals = mem.qualifications || [];
        const currentWeights = mem.station_weights || [];

        quals.forEach(qId => {
            // We check both number and string types to be safe
            const existing = currentWeights.find(sw =>
                Number(sw.station_id) === Number(qId)
            );

            // Use the existing weight, or default to 0.0 for the + pill
            initialWeights[qId] = existing ? existing.weight : 0.0;
        });

        setWeightMap(initialWeights);
        setWeightDialogOpen(true);
        console.log("State set to true")
    };

    const StatItem = ({ label, override, groupDefault }) => {
        const isOverride = override !== null && override !== undefined;
        const val = isOverride ? override : groupDefault;
        return (
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>{label}</Typography>
                <Box display="flex" alignItems="center" gap={0.3}>
                    <Typography variant="caption" fontWeight={isOverride ? "bold" : "medium"} color={isOverride ? "primary.main" : "text.primary"}>
                        {val}
                    </Typography>
                    {!isOverride && <PeopleIcon sx={{ fontSize: 10, color: 'text.disabled' }} />}
                </Box>
            </Box>
        );
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
        <Box sx={{ p: 3, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
                <Link underline="hover" color="inherit" href="/">Schedules</Link>
                <Typography color="text.primary" fontWeight="bold">{schedule.name}</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', gap: 2, height: '82vh' }}>
                {/* LEFT: CALENDAR */}
                <Box sx={{ flex: 3, overflowY: 'auto' }}>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
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
                                    elevation={0}
                                    onClick={() => setSelectedDay(day)}
                                    sx={{
                                        minHeight: 110, p: 1, cursor: 'pointer',
                                        border: selectedDay?.id === day.id ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                        bgcolor: day.is_holiday ? '#fff9c4' : 'white',
                                        '&:hover': { bgcolor: '#f0f7ff' }
                                    }}
                                >
                                    <Typography variant="caption" fontWeight="bold">
                                        {new Date(day.date + "T00:00:00").getDate()}
                                    </Typography>
                                </Paper>
                            ))}
                        </Box>
                    </Paper>
                </Box>

                {/* RIGHT: TABS SIDEBAR */}
                <Paper sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab icon={<AssignmentIcon fontSize="small" />} label="Operations" />
                        <Tab icon={<SettingsIcon fontSize="small" />} label="Configure" />
                    </Tabs>

                    <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                        {/* TAB 0: OPERATIONS */}
                        {activeTab === 0 && (
                            <Box>
                                {selectedDay ? (
                                    <Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                            <Typography variant="h6">Day Detail</Typography>
                                            <Button variant="outlined" size="small" onClick={() => setSelectedDay(null)}>Clear</Button>
                                        </Box>
                                        <Divider sx={{ mb: 2 }} />
                                        <Typography variant="subtitle2" color="text.secondary">Date: {selectedDay.date}</Typography>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Typography variant="h6" gutterBottom fontWeight="bold">Schedule Status</Typography>
                                        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: summary?.is_solvable ? '#e3f2fd' : '#fff3e0' }}>
                                            <Typography variant="caption" color="text.secondary">SOLVER STATUS</Typography>
                                            <Typography variant="h6" color={summary?.is_solvable ? 'success.main' : 'warning.main'}>
                                                {summary?.is_solvable ? "Likely Solvable" : "Action Required"}
                                            </Typography>
                                        </Paper>
                                        {summary?.warnings?.map((w, i) => (
                                            <Typography key={i} variant="caption" color="error" display="block">• {w}</Typography>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* TAB 1: CONFIGURATION */}
                        {activeTab === 1 && (
                            <Box>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Required Stations</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                                    {summary?.required_stations?.map((st) => (
                                        <Chip key={st.id} label={st.abbr} color="primary" variant="outlined" onDelete={() => handleRemoveStation(st.id)} />
                                    ))}
                                    <Button size="small" sx={{ border: '1px dashed grey' }} onClick={() => setIsStationDialogOpen(true)}>+ Add</Button>
                                </Box>

                                <Divider sx={{ my: 2 }} />

                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                    <Typography variant="subtitle1" fontWeight="bold">Personnel Pool</Typography>
                                    <Button size="small" startIcon={<PeopleIcon />}>Manage</Button>
                                </Box>

                                <List dense sx={{ bgcolor: '#f9f9f9', borderRadius: 1 }}>
                                    {summary?.memberships?.map((mem) => (
                                        <ListItem
                                            key={mem.id}
                                            divider
                                            secondaryAction={
                                                <IconButton size="small" onClick={() => handleRemoveMember(mem.id)}>
                                                    <DeleteIcon fontSize="inherit" color="error" />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemText
                                                primaryTypographyProps={{ component: 'div' }}
                                                primary={
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="body2" fontWeight="bold">{mem.person_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">({mem.group_name})</Typography>
                                                    </Box>
                                                }
                                                secondaryTypographyProps={{ component: 'div' }}
                                                secondary={
                                                    <Box sx={{ mt: 1 }}>
                                                        {/* A. STATS BLOCK */}
                                                        <Box display="flex" gap={2} mb={1}>
                                                            <StatItem
                                                                label="Min"
                                                                override={mem.overrides?.min_assignments} // Added ?.
                                                                groupDefault={mem.group_defaults?.min_assignments} // Added ?.
                                                            />
                                                            <StatItem
                                                                label="Max"
                                                                override={mem.overrides?.max_assignments}
                                                                groupDefault={mem.group_defaults?.max_assignments}
                                                            />
                                                            <StatItem
                                                                label="Seniority"
                                                                override={mem.overrides?.seniorityFactor}
                                                                groupDefault={mem.group_defaults?.seniorityFactor}
                                                            />
                                                        </Box>
                                                        {/* B. WEIGHT PILLS */}
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                                            {mem.station_weights.map(sw => {
                                                                // Look up the abbreviation using the master list
                                                                const station = masterStations.find(ms => ms.id === sw.station_id);
                                                                const abbr = station ? station.abbr : 'Unk';

                                                                return (
                                                                    <Chip
                                                                        key={sw.id}
                                                                        label={`${abbr}: ${Math.round(sw.weight * 100)}%`}
                                                                        color="primary"
                                                                        size="small"
                                                                        onClick={() => handleOpenWeightSlider(mem)}
                                                                        sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
                                                                    />
                                                                );

                                                            })}
                                                            {mem.qualifications
                                                                ?.filter(qId => !mem.station_weights.some(sw => sw.station_id === qId))
                                                                .map(qId => {
                                                                    const ms = masterStations.find(m => m.id === qId);
                                                                    return (
                                                                        <Chip
                                                                            key={qId}
                                                                            label={`+ ${ms?.abbr || '??'}`}
                                                                            variant="outlined"
                                                                            size="small"
                                                                            // Ensure 'mem' is the object from the outer memberships.map
                                                                            onClick={() => handleOpenWeightSlider(mem)}
                                                                            sx={{
                                                                                height: 20,
                                                                                fontSize: '0.65rem',
                                                                                borderStyle: 'dashed',
                                                                                cursor: 'pointer',
                                                                                '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.04)' }
                                                                            }}
                                                                        />
                                                                    );
                                                                })
                                                            }
                                                        </Box>
                                                        {mem.leaves?.length > 0 && (
                                                            <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                                                                • On Leave during this schedule
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                                <Button
                                    fullWidth
                                    size="small"
                                    startIcon={<PeopleIcon />}
                                    onClick={() => setIsMemberDialogOpen(true)}
                                    sx={{ mt: 1 }}
                                >
                                    Add Personnel
                                </Button>
                            </Box>
                        )} {/* <--- FIXED: ADDED CLOSING FOR TAB 1 */}
                    </Box>
                </Paper>
            </Box>

            {/* DIALOGS */}
            <Dialog open={isStationDialogOpen} onClose={() => setIsStationDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Station</DialogTitle>
                <DialogContent>
                    <List>
                        {masterStations
                            .filter(ms => !summary?.required_stations?.some(rs => rs.station_id === ms.id))
                            .map((st) => (
                                <ListItem key={st.id} secondaryAction={<Button size="small" onClick={() => handleAddStation(st.id)}>Add</Button>}>
                                    <ListItemText primary={st.name} secondary={st.abbr} />
                                </ListItem>
                            ))}
                    </List>
                </DialogContent>
            </Dialog>

            <Dialog open={isMemberDialogOpen} onClose={() => setIsMemberDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add to Schedule Roster</DialogTitle>
                <DialogContent>
                    <List>
                        {allPersonnel
                            .filter(person => {
                                // Safety check: ensure summary and memberships exist
                                if (!summary?.memberships) return true;
                                // Check if this person's ID exists in the current roster
                                return !summary.memberships.some(m => m.person_id === person.id);
                            })
                            .map((person) => (
                                <ListItem
                                    key={person.id}
                                    secondaryAction={
                                        <Button size="small" onClick={() => handleAddMember(person.id)}>
                                            Add
                                        </Button>
                                    }
                                >
                                    <ListItemText primary={person.name} />
                                </ListItem>
                            ))}
                    </List>
                </DialogContent>
            </Dialog>

            {/* ADDED THE WEIGHT SLIDER DIALOG */}
            <WeightDistributionDialog
                open={weightDialogOpen}
                onClose={() => setWeightDialogOpen(false)}
                member={editingMember}
                masterStations={masterStations}
                onSave={handleSaveWeights}
            />

        </Box>
    );
}
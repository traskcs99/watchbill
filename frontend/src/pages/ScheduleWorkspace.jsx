import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Breadcrumbs, Link, Paper,
    CircularProgress, Button, Divider, Dialog, DialogTitle,
    DialogContent, List, ListItem, ListItemText, Tabs, Tab
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentIcon from '@mui/icons-material/Assignment';

// Sub-Components
import ScheduleCalendar from '../components/ScheduleCalendar';
import ConfigurationTab from '../components/ConfigurationTab';
import WeightDistributionDialog from '../components/WeightDistributionDialog';
// NOTE: Make sure to import your new LeaveManagerDialog here once created
import LeaveManagerDialog from '../components/LeaveManagerDialog';
import ScheduleDayCell from '../components/ScheduleDayCell'; // Ensure this is imported if used directly (or via Calendar)

export default function ScheduleWorkspace() {
    const { scheduleId } = useParams();

    // -- STATE --
    const [schedule, setSchedule] = useState(null);
    const [days, setDays] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [masterStations, setMasterStations] = useState([]);
    const [allPersonnel, setAllPersonnel] = useState([]);

    // UI State
    const [selectedDay, setSelectedDay] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Dialog State
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);

    // Weight Dialog State
    const [weightDialogOpen, setWeightDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [weightMap, setWeightMap] = useState({}); // Keep this for safety

    // Leave Dialog State
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [activeLeaveMember, setActiveLeaveMember] = useState(null);

    const [assignments, setAssignments] = useState([]); // Add State for Assignments
    const [allLeaves, setAllLeaves] = useState([]); // Add State for Leaves

    const [exclusions, setExclusions] = useState([]); // <--- Don't forget to add this state at the top!

    const fetchData = useCallback(async () => {
        try {
            // Note: We added exclusionsRes to the end of this list
            const [schRes, daysRes, summaryRes, masterRes, peopleRes, assignmentsRes, leavesRes, exclusionsRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/days`).then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/summary`).then(res => res.json()),
                fetch('/api/master-stations').then(res => res.json()),
                fetch('/api/personnel').then(res => res.json()),
                // Handle potential 404s for empty data with conditional checks
                fetch(`/api/schedules/${scheduleId}/assignments`).then(res => res.ok ? res.json() : []),
                fetch(`/api/leaves?schedule_id=${scheduleId}`).then(res => res.ok ? res.json() : []),
                // FIX: Added closing parenthesis and fallback array
                fetch(`/api/exclusions/schedule/${scheduleId}`).then(res => res.ok ? res.json() : [])
            ]);

            setSchedule(schRes);
            setDays(daysRes);
            setSummary(summaryRes);
            setMasterStations(masterRes);
            setAllPersonnel(peopleRes);
            setAssignments(assignmentsRes);
            setAllLeaves(leavesRes);
            setExclusions(exclusionsRes); // <--- Save the exclusions to state
            setLoading(false);
        } catch (err) {
            console.error("Error loading workspace:", err);
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { if (selectedDay) setActiveTab(0); }, [selectedDay]);

    // -- HANDLERS --
    const handleTabChange = (_, newValue) => setActiveTab(newValue);

    const handleAddStation = async (stationId) => {
        const res = await fetch(`/api/schedules/${scheduleId}/stations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station_id: stationId })
        });
        if (res.ok) { setIsStationDialogOpen(false); fetchData(); }
    };

    const handleRemoveStation = async (id) => {
        if (window.confirm("Remove station?")) {
            const res = await fetch(`/api/schedules/${scheduleId}/stations/${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
        }
    };

    const handleAddMember = async (personId) => {
        const res = await fetch('/api/schedule-memberships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule_id: parseInt(scheduleId), person_id: personId })
        });
        if (res.ok) { setIsMemberDialogOpen(false); fetchData(); }
    };

    const handleRemoveMember = async (id) => {
        if (window.confirm("Remove person?")) {
            const res = await fetch(`/api/schedule-memberships/${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
        }
    };

    // Weight Logic
    const handleOpenWeightSlider = (mem) => {
        if (!mem) return;
        setEditingMember(mem);
        // Pre-calc logic moved to Dialog, but we set state here to trigger mount
        setWeightDialogOpen(true);
    };

    const handleSaveWeights = async (membershipId, weights) => {
        const res = await fetch(`/api/schedule-memberships/${membershipId}/weights/distribute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weights })
        });
        if (res.ok) { setWeightDialogOpen(false); fetchData(); }
    };

    // Leave Logic
    const handleDeleteLeave = async (leaveId) => {
        if (!window.confirm("Remove leave?")) return;
        const res = await fetch(`/api/leaves/${leaveId}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    };
    const handleOpenLeaveDialog = (mem) => {
        console.log("Attempting to open leave for:", mem.person_name);
        setActiveLeaveMember(mem);
        setLeaveDialogOpen(true);
    };
    const handleSaveLeave = async (membershipId, formData) => {
        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    membership_id: membershipId,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    reason: formData.reason
                })
            });

            if (res.ok) {
                setLeaveDialogOpen(false);
                fetchData(); // This refreshes the personnel pool to show the new pills
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (err) {
            console.error("Failed to save leave:", err);
        }
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

                {/* 1. CALENDAR COMPONENT */}
                <ScheduleCalendar
                    days={days}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    assignments={assignments} // Pass the data down
                    leaves={allLeaves}        // Pass the data down
                    exclusions={exclusions} // Pass the data down

                />

                {/* 2. SIDEBAR TABS */}
                <Paper sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
                    <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tab icon={<AssignmentIcon fontSize="small" />} label="Operations" />
                        <Tab icon={<SettingsIcon fontSize="small" />} label="Configure" />
                    </Tabs>

                    <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                        {activeTab === 0 && (
                            <Box>
                                {/* Operations Tab Content (Keep inline or extract later) */}
                                {selectedDay ? (
                                    <Box>
                                        <Box display="flex" justifyContent="space-between" mb={2}>
                                            <Typography variant="h6">Day Detail</Typography>
                                            <Button variant="outlined" size="small" onClick={() => setSelectedDay(null)}>Clear</Button>
                                        </Box>
                                        <Divider sx={{ mb: 2 }} />
                                        <Typography variant="subtitle2">Date: {selectedDay.date}</Typography>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Typography variant="h6" fontWeight="bold">Schedule Status</Typography>
                                        {/* Status logic here... */}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {activeTab === 1 && (
                            <ConfigurationTab
                                summary={summary}
                                masterStations={masterStations}
                                onRemoveStation={handleRemoveStation}
                                onAddStationClick={() => setIsStationDialogOpen(true)}
                                onRemoveMember={handleRemoveMember}
                                onAddMemberClick={() => setIsMemberDialogOpen(true)}
                                onOpenWeightSlider={handleOpenWeightSlider}
                                onOpenLeave={(mem) => {
                                    console.log("Workspace: Setting active member to", mem.person_name);
                                    setActiveLeaveMember(mem);
                                    setLeaveDialogOpen(true);
                                }}
                                onDeleteLeave={handleDeleteLeave}
                            />
                        )}
                    </Box>
                </Paper>
            </Box>

            {/* --- DIALOGS (Keep these at the bottom or extract further) --- */}

            <Dialog open={isStationDialogOpen} onClose={() => setIsStationDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Station</DialogTitle>
                <DialogContent>
                    <List>
                        {masterStations
                            .filter(ms => !summary?.required_stations?.some(rs => rs.station_id === ms.id))
                            .map((st) => (
                                <ListItem key={st.id} secondaryAction={<Button onClick={() => handleAddStation(st.id)}>Add</Button>}>
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
                            .filter(person => !summary?.memberships?.some(m => m.person_id === person.id))
                            .map((person) => (
                                <ListItem key={person.id} secondaryAction={<Button onClick={() => handleAddMember(person.id)}>Add</Button>}>
                                    <ListItemText primary={person.name} />
                                </ListItem>
                            ))}
                    </List>
                </DialogContent>
            </Dialog>

            <WeightDistributionDialog
                open={weightDialogOpen}
                onClose={() => setWeightDialogOpen(false)}
                member={editingMember}
                masterStations={masterStations}
                onSave={handleSaveWeights}
            />

            <LeaveManagerDialog
                open={leaveDialogOpen}
                onClose={() => setLeaveDialogOpen(false)}
                member={activeLeaveMember}
                onSave={handleSaveLeave}
            />
        </Box>
    );
}
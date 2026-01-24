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
import DayDetailView from '../components/DayDetailView';
export default function ScheduleWorkspace() {
    const { scheduleId } = useParams();

    // -- STATE --
    const [schedule, setSchedule] = useState(null);
    const [days, setDays] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [masterStations, setMasterStations] = useState([]);
    const [allPersonnel, setAllPersonnel] = useState([]);

    const [selectedDay, setSelectedDay] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Dialog & UI State
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [weightDialogOpen, setWeightDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [activeLeaveMember, setActiveLeaveMember] = useState(null);

    const [assignments, setAssignments] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [exclusions, setExclusions] = useState([]);

    // 🟢 OPTIMIZATION 1: Memoize the selection handler
    // This prevents all 34 calendar cells from re-rendering when you click around
    const handleSelectDay = useCallback((day) => {
        setSelectedDay(day);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [schData, masterRes, peopleRes, assignmentsRes, exclusionsRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}`).then(res => res.json()),
                fetch('/api/master-stations').then(res => res.json()),
                fetch('/api/personnel').then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/assignments`).then(res => res.ok ? res.json() : []),
                fetch(`/api/exclusions/schedule/${scheduleId}`).then(res => res.ok ? res.json() : [])
            ]);

            setSchedule(schData);
            setSummary(schData);
            setDays(schData.days || []);
            setAllLeaves(schData.leaves_exploded || []);
            setMasterStations(masterRes);
            setAllPersonnel(peopleRes);
            setAssignments(assignmentsRes);
            setExclusions(exclusionsRes);

            setLoading(false);
        } catch (err) {
            console.error("Error loading workspace:", err);
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 🟢 OPTIMIZATION 2: Clear selected day efficiently
    const handleClearSelection = useCallback(() => {
        setSelectedDay(null);
    }, []);

    useEffect(() => {
        if (selectedDay) setActiveTab(0);
    }, [selectedDay]);

    const handleTabChange = useCallback((_, newValue) => {
        setActiveTab(newValue);
    }, []);

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
    // --- DAY DETAIL HANDLERS ---

    // 1. Update Name, Holiday, or Weight
    const handleUpdateDay = useCallback(async (dayId, updates) => {
        try {
            const res = await fetch(`/api/schedule-days/${dayId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                // Update local state so the calendar and sidebar reflect the change
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, ...updates } : d));
                setSelectedDay(prev => prev?.id === dayId ? { ...prev, ...updates } : prev);
            }
        } catch (err) {
            console.error("Failed to update day:", err);
        }
    }, []);

    // 2. Assign a person to a station
    const handleAssign = useCallback(async (dayId, stationId, membershipId) => {
        // 1. Find the assignment record for this specific day/station to get its ID
        const targetAssignment = assignments.find(
            a => a.day_id === dayId && a.station_id === stationId
        );

        if (!targetAssignment) {
            console.error("No assignment slot found for this day/station");
            return;
        }

        try {
            // 2. Use your existing PATCH route with the assignment ID
            const res = await fetch(`/api/assignments/${targetAssignment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    membership_id: membershipId || null,
                    is_locked: true // Lock it since a human made this choice
                })
            });

            if (res.ok) {
                // 3. Refresh assignments so the UI updates
                const assignmentsRes = await fetch(`/api/schedules/${scheduleId}/assignments`).then(r => r.json());
                setAssignments(assignmentsRes);
            }
        } catch (err) {
            console.error("Failed to patch assignment:", err);
        }
    }, [assignments, scheduleId]);

    // 3. Toggle manual exclusions
    const handleToggleExclusion = useCallback(async (dayId, membershipId) => {
        try {
            const res = await fetch(`/api/exclusions/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day_id: dayId, membership_id: membershipId })
            });
            if (res.ok) {
                // Refresh exclusions to update the checkboxes
                const exclusionsRes = await fetch(`/api/exclusions/schedule/${scheduleId}`).then(r => r.json());
                setExclusions(exclusionsRes);
            }
        } catch (err) {
            console.error("Failed to toggle exclusion:", err);
        }
    }, [scheduleId]);

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
                    // 🟢 Passing the memoized handler here
                    onSelectDay={handleSelectDay}
                    assignments={assignments}
                    leaves={allLeaves}
                    exclusions={exclusions}
                    requiredStations={schedule?.required_stations || []}
                />

                {/* 2. SIDEBAR TABS */}
                <Paper sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
                    <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tab icon={<AssignmentIcon fontSize="small" />} label="Operations" />
                        <Tab icon={<SettingsIcon fontSize="small" />} label="Configure" />
                    </Tabs>

                    <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                        {activeTab === 0 && (
                            <DayDetailView
                                day={selectedDay}
                                requiredStations={schedule.required_stations}
                                memberships={schedule.memberships}
                                assignments={assignments.filter(a => a.day_id === selectedDay?.id)}
                                exclusions={exclusions.filter(e => e.day_id === selectedDay?.id)}
                                onUpdateDay={handleUpdateDay}
                                onAssign={handleAssign}
                                onToggleExclusion={handleToggleExclusion}
                            />
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
                                onOpenLeave={handleOpenLeaveDialog}
                                onDeleteLeave={handleDeleteLeave}
                            />
                        )}
                    </Box>
                </Paper>
            </Box>

            {/* ... Dialogs stay the same ... */}
        </Box>
    );
}
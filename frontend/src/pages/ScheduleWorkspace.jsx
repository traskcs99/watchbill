import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Breadcrumbs, Link, Paper,
    CircularProgress, Tabs, Tab
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';

// Sub-Components
import ScheduleCalendar from '../components/ScheduleCalendar';
import ConfigurationTab from '../components/ConfigurationTab';
import DayDetailView from '../components/DayDetailView';
import WorkloadTab from '../components/WorkloadTab';
import WeightDistributionDialog from '../components/WeightDistributionDialog';
import LeaveManagerDialog from '../components/LeaveManagerDialog';

// Helper for Accessibility Props
function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

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

    // Memoize selection
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
                fetchData();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (err) {
            console.error("Failed to save leave:", err);
        }
    };

    // Day Detail Handlers
    const handleUpdateDay = useCallback(async (dayId, updates) => {
        try {
            const res = await fetch(`/api/schedule-days/${dayId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, ...updates } : d));
                setSelectedDay(prev => prev?.id === dayId ? { ...prev, ...updates } : prev);
            }
        } catch (err) { console.error(err); }
    }, []);

    const handleAssign = useCallback(async (dayId, stationId, membershipId) => {
        const targetAssignment = assignments.find(
            a => a.day_id === dayId && a.station_id === stationId
        );
        if (!targetAssignment) return;

        try {
            const res = await fetch(`/api/assignments/${targetAssignment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    membership_id: membershipId || null,
                    is_locked: true
                })
            });
            if (res.ok) {
                const assignmentsRes = await fetch(`/api/schedules/${scheduleId}/assignments`).then(r => r.json());
                setAssignments(assignmentsRes);
            }
        } catch (err) { console.error(err); }
    }, [assignments, scheduleId]);

    const handleToggleExclusion = useCallback(async (dayId, membershipId) => {
        try {
            const res = await fetch(`/api/exclusions/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day_id: dayId, membership_id: membershipId })
            });
            if (res.ok) {
                const exclusionsRes = await fetch(`/api/exclusions/schedule/${scheduleId}`).then(r => r.json());
                setExclusions(exclusionsRes);
            }
        } catch (err) { console.error(err); }
    }, [scheduleId]);

    if (loading) return <Box p={5} textAlign="center"><CircularProgress /></Box>;
    if (!schedule) return <Typography p={5}>Schedule not found.</Typography>;

    return (
        // 🟢 1. Reduced Padding (p: 1) so it goes near the edge
        <Box sx={{ p: 1, bgcolor: '#f4f6f8', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* HEADER AREA */}
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1, px: 1 }}>
                <Link underline="hover" color="inherit" href="/">Schedules</Link>
                <Typography color="text.primary" fontWeight="bold">{schedule.name}</Typography>
            </Breadcrumbs>

            {/* MAIN LAYOUT AREA */}
            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, overflow: 'hidden' }}>

                {/* 2. CALENDAR (Flex: 3 = 75% Width) */}
                <Box sx={{ flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <ScheduleCalendar
                        days={days}
                        selectedDayId={selectedDay?.id}
                        onSelectDay={handleSelectDay}
                        assignments={assignments}
                        leaves={allLeaves}
                        exclusions={exclusions}
                        memberships={schedule.memberships}
                        requiredStations={schedule?.required_stations || []}
                    />
                </Box>

                {/* 3. SIDEBAR (Flex: 1 = 25% Width - Balanced) */}
                <Paper sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0',
                    minWidth: 350 // Prevent it from getting too squashed
                }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', minHeight: '60px' }}
                    >
                        <Tab icon={<AssignmentIcon fontSize="small" />} label="Ops" {...a11yProps(0)} />
                        <Tab icon={<SettingsIcon fontSize="small" />} label="Config" {...a11yProps(1)} />
                        <Tab icon={<BarChartIcon fontSize="small" />} label="Workload" {...a11yProps(2)} />
                    </Tabs>

                    <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto', bgcolor: '#fafafa' }}>
                        {activeTab === 0 && (
                            <DayDetailView
                                day={selectedDay}
                                days={days}
                                requiredStations={schedule.required_stations}
                                memberships={schedule.memberships}
                                allAssignments={assignments}
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

                        {activeTab === 2 && (
                            <WorkloadTab
                                scheduleId={scheduleId}
                                memberships={schedule.memberships || []}
                                assignments={assignments}
                                days={days}
                                stations={schedule.required_stations || []}
                            />
                        )}
                    </Box>
                </Paper>
            </Box>

            {/* Dialogs */}
            <WeightDistributionDialog
                open={weightDialogOpen}
                onClose={() => setWeightDialogOpen(false)}
                membership={editingMember}
                scheduleId={scheduleId}
                onSave={handleSaveWeights}
            />
            <LeaveManagerDialog
                open={leaveDialogOpen}
                onClose={() => setLeaveDialogOpen(false)}
                member={activeLeaveMember}
                onSave={handleSaveLeave}
            />

            {/* ... Other Dialogs ... */}
        </Box>
    );
}
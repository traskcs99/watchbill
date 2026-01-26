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
import AlertsList from '../components/AlertsList';
import MemberConfigDialog from '../components/MemberConfigDialog';

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
    const [allGroups, setAllGroups] = useState([]); // 🟢 Added Group State

    const [selectedDay, setSelectedDay] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Dialog & UI State
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [weightDialogOpen, setWeightDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [activeLeaveMember, setActiveLeaveMember] = useState(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [activeConfigMember, setActiveConfigMember] = useState(null);

    const [assignments, setAssignments] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [exclusions, setExclusions] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [highlightedMemberId, setHighlightedMemberId] = useState(null);

    // 🟢 DATA FETCHING
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [schData, masterRes, peopleRes, assignmentsRes, exclusionsRes, alertsRes, groupsRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}`).then(res => res.json()),
                fetch('/api/master-stations').then(res => res.json()),
                fetch('/api/personnel').then(res => res.json()),
                fetch(`/api/schedules/${scheduleId}/assignments`).then(res => res.ok ? res.json() : []),
                fetch(`/api/exclusions/schedule/${scheduleId}`).then(res => res.ok ? res.json() : []),
                fetch(`/api/schedules/${scheduleId}/alerts`).then(res => res.ok ? res.json() : []),
                fetch('/api/groups').then(res => res.json()) // 🟢 Added Group Fetch
            ]);

            setSchedule(schData);
            setSummary(schData);
            setDays(schData.days || []);
            setAllLeaves(schData.leaves_exploded || []);
            setMasterStations(masterRes);
            setAllPersonnel(peopleRes);
            setAssignments(assignmentsRes);
            setExclusions(exclusionsRes);
            setAlerts(alertsRes);
            setAllGroups(groupsRes); // 🟢 Set Group State
            setLoading(false);
        } catch (err) {
            console.error("Error loading workspace:", err);
            setLoading(false);
        }
    }, [scheduleId]);

    const refreshOperationalData = useCallback(async () => {
        try {
            const [assignmentsRes, exclusionsRes, alertsRes, schRes] = await Promise.all([
                fetch(`/api/schedules/${scheduleId}/assignments`).then(r => r.ok ? r.json() : []),
                fetch(`/api/exclusions/schedule/${scheduleId}`).then(r => r.ok ? r.json() : []),
                fetch(`/api/schedules/${scheduleId}/alerts`).then(r => r.ok ? r.json() : []),
                fetch(`/api/schedules/${scheduleId}`).then(r => r.json())
            ]);

            setAssignments(assignmentsRes);
            setExclusions(exclusionsRes);
            setAlerts(alertsRes);

            if (schRes && schRes.leaves_exploded) {
                setAllLeaves(schRes.leaves_exploded);
            }
        } catch (err) {
            console.error("Partial refresh failed:", err);
        }
    }, [scheduleId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 🟢 AI OPTIMIZATION HANDLER
    const handleSaveOptimizationSettings = async (configPayload) => {
        try {
            const res = await fetch(`/api/schedules/${scheduleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configPayload)
            });

            if (res.ok) {
                fetchData(); // Reload to sync weight data
                console.log("Optimization settings saved!");
            }
        } catch (err) {
            console.error("Error saving optimization settings:", err);
        }
    };

    // -- OTHER HANDLERS --
    const handleTabChange = useCallback((_, newValue) => setActiveTab(newValue), []);
    const handleSelectDay = useCallback((day) => setSelectedDay(day), []);

    const handleAddStation = async (stationId) => {
        const res = await fetch(`/api/schedules/${scheduleId}/stations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station_id: stationId }) });
        if (res.ok) { setIsStationDialogOpen(false); fetchData(); }
    };

    const handleRemoveStation = async (id) => { if (window.confirm("Remove?")) { await fetch(`/api/schedules/${scheduleId}/stations/${id}`, { method: 'DELETE' }); fetchData(); } };

    const handleAddMember = async (pid) => { const res = await fetch('/api/schedule-memberships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedule_id: parseInt(scheduleId), person_id: pid }) }); if (res.ok) { setIsMemberDialogOpen(false); fetchData(); } };

    const handleRemoveMember = async (id) => { if (window.confirm("Remove?")) { await fetch(`/api/schedule-memberships/${id}`, { method: 'DELETE' }); fetchData(); } };

    const handleOpenWeightSlider = (mem) => { if (!mem) return; setEditingMember(mem); setWeightDialogOpen(true); };

    const handleSaveWeights = async (membershipId, weights) => {
        const res = await fetch(`/api/schedule-memberships/${membershipId}/weights/distribute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weights }) });
        if (res.ok) { setWeightDialogOpen(false); fetchData(); }
    };

    const handleOpenMemberConfig = (member) => { setActiveConfigMember(member); setConfigDialogOpen(true); };

    const handleSaveMemberConfig = async (membershipId, configData) => {
        try {
            const res = await fetch(`/api/schedule-memberships/${membershipId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configData) });
            if (res.ok) { setConfigDialogOpen(false); fetchData(); }
        } catch (err) { console.error(err); }
    };

    const handleSaveLeave = async (membershipId, formData) => {
        try {
            const res = await fetch('/api/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membership_id: membershipId, start_date: formData.start_date, end_date: formData.end_date, reason: formData.reason }) });
            if (res.ok) { setLeaveDialogOpen(false); fetchData(); }
        } catch (err) { console.error(err); }
    };

    const handleDeleteLeave = async (leaveId) => { if (!window.confirm("Remove leave?")) return; const res = await fetch(`/api/leaves/${leaveId}`, { method: 'DELETE' }); if (res.ok) fetchData(); };

    const handleUpdateDay = useCallback(async (dayId, updates) => {
        try {
            const res = await fetch(`/api/schedule-days/${dayId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            if (res.ok) { setDays(prev => prev.map(d => d.id === dayId ? { ...d, ...updates } : d)); refreshOperationalData(); }
        } catch (err) { console.error(err); }
    }, [refreshOperationalData]);

    const handleAssign = useCallback(async (dayId, stationId, membershipId) => {
        const targetAssignment = assignments.find(a => a.day_id === dayId && a.station_id === stationId);
        if (!targetAssignment) return;
        try {
            const res = await fetch(`/api/assignments/${targetAssignment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membership_id: membershipId || null, is_locked: true }) });
            if (res.ok) { refreshOperationalData(); }
        } catch (err) { console.error(err); }
    }, [assignments, refreshOperationalData]);

    const handleToggleExclusion = useCallback(async (dayId, membershipId) => {
        try {
            const res = await fetch(`/api/exclusions/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day_id: dayId, membership_id: membershipId }) });
            if (res.ok) { refreshOperationalData(); }
        } catch (err) { console.error(err); }
    }, [refreshOperationalData]);
    const handleOpenLeaveDialog = (mem) => {
        setActiveLeaveMember(mem);
        setLeaveDialogOpen(true);
    };
    if (loading) return <Box p={5} textAlign="center"><CircularProgress /></Box>;
    if (!schedule) return <Typography p={5}>Schedule not found.</Typography>;

    return (
        <Box sx={{ p: 1, bgcolor: '#f4f6f8', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1, px: 1 }}>
                <Link underline="hover" color="inherit" href="/">Schedules</Link>
                <Typography color="text.primary" fontWeight="bold">{schedule.name}</Typography>
            </Breadcrumbs>

            <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, overflow: 'hidden' }}>
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
                        alerts={alerts}
                        highlightedMemberId={highlightedMemberId}
                    />
                </Box>

                <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0', minWidth: 350 }}>
                    <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', minHeight: '60px' }}>
                        <Tab icon={<AssignmentIcon fontSize="small" />} label="Ops" {...a11yProps(0)} />
                        <Tab icon={<SettingsIcon fontSize="small" />} label="Config" {...a11yProps(1)} />
                        <Tab icon={<BarChartIcon fontSize="small" />} label="Workload" {...a11yProps(2)} />
                    </Tabs>

                    <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto', bgcolor: '#fafafa' }}>
                        {activeTab === 0 && (
                            <Box>
                                <AlertsList alerts={alerts} />
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
                            </Box>
                        )}
                        {activeTab === 1 && (
                            <ConfigurationTab
                                summary={summary}
                                groups={allGroups}
                                masterStations={masterStations}
                                onRemoveStation={handleRemoveStation}
                                onAddStationClick={handleAddStation} onRemoveMember={handleRemoveMember}
                                onAddMemberClick={() => setIsMemberDialogOpen(true)}
                                onOpenWeightSlider={handleOpenWeightSlider}
                                onOpenLeave={handleOpenLeaveDialog}
                                onDeleteLeave={handleDeleteLeave}
                                onOpenMemberConfig={handleOpenMemberConfig}
                                onSaveSettings={handleSaveOptimizationSettings}
                                onRefresh={fetchData}
                            />
                        )}
                        {activeTab === 2 && (
                            <WorkloadTab
                                scheduleId={scheduleId}
                                memberships={schedule.memberships || []}
                                assignments={assignments}
                                days={days}
                                stations={schedule.required_stations || []}
                                exclusions={exclusions}
                                onToggleHighlight={(id) => setHighlightedMemberId(prev => prev === id ? null : id)}
                                highlightedMemberId={highlightedMemberId}
                            />
                        )}
                    </Box>
                </Paper>
            </Box>

            {/* Dialogs */}
            <WeightDistributionDialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} membership={editingMember} scheduleId={scheduleId} onSave={handleSaveWeights} />
            <LeaveManagerDialog open={leaveDialogOpen} onClose={() => setLeaveDialogOpen(false)} member={activeLeaveMember} onSave={handleSaveLeave} />
            <MemberConfigDialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} member={activeConfigMember} onSave={handleSaveMemberConfig} />
        </Box>
    );
}
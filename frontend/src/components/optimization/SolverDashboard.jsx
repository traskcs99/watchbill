import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Box, Button, Typography, Paper, CircularProgress,
    Stack, Alert, LinearProgress, Tooltip
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import axios from 'axios';
import CandidateCard from './CandidateCard';

export default function SolverDashboard({
    scheduleId,
    onScheduleUpdated,
    onToggleHighlight,
    masterStations,
    memberships = [],
    days = [],
    // 🟢 CRITICAL: This prop triggers the "Yellow/Modified" state
    scheduleUpdatedAt
}) {
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // 🟢 STATE: Track Active Candidate and Modification Status
    const [activeCandidateId, setActiveCandidateId] = useState(null);
    const [isModified, setIsModified] = useState(false);

    // Track if WE caused the update (to prevent turning yellow immediately)
    const isApplyingRef = useRef(false);

    // 🟢 1. LOAD STATE FROM STORAGE ON MOUNT (Fixes the reset issue)
    useEffect(() => {
        if (!scheduleId) return;
        const savedId = localStorage.getItem(`activeCandidate_${scheduleId}`);
        if (savedId) {
            console.log("Restoring Active Candidate:", savedId);
            setActiveCandidateId(Number(savedId));
        }
    }, [scheduleId]);

    // 🟢 2. DETECT MANUAL CHANGES
    useEffect(() => {
        // If the schedule data is missing, do nothing
        if (!scheduleUpdatedAt) return;

        // If we are currently applying a candidate, ignore this update (it's ours)
        if (isApplyingRef.current) {
            console.log("Update caused by Apply - Keeping Blue state");
            isApplyingRef.current = false; // Reset flag
            return;
        }

        // If we have an active candidate and the schedule refreshed from the outside...
        if (activeCandidateId !== null) {
            console.log("External Update Detected - Switching to Yellow state");
            setIsModified(true);
        }
    }, [scheduleUpdatedAt]); // 🟢 This now fires whenever the 'schedule' object changes

    // Filter Active Days
    const activeDayIds = useMemo(() => {
        return days.filter(d => !d.is_lookback).map(d => d.id);
    }, [days]);

    const fetchCandidates = async () => {
        try {
            const res = await axios.get(`/api/schedules/${scheduleId}/candidates`);
            setCandidates(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { if (scheduleId) fetchCandidates(); }, [scheduleId]);

    const handleRunSolver = async () => {
        setLoading(true); setProgress(0); setStatusMessage("Initializing..."); setError(null);

        // Reset State on new run
        setActiveCandidateId(null);
        setIsModified(false);
        localStorage.removeItem(`activeCandidate_${scheduleId}`);

        try {
            const response = await fetch(`/api/schedules/${scheduleId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num_candidates: 5 })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'progress') {
                            setProgress(data.percent);
                            setStatusMessage(data.message);
                        } else if (data.type === 'complete') {
                            setStatusMessage("Optimization Complete!");
                            fetchCandidates();
                        } else if (data.type === 'error') {
                            setError(data.message);
                        }
                    } catch (e) { console.error(e); }
                }
            }
        } catch (error) {
            setError("Failed to connect to solver.");
        } finally { setLoading(false); }
    };

    const handleClearSchedule = async () => {
        if (!window.confirm("Are you sure? This removes all unlocked assignments.")) return;
        setClearing(true);

        // Reset State
        setActiveCandidateId(null);
        setIsModified(false);
        localStorage.removeItem(`activeCandidate_${scheduleId}`);

        try {
            await axios.post(`/api/schedules/${scheduleId}/clear`);
            setCandidates([]);
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (e) { setError("Failed to clear schedule."); } finally { setClearing(false); }
    };

    const handleApplyCandidate = async (candidateId) => {
        setLoading(true);

        // 🟢 SET FLAG: We are about to update the schedule
        isApplyingRef.current = true;

        try {
            await axios.post(`/api/schedules/${scheduleId}/apply`, { candidate_id: candidateId });

            console.log("Applied Candidate:", candidateId);

            // 🟢 UPDATE STATE & SAVE
            setActiveCandidateId(candidateId);
            setIsModified(false);
            localStorage.setItem(`activeCandidate_${scheduleId}`, candidateId);

            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            setError("Failed to apply schedule.");
            isApplyingRef.current = false; // Reset on error
        } finally { setLoading(false); }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
                    <Typography variant="h6">AI Schedule Generator</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    The solver will generate 5 unique versions of the watchbill using your settings.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box display="flex" gap={2} mb={2}>
                    <Box sx={{ flex: 7 }}>
                        <Button
                            variant="contained"
                            size="large"
                            fullWidth
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                            onClick={handleRunSolver}
                            disabled={loading || clearing}
                            sx={{ height: '100%', whiteSpace: 'nowrap' }}
                        >
                            {loading ? "Working..." : "Run Solver"}
                        </Button>
                    </Box>
                    <Box sx={{ flex: 3 }}>
                        <Tooltip title="Clear Unlocked Assignments">
                            <span style={{ width: '100%', display: 'block', height: '100%' }}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="large"
                                    fullWidth
                                    onClick={handleClearSchedule}
                                    disabled={loading || clearing}
                                    sx={{ height: '100%', minWidth: '40px' }}
                                >
                                    {clearing ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>

                {loading && (
                    <Box sx={{ width: '100%', mt: 1 }}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="caption" color="text.secondary">{statusMessage}</Typography>
                            <Typography variant="caption" fontWeight="bold">{progress}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                )}
            </Paper>

            {candidates.length > 0 && !loading && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Generated Options</Typography>
                    <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 2, px: 1, pt: 2 }}>
                        {candidates.map((cand, index) => {
                            // 🟢 DETERMINE STATUS FOR CARD
                            let status = 'none';

                            // Ensure type safety (IDs might be string vs number)
                            if (String(cand.id) === String(activeCandidateId)) {
                                status = isModified ? 'changes' : 'displayed';
                            }

                            return (
                                <CandidateCard
                                    key={cand.id}
                                    candidate={cand}
                                    isBest={index === 0}

                                    // 🟢 PASS STATUS
                                    displayStatus={status}

                                    masterStations={masterStations}
                                    memberships={memberships}
                                    activeDayIds={activeDayIds}

                                    onApply={handleApplyCandidate}
                                    onToggleHighlight={onToggleHighlight}
                                />
                            );
                        })}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
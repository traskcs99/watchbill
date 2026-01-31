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
    scheduleUpdatedAt // 🟢 NEW PROP: Pass schedule.updated_at here
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

    // 🟢 REF: To track if an update was caused by US (the bot) or THEM (the user)
    const isApplyingRef = useRef(false);

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

    // 🟢 DETECT MANUAL CHANGES
    useEffect(() => {
        if (!scheduleUpdatedAt) return;

        // If we are currently applying a candidate, ignore this update (it's ours)
        if (isApplyingRef.current) {
            isApplyingRef.current = false; // Reset flag
            return;
        }

        // If we have an active candidate and the schedule updated 'externally', it's a manual change
        if (activeCandidateId !== null) {
            setIsModified(true);
        }
    }, [scheduleUpdatedAt, activeCandidateId]);

    const handleRunSolver = async () => {
        setLoading(true); setProgress(0); setStatusMessage("Initializing..."); setError(null);
        setActiveCandidateId(null);
        setIsModified(false);

        try {
            const response = await fetch(`/api/schedules/${scheduleId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num_candidates: 5 })
            });
            // ... (rest of streaming logic is same) ...
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

        // 🟢 RESET STATE
        setActiveCandidateId(null);
        setIsModified(false);

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

            // 🟢 UPDATE STATE: Set Active, clear Modified
            setActiveCandidateId(candidateId);
            setIsModified(false);

            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            setError("Failed to apply schedule.");
            isApplyingRef.current = false; // Reset on error
        } finally { setLoading(false); }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                {/* ... Header and Buttons (Unchanged) ... */}
                <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
                    <Typography variant="h6">AI Schedule Generator</Typography>
                </Box>

                {/* ... (Middle section same as before) ... */}

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

                {/* ... (Progress Bar same as before) ... */}
            </Paper>

            {candidates.length > 0 && !loading && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Generated Options</Typography>
                    <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 2, px: 1, pt: 1 }}> {/* Added pt:1 for top chips */}
                        {candidates.map((cand, index) => {
                            // 🟢 DETERMINE STATUS FOR CARD
                            let status = 'none';
                            if (cand.id === activeCandidateId) {
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
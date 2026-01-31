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
    scheduleUpdatedAt // Trigger for yellow "modified" state
}) {
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // State for tracking active candidate & modifications
    const [activeCandidateId, setActiveCandidateId] = useState(null);
    const [isModified, setIsModified] = useState(false);
    const isApplyingRef = useRef(false);

    // 1. Restore Active Candidate from LocalStorage on mount
    useEffect(() => {
        if (!scheduleId) return;
        const savedId = localStorage.getItem(`activeCandidate_${scheduleId}`);
        if (savedId) {
            setActiveCandidateId(Number(savedId));
        }
    }, [scheduleId]);

    // 2. Detect Manual Changes (Switch to Yellow)
    useEffect(() => {
        if (!scheduleUpdatedAt) return;
        if (isApplyingRef.current) {
            isApplyingRef.current = false; // Ignore updates caused by us
            return;
        }
        if (activeCandidateId !== null) {
            setIsModified(true); // Mark as modified if external update occurs
        }
    }, [scheduleUpdatedAt]);

    // Filter Active Day IDs
    const activeDayIds = useMemo(() => {
        return days.filter(d => !d.is_lookback).map(d => d.id);
    }, [days]);

    // Fetch existing candidates (load on start)
    const fetchCandidates = async () => {
        try {
            const res = await axios.get(`/api/schedules/${scheduleId}/candidates`);
            setCandidates(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { if (scheduleId) fetchCandidates(); }, [scheduleId]);

    // --- MAIN SOLVER LOGIC ---
    const handleRunSolver = async () => {
        setLoading(true);
        setProgress(0);
        setStatusMessage("Initializing...");
        setCandidates([]); // Clear UI immediately

        try {
            // 🟢 USE DIRECT URL: Bypasses the React Proxy buffer
            const response = await fetch(`http://127.0.0.1:5000/api/schedules/${scheduleId}/generate`, {
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
                buffer = lines.pop(); // Keep incomplete chunk in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line.trim());

                        if (data.type === 'progress') {
                            setProgress(data.percent);
                            setStatusMessage(data.message);
                            // Tiny pause to let the progress bar animate
                            await new Promise(r => setTimeout(r, 0));
                        }
                        else if (data.type === 'candidate') {
                            setCandidates(prev => {
                                // Prevent duplicates
                                if (prev.some(c => c.id === data.candidate.id)) return prev;
                                return [...prev, data.candidate];
                            });

                            // 🟢 PAINT BRAKE: Pause 50ms to let the browser draw the card
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        else if (data.type === 'complete') {
                            // Sync with DB at the end just to be safe
                            fetchCandidates();
                        }
                    } catch (e) { console.error("Parse error:", e); }
                }
            }
        } catch (error) {
            console.error("Solver Error:", error);
            setError("Failed to connect to solver.");
        } finally { setLoading(false); }
    };

    const handleClearSchedule = async () => {
        if (!window.confirm("Are you sure? This removes all unlocked assignments.")) return;
        setClearing(true);
        setActiveCandidateId(null);
        setIsModified(false);
        localStorage.removeItem(`activeCandidate_${scheduleId}`);

        try {
            await axios.post(`/api/schedules/${scheduleId}/clear`);
            setCandidates([]); // Clear UI
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (e) { setError("Failed to clear schedule."); } finally { setClearing(false); }
    };

    const handleApplyCandidate = async (candidateId) => {
        setLoading(true);
        isApplyingRef.current = true; // Flag to ignore the upcoming update event

        try {
            await axios.post(`/api/schedules/${scheduleId}/apply`, { candidate_id: candidateId });
            setActiveCandidateId(candidateId);
            setIsModified(false); // Reset to Blue state
            localStorage.setItem(`activeCandidate_${scheduleId}`, candidateId);

            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            setError("Failed to apply schedule.");
            isApplyingRef.current = false;
        } finally { setLoading(false); }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
                    <Typography variant="h6">AI Schedule Generator</Typography>
                </Box>

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
                            sx={{ height: '100%' }}
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
                                    sx={{ height: '100%' }}
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
                            <Typography variant="caption">{statusMessage}</Typography>
                            <Typography variant="caption" fontWeight="bold">{progress}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                )}
            </Paper>

            {/* 🟢 CRITICAL FIX: Removed '!loading' check. Cards now show immediately. */}
            {candidates.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Generated Options
                        {loading && <span style={{ opacity: 0.5, fontSize: '0.8em' }}> (Streaming...)</span>}
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 2, px: 1, pt: 2 }}>
                        {candidates.map((cand, index) => {
                            // Logic for Blue/Yellow status
                            let status = 'none';
                            if (String(cand.id) === String(activeCandidateId)) {
                                status = isModified ? 'changes' : 'displayed';
                            }

                            return (
                                <CandidateCard
                                    key={cand.id}
                                    candidate={cand}
                                    isBest={index === 0}
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
import React, { useState } from 'react';
import {
    Box, Button, Typography, Paper, CircularProgress,
    Stack, Alert, Divider, IconButton, Tooltip
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import CandidateCard from '../optimization/CandidateCard';

export default function SolverDashboard({ scheduleId, onScheduleUpdated }) {
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [error, setError] = useState(null);

    // 1. Trigger the Backend Solver
    const handleRunSolver = async () => {
        setLoading(true);
        setError(null);
        try {
            // Step A: Generate 5 candidates
            await axios.post(`/api/schedules/${scheduleId}/generate`, { num_candidates: 5 });

            // Step B: Fetch the candidates we just made
            const response = await axios.get(`/api/schedules/${scheduleId}/candidates`);
            setCandidates(response.data);
        } catch (err) {
            console.error("Solver Error:", err);
            setError(err.response?.data?.message || "The solver encountered a mathematical error. Check your constraints.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Apply a specific candidate to the live schedule
    const handleApplyCandidate = async (candidateId) => {
        setLoading(true);
        try {
            await axios.post(`/api/schedules/${scheduleId}/candidates/${candidateId}/apply`);
            setCandidates([]); // Clear candidates after applying
            if (onScheduleUpdated) onScheduleUpdated();
        } catch (err) {
            setError("Failed to apply the selected schedule.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
                    <AutoAwesomeIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
                    <Typography variant="h6">AI Schedule Generator</Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    The solver will generate 5 unique versions of the watchbill using your
                    Goat Point settings and Rank Protection factors.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    onClick={handleRunSolver}
                    disabled={loading}
                >
                    {loading ? "Calculating Optimal Paths..." : "Run Optimization Solver"}
                </Button>
            </Paper>

            {/* CANDIDATE RESULTS GRID */}
            {candidates.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Generated Candidates (Ranked by Fairness)
                    </Typography>
                    <Stack
                        direction="row"
                        spacing={2}
                        sx={{
                            overflowX: 'auto',
                            pb: 2,
                            px: 1,
                            '&::-webkit-scrollbar': { height: 8 },
                            '&::-webkit-scrollbar-thumb': { bgcolor: '#ccc', borderRadius: 4 }
                        }}
                    >
                        {candidates.map((cand, index) => (
                            <CandidateCard
                                key={cand.id}
                                candidate={cand}
                                isBest={index === 0}
                                onApply={handleApplyCandidate}
                            />
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
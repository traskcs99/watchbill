import React, { useState } from 'react';
import { Box, Button, CircularProgress, Card, Typography, Stack, Chip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';

export default function SolverDashboard({ scheduleId, onApply }) {
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);

    const runSolver = async () => {
        setLoading(true);
        try {
            // 1. Trigger Backend
            await fetch(`/api/schedules/${scheduleId}/generate`, { method: 'POST' });
            // 2. Fetch results
            const res = await fetch(`/api/schedules/${scheduleId}/candidates`);
            const data = await res.json();
            setCandidates(data);
        } catch (e) {
            console.error("Solver failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Button
                fullWidth variant="contained" size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                onClick={runSolver} disabled={loading}
            >
                {loading ? "Engine Solving..." : "Generate 5 Candidates"}
            </Button>

            <Stack direction="row" spacing={2} sx={{ mt: 3, overflowX: 'auto', pb: 2 }}>
                {candidates.map((cand, index) => (
                    <Card key={cand.id} sx={{ minWidth: 250, p: 2, border: index === 0 ? '2px solid #2e7d32' : '1px solid #ddd' }}>
                        <Typography variant="h6">Option {index + 1}</Typography>
                        <Typography variant="body2">Total Pain Score: {cand.score}</Typography>
                        <Chip label={index === 0 ? "Most Fair" : "Alternative"} size="small" color={index === 0 ? "success" : "default"} sx={{ my: 1 }} />

                        <Button
                            fullWidth variant="outlined" sx={{ mt: 2 }}
                            onClick={() => onApply(cand.id)}
                        >
                            Apply This One
                        </Button>
                    </Card>
                ))}
            </Stack>
        </Box>
    );
}
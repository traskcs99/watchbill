import React from 'react';
import { Box, Paper, Typography, Chip, Stack } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import BlockIcon from '@mui/icons-material/Block';
import EventBusyIcon from '@mui/icons-material/EventBusy';

const getTypeIcon = (type) => {
    switch (type) {
        case 'DOUBLE_BOOKING': return <ErrorIcon color="error" fontSize="small" />;
        case 'LEAVE_CONFLICT': return <EventBusyIcon color="warning" fontSize="small" />;
        case 'EXCLUSION_CONFLICT': return <BlockIcon color="error" fontSize="small" />;
        case 'BACK_TO_BACK': return <WarningIcon color="warning" fontSize="small" />;
        default: return <WarningIcon fontSize="small" />;
    }
};

export default function AlertsList({ alerts }) {
    if (!alerts || alerts.length === 0) return null;

    return (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#fff4f4', borderColor: '#ffcdd2' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="error" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon fontSize="small" /> Schedule Conflicts ({alerts.length})
            </Typography>

            <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {alerts.map((alert, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'start', bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #eee' }}>
                        <Box sx={{ mt: 0.5 }}>{getTypeIcon(alert.type)}</Box>
                        <Box>
                            <Typography variant="caption" fontWeight="bold" display="block">
                                {alert.date} — {alert.member}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                                {alert.message}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
}
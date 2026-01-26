import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, TextField
} from '@mui/material';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './datepicker-custom.css'; // We'll add a tiny bit of styling

export default function LeaveManagerDialog({ open, onClose, member, onSave }) {
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) {
            setStartDate(null);
            setEndDate(null);
            setReason('');
        }
    }, [open]);

    const onChange = (dates) => {
        const [start, end] = dates;
        setStartDate(start);
        setEndDate(end);
    };

    const handleSubmit = () => {
        if (!startDate || !endDate) {
            alert("Please select a range.");
            return;
        }

        // Format dates to YYYY-MM-DD for your Flask backend
        const formatDate = (date) => date.toISOString().split('T')[0];

        onSave(member.id, {
            start_date: formatDate(startDate),
            end_date: formatDate(endDate),
            reason: reason
        });
    };

    if (!member) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                Add Leave Period
                <Typography variant="subtitle2" color="text.secondary" component="div" sx={{ display: 'block' }}>
                    Personnel: {member.person_name}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="caption" color="primary" fontWeight="bold">
                        SELECT START & END DATE
                    </Typography>

                    {/* The Range Calendar */}
                    <DatePicker
                        selected={startDate}
                        onChange={onChange}
                        startDate={startDate}
                        endDate={endDate}
                        selectsRange
                        inline // Shows the calendar directly without clicking an input
                    />

                    <TextField
                        label="Reason / Note"
                        fullWidth
                        size="small"
                        placeholder="e.g. Vacation"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!endDate}>
                    Save Range
                </Button>
            </DialogActions>
        </Dialog>
    );
}
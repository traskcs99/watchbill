import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, TextField
} from '@mui/material';

export default function LeaveManagerDialog({ open, onClose, member, onSave }) {
    const [formData, setFormData] = useState({
        start_date: '',
        end_date: '',
        reason: ''
    });

    // Reset the form every time the dialog opens for a member
    useEffect(() => {
        if (open && member) {
            setFormData({
                start_date: '',
                end_date: '',
                reason: ''
            });
        }
    }, [open, member]);

    const handleSubmit = () => {
        if (!formData.start_date || !formData.end_date) {
            alert("Please select both a start and end date.");
            return;
        }
        // Pass the data back to the Workspace handler
        onSave(member.id, formData);
    };

    if (!member) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                Add Leave Period
                <Typography variant="subtitle2" color="text.secondary"
                    component="span" // <--- ADD THIS LINE
                    sx={{ display: 'block' }}>
                    Personnel: {member.person_name}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        label="Start Date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                    <TextField
                        label="End Date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                    <TextField
                        label="Reason / Note"
                        fullWidth
                        placeholder="e.g. Vacation, Training"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" color="primary" onClick={handleSubmit}>
                    Save Leave
                </Button>
            </DialogActions>
        </Dialog>
    );
}
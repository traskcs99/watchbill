import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box
} from '@mui/material';

export default function CreateScheduleDialog({ open, onClose, onCreated }) {
    // Local state for the form inputs
    const [formData, setFormData] = useState({
        name: '',
        start_date: '',
        end_date: '',
        status: 'draft'
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = () => {
        // 1. Send the data to your Flask API
        // Ensure your backend endpoint is /api/schedules
        fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to create schedule');
                return res.json();
            })
            .then(newSchedule => {
                // 2. Tell the Dashboard we finished successfully
                onCreated(newSchedule);
                // 3. Reset form and close
                setFormData({ name: '', start_date: '', end_date: '', status: 'draft' });
                onClose();
            })
            .catch(err => console.error("Error creating schedule:", err));
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 'bold' }}>New Schedule</DialogTitle>

            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <TextField
                        label="Schedule Name"
                        name="name"
                        fullWidth
                        variant="outlined"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. September 2026"
                    />

                    <TextField
                        label="Start Date"
                        name="start_date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={formData.start_date}
                        onChange={handleChange}
                    />

                    <TextField
                        label="End Date"
                        name="end_date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        value={formData.end_date}
                        onChange={handleChange}
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disableElevation>
                    Create Schedule
                </Button>
            </DialogActions>
        </Dialog>
    );
}
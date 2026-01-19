import { useState, useEffect } from 'react';
import { Typography, Fab, Box, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

// Assumes you have these components created
import ScheduleCard from '../components/ScheduleCard';
import CreateScheduleDialog from '../components/CreateScheduleDialog';

export default function Dashboard() {
    const [schedules, setSchedules] = useState([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        fetch('/api/schedules')
            .then(res => res.json())
            .then(data => setSchedules(data))
            .catch(err => console.error("Error fetching schedules:", err));
    }, []);

    const handleCreated = (newSchedule) => {
        setSchedules([...schedules, newSchedule]);
    };

    const handleDelete = (id) => {
        setSchedules(prev => prev.filter(s => s.id !== id));
        fetch(`/api/schedules/${id}`, { method: 'DELETE' }).catch(err => console.error("Error deleting schedule:", err));
    };

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
                    Schedules
                </Typography>

                <Fab color="primary" aria-label="add" onClick={() => setOpen(true)}>
                    <AddIcon />
                </Fab>
            </Box>

            <Grid container spacing={3}>
                {schedules.length === 0 ? (
                    <Grid item xs={12}>
                        <Typography variant="body1" color="text.secondary" align="center">
                            No schedules found. Click the + button to create one.
                        </Typography>
                    </Grid>
                ) : (
                    schedules.map((sch) => (
                        <Grid item xs={12} sm={6} md={4} key={sch.id}>
                            {/* Passing delete handler down so the button on the card works */}
                            <ScheduleCard schedule={sch} onDelete={handleDelete} />                        </Grid>
                    ))
                )}
            </Grid>

            <CreateScheduleDialog
                open={open}
                onClose={() => setOpen(false)}
                onCreated={handleCreated}
            />
        </Box>
    );
}
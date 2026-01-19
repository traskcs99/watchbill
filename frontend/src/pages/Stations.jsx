import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Tooltip, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalPoliceIcon from '@mui/icons-material/LocalPolice';

export default function Stations() {
    const [stations, setStations] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', abbr: '' });

    // 1. Fetch Data
    useEffect(() => {
        fetchStations();
    }, []);

    const fetchStations = () => {
        fetch('/api/master-stations')
            .then(res => res.json())
            .then(data => setStations(data))
            .catch(err => console.error("Error:", err));
    };

    // 2. Open Dialog (Reset or Pre-fill)
    const handleOpen = (station = null) => {
        if (station) {
            setEditingId(station.id);
            setFormData({ name: station.name, abbr: station.abbr });
        } else {
            setEditingId(null);
            setFormData({ name: '', abbr: '' });
        }
        setOpen(true);
    };

    // 3. Submit (Create vs Update)
    const handleSubmit = () => {
        // If editing, use PUT (your backend requires both fields, which we are sending)
        const url = editingId ? `/api/master-stations/${editingId}` : '/api/master-stations';
        const method = editingId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) return res.json().then(err => { throw new Error(err.error) });
                return res.json();
            })
            .then(() => {
                fetchStations();
                setOpen(false);
            })
            .catch(err => alert(`Error: ${err.message}`));
    };

    // 4. Delete
    const handleDelete = (id, name) => {
        if (!window.confirm(`Are you sure you want to delete '${name}'?`)) return;

        fetch(`/api/master-stations/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) fetchStations();
                else alert("Failed to delete. It might be in use.");
            });
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
            {/* HEADER */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Master Stations</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Define the global list of watch positions (e.g., OOD, Rover).
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
                    New Station
                </Button>
            </Box>

            {/* TABLE */}
            <TableContainer component={Paper} elevation={2}>
                <Table>
                    <TableHead sx={{ bgcolor: 'primary.light' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Station Name</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Abbreviation</TableCell>
                            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No stations defined. Click "New Station" to begin.
                                </TableCell>
                            </TableRow>
                        ) : (
                            stations.map((station) => (
                                <TableRow key={station.id} hover>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <LocalPoliceIcon color="action" />
                                            <Typography variant="subtitle1">{station.name}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={station.abbr}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontWeight: 'bold', minWidth: 60 }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleOpen(station)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(station.id, station.name)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* DIALOG */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{editingId ? "Edit Station" : "New Station"}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            label="Station Name"
                            placeholder="e.g. Officer of the Deck"
                            fullWidth
                            autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        <TextField
                            label="Abbreviation"
                            placeholder="e.g. OOD"
                            fullWidth
                            helperText="Short code (max 5-6 chars)"
                            value={formData.abbr}
                            onChange={(e) => setFormData({ ...formData, abbr: e.target.value.toUpperCase() })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={!formData.name || !formData.abbr}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
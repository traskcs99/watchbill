import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControl, InputLabel, Select, MenuItem, Chip,
    FormControlLabel, Switch, IconButton, Tooltip,
    Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export default function Personnel() {
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        group_id: '',
        is_active: true
    });

    // 1. Fetch Data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        fetch('/api/personnel').then(res => res.json()).then(setMembers);
        fetch('/api/groups').then(res => res.json()).then(setGroups);
    };

    // 2. Open Dialog
    const handleOpen = (person = null) => {
        if (person) {
            setEditingId(person.id);
            setFormData({
                name: person.name,
                group_id: person.group_id || '',
                is_active: person.is_active
            });
        } else {
            setEditingId(null);
            setFormData({ name: '', group_id: '', is_active: true });
        }
        setOpen(true);
    };

    // 3. Submit
    const handleSubmit = () => {
        const url = editingId ? `/api/personnel/${editingId}` : '/api/personnel';
        const method = editingId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) throw new Error('Operation failed');
                return res.json();
            })
            .then(() => {
                fetchData();
                setOpen(false);
            })
            .catch(err => console.error(err));
    };

    // 4. Delete
    const handleDelete = (id, name) => {
        if (!window.confirm(`Delete ${name}?`)) return;
        fetch(`/api/personnel/${id}`, { method: 'DELETE' })
            .then(res => { if (res.ok) fetchData(); });
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
            {/* HEADER - Matches Stations Style */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Personnel</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage your roster, active status, and rank/group assignments.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
                    Add Sailor
                </Button>
            </Box>

            {/* TABLE - Matches Stations Style */}
            <TableContainer component={Paper} elevation={2}>
                <Table>
                    <TableHead sx={{ bgcolor: 'primary.light' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Group / Rank</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {members.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No personnel found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            members.map((person) => (
                                <TableRow key={person.id} hover>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={1.5}>
                                            <PersonIcon color={person.is_active ? "primary" : "disabled"} />
                                            <Typography variant="subtitle1" color={person.is_active ? "textPrimary" : "textSecondary"}>
                                                {person.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {person.group_name ? (
                                            <Chip label={person.group_name} size="small" variant="outlined" />
                                        ) : (
                                            <Typography variant="caption" color="text.secondary" fontStyle="italic">Unassigned</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {person.is_active ? (
                                            <Chip icon={<CheckCircleIcon />} label="Active" color="success" size="small" variant="outlined" />
                                        ) : (
                                            <Chip icon={<CancelIcon />} label="Inactive" color="default" size="small" variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleOpen(person)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(person.id, person.name)}>
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
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{editingId ? "Edit Sailor" : "Add New Sailor"}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            autoFocus label="Full Name" fullWidth
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Group / Rank</InputLabel>
                            <Select
                                value={formData.group_id}
                                label="Group / Rank"
                                onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                            >
                                <MenuItem value=""><em>None</em></MenuItem>
                                {groups.map((g) => (
                                    <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Switch checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                            }
                            label={formData.is_active ? "Status: Active" : "Status: Inactive"}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={!formData.name}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
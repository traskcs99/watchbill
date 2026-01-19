import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControl, InputLabel, Select, MenuItem, Chip,
    FormControlLabel, Switch, IconButton, Tooltip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
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
    const [editingId, setEditingId] = useState(null); // Track if we are editing

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
        // Fetch Personnel
        fetch('/api/personnel')
            .then(res => res.json())
            .then(data => setMembers(data))
            .catch(err => console.error(err));

        // Fetch Groups
        fetch('/api/groups')
            .then(res => res.json())
            .then(data => setGroups(data))
            .catch(err => console.error(err));
    };

    // 2. Open Dialog (Create vs Edit)
    const handleOpen = (person = null) => {
        if (person) {
            // EDIT MODE
            setEditingId(person.id);
            setFormData({
                name: person.name,
                group_id: person.group_id || '', // Handle null group
                is_active: person.is_active
            });
        } else {
            // CREATE MODE
            setEditingId(null);
            setFormData({ name: '', group_id: '', is_active: true });
        }
        setOpen(true);
    };

    // 3. Submit (Create or Update)
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
                fetchData(); // Refresh list to get updated names/groups
                setOpen(false);
            })
            .catch(err => console.error(err));
    };

    // 4. Delete
    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this person?")) return;

        fetch(`/api/personnel/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    setMembers(members.filter((m) => m.id !== id));
                }
            });
    };

    const columns = [
        {
            field: 'name',
            headerName: 'Name',
            width: 220,
            renderCell: (params) => (
                <Box display="flex" alignItems="center" gap={1}>
                    <PersonIcon color={params.row.is_active ? "primary" : "disabled"} fontSize="small" />
                    <Typography color={params.row.is_active ? "textPrimary" : "textSecondary"}>
                        {params.value}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'group_name',
            headerName: 'Group',
            width: 180,
            valueGetter: (value, row) => row.group_name || 'Unassigned',
            renderCell: (params) => (
                params.value !== 'Unassigned' ? (
                    <Chip label={params.value} size="small" variant="outlined" />
                ) : (
                    <Typography variant="caption" color="text.secondary" fontStyle="italic">None</Typography>
                )
            )
        },
        {
            field: 'is_active',
            headerName: 'Status',
            width: 100,
            renderCell: (params) => (
                params.value ?
                    <Box color="success.main" display="flex" alignItems="center" gap={0.5}><CheckCircleIcon fontSize="small" /> Active</Box> :
                    <Box color="error.main" display="flex" alignItems="center" gap={0.5}><CancelIcon fontSize="small" /> Inactive</Box>
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpen(params.row)}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold">Personnel Roster</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpen(null)}
                >
                    Add Sailor
                </Button>
            </Box>

            <DataGrid
                rows={members}
                columns={columns}
                initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                sx={{ bgcolor: 'white', boxShadow: 1 }}
            />

            {/* CREATE / EDIT DIALOG */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{editingId ? "Edit Sailor" : "Add New Sailor"}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>

                        {/* NAME INPUT */}
                        <TextField
                            autoFocus
                            label="Full Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            fullWidth
                        />

                        {/* GROUP SELECTOR */}
                        <FormControl fullWidth>
                            <InputLabel>Group / Rank</InputLabel>
                            <Select
                                value={formData.group_id}
                                label="Group / Rank"
                                onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                            >
                                <MenuItem value=""><em>None</em></MenuItem>
                                {groups.map((g) => (
                                    <MenuItem key={g.id} value={g.id}>
                                        {g.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* ACTIVE SWITCH */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                            }
                            label={formData.is_active ? "Status: Active" : "Status: Inactive (On Leave/Transfer)"}
                        />

                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={!formData.name}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
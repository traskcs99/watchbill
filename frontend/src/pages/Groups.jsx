import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Grid
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupWorkIcon from '@mui/icons-material/GroupWork';

export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State matching your DB Model
    const [formData, setFormData] = useState({
        name: '',
        priority: 10,
        min_assignments: 0,
        max_assignments: 8,
        seniorityFactor: 1.0
    });

    // 1. Fetch Groups
    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = () => {
        fetch('/api/groups')
            .then(res => res.json())
            .then(data => setGroups(data))
            .catch(err => console.error(err));
    };

    // 2. Open Dialog (Create vs Edit)
    const handleOpen = (group = null) => {
        if (group) {
            setEditingId(group.id);
            setFormData({
                name: group.name,
                priority: group.priority,
                min_assignments: group.min_assignments,
                max_assignments: group.max_assignments,
                seniorityFactor: group.seniorityFactor
            });
        } else {
            setEditingId(null);
            setFormData({ name: '', priority: 10, min_assignments: 0, max_assignments: 8, seniorityFactor: 1.0 });
        }
        setOpen(true);
    };

    // 3. Submit (Create or Update)
    const handleSubmit = () => {
        const url = editingId ? `/api/groups/${editingId}` : '/api/groups';
        const method = editingId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) throw new Error('Action failed');
                return res.json();
            })
            .then(() => {
                fetchGroups(); // Refresh list
                setOpen(false);
            })
            .catch(err => console.error(err));
    };

    // 4. Delete
    const handleDelete = (id) => {
        if (!window.confirm("Delete this group? Personnel in this group will be unassigned.")) return;

        fetch(`/api/groups/${id}`, { method: 'DELETE' })
            .then(() => fetchGroups());
    };

    // 5. Columns
    const columns = [
        { field: 'priority', headerName: 'Priority', width: 90, type: 'number' },
        {
            field: 'name',
            headerName: 'Group Name',
            width: 200,
            renderCell: (params) => (
                <Box display="flex" alignItems="center" gap={1}>
                    <GroupWorkIcon color="primary" fontSize="small" />
                    <Typography variant="body2" fontWeight="bold">{params.value}</Typography>
                </Box>
            )
        },
        { field: 'min_assignments', headerName: 'Min Watch', width: 110, type: 'number' },
        { field: 'max_assignments', headerName: 'Max Watch', width: 110, type: 'number' },
        { field: 'seniorityFactor', headerName: 'Factor', width: 100, type: 'number' },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 200,
            renderCell: (params) => (
                <Box>
                    <Button startIcon={<EditIcon />} size="small" onClick={() => handleOpen(params.row)}>
                        Edit
                    </Button>
                    <Button startIcon={<DeleteIcon />} size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                        Delete
                    </Button>
                </Box>
            )
        }
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold">Watchbill Groups</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
                    Create Group
                </Button>
            </Box>

            <DataGrid
                rows={groups}
                columns={columns}
                initialState={{
                    sorting: { sortModel: [{ field: 'priority', sort: 'asc' }] },
                }}
                pageSizeOptions={[10]}
                disableRowSelectionOnClick
                sx={{ bgcolor: 'white', boxShadow: 1 }}
            />

            {/* DIALOG FORM */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editingId ? "Edit Group" : "New Group"}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                label="Group Name (e.g. Officers, Section 1)"
                                fullWidth
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Min Watches (Per Month)"
                                type="number" fullWidth
                                value={formData.min_assignments}
                                onChange={(e) => setFormData({ ...formData, min_assignments: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Max Watches (Per Month)"
                                type="number" fullWidth
                                value={formData.max_assignments}
                                onChange={(e) => setFormData({ ...formData, max_assignments: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Priority (1 = Highest)"
                                type="number" fullWidth
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                label="Seniority Factor (Default 1.0)"
                                type="number" fullWidth inputProps={{ step: "0.1" }}
                                value={formData.seniorityFactor}
                                onChange={(e) => setFormData({ ...formData, seniorityFactor: parseFloat(e.target.value) })}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={!formData.name}>
                        Save Group
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
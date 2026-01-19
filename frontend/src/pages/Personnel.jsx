import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControl, InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';

export default function Personnel() {
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]); // We need groups for the dropdown
    const [open, setOpen] = useState(false);

    // Matches your Person model
    const [formData, setFormData] = useState({
        name: '',
        group_id: '',
        is_active: true
    });

    // 1. Fetch Data (People AND Groups)
    useEffect(() => {
        // Fetch Personnel
        fetch('/api/personnel')
            .then(res => res.json())
            .then(data => setMembers(data))
            .catch(err => console.error("Error fetching personnel:", err));

        // Fetch Groups (for the dropdown)
        fetch('/api/groups')
            .then(res => res.json())
            .then(data => setGroups(data))
            .catch(err => console.error("Error fetching groups:", err));
    }, []);

    // 2. Handle Create (POST /api/personnel)
    const handleCreate = () => {
        fetch('/api/personnel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to create');
                return res.json();
            })
            .then(newMember => {
                // The backend returns the new member, but might not include group_name immediately
                // We manually attach the group name for the UI update
                const group = groups.find(g => g.id === newMember.group_id);
                const memberWithGroup = { ...newMember, group_name: group ? group.name : '' };

                setMembers([...members, memberWithGroup]);
                setOpen(false);
                setFormData({ name: '', group_id: '', is_active: true });
            })
            .catch(err => console.error(err));
    };

    // 3. Handle Delete (DELETE /api/personnel/<id>)
    const handleDelete = (id) => {
        if (!window.confirm("Are you sure you want to delete this person?")) return;

        fetch(`/api/personnel/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    setMembers(members.filter((m) => m.id !== id));
                }
            });
    };

    // 4. Helper to find Group Name by ID (for the table)
    const getGroupName = (params) => {
        return params.row.group_name || 'Unassigned';
    };

    // 5. Table Columns
    const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'name',
            headerName: 'Name',
            width: 200,
            renderCell: (params) => (
                <Box display="flex" alignItems="center" gap={1}>
                    <PersonIcon color="action" fontSize="small" />
                    {params.value}
                </Box>
            )
        },
        {
            field: 'group_name',
            headerName: 'Group / Rank',
            width: 150,
            valueGetter: (value, row) => row.group_name || 'None',
            renderCell: (params) => (
                params.value !== 'None' ? <Chip label={params.value} size="small" color="primary" variant="outlined" /> : null
            )
        },
        {
            field: 'is_active',
            headerName: 'Status',
            width: 120,
            type: 'boolean'
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            renderCell: (params) => (
                <Button
                    startIcon={<DeleteIcon />}
                    color="error"
                    size="small"
                    onClick={() => handleDelete(params.row.id)}
                >
                    Delete
                </Button>
            )
        }
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold">Personnel</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpen(true)}
                >
                    Add Person
                </Button>
            </Box>

            {/* The Data Grid */}
            <DataGrid
                rows={members}
                columns={columns}
                initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                }}
                pageSizeOptions={[10, 25, 50]}
                checkboxSelection
                disableRowSelectionOnClick
                sx={{ bgcolor: 'white', boxShadow: 1 }}
            />

            {/* CREATE DIALOG */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Add New Person</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={3} mt={1}>
                        <TextField
                            autoFocus
                            label="Full Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            fullWidth
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
                                    <MenuItem key={g.id} value={g.id}>
                                        {g.name} (Priority: {g.priority})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate} disabled={!formData.name}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
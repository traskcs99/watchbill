import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Divider
} from '@mui/material';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// --- COMPONENT: Single Draggable Row (Styled like a Table Row) ---
function SortableGroupItem({ group, onEdit, onDelete }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging
    } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <Box
            ref={setNodeRef}
            style={style}
            sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                bgcolor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
                opacity: isDragging ? 0.6 : 1,
                '&:hover': { bgcolor: 'action.hover' } // Table hover effect
            }}
        >
            {/* 1. Drag Handle + Priority */}
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    cursor: 'grab', mr: 2, display: 'flex', alignItems: 'center', color: 'text.secondary',
                    width: '60px'
                }}
            >
                <DragIndicatorIcon fontSize="small" />
                <Typography variant="body2" sx={{ ml: 1, fontWeight: 'bold' }}>
                    #{group.priority}
                </Typography>
            </Box>

            {/* 2. Name */}
            <Box sx={{ flexGrow: 1, minWidth: '200px' }}>
                <Typography variant="subtitle1" fontWeight="500">
                    {group.name}
                </Typography>
            </Box>

            {/* 3. Details (Simulating Table Columns) */}
            <Box sx={{ width: '250px', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" color="text.secondary">
                    Watches: {group.min_assignments}-{group.max_assignments} • Factor: {group.seniorityFactor}
                </Typography>
            </Box>

            {/* 4. Actions */}
            <Box>
                <IconButton size="small" onClick={() => onEdit(group)}>
                    <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(group.id)}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
        </Box>
    );
}

// --- MAIN PAGE ---
export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', min_assignments: 0, max_assignments: 8, seniorityFactor: 1.0
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => { fetchGroups(); }, []);

    const fetchGroups = () => {
        fetch('/api/groups').then(res => res.json())
            .then(data => setGroups(data.sort((a, b) => a.priority - b.priority)));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setGroups((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                const updated = newOrder.map((g, idx) => ({ ...g, priority: idx + 1 }));

                // Save to Backend
                fetch('/api/groups/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: updated.map(g => g.id) })
                });
                return updated;
            });
        }
    };

    const handleOpen = (group = null) => {
        if (group) {
            setEditingId(group.id);
            setFormData({
                name: group.name, min_assignments: group.min_assignments,
                max_assignments: group.max_assignments, seniorityFactor: group.seniorityFactor
            });
        } else {
            setEditingId(null);
            setFormData({ name: '', min_assignments: 0, max_assignments: 8, seniorityFactor: 1.0 });
        }
        setOpen(true);
    };

    const handleSubmit = () => {
        const url = editingId ? `/api/groups/${editingId}` : '/api/groups';
        const method = editingId ? 'PUT' : 'POST';
        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        }).then(() => { fetchGroups(); setOpen(false); });
    };

    const handleDelete = (id) => {
        if (!window.confirm("Delete this group?")) return;
        fetch(`/api/groups/${id}`, { method: 'DELETE' }).then(() => fetchGroups());
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
            {/* HEADER */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Groups & Priority</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Drag rows to reorder priority. Top group gets filled first.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
                    New Group
                </Button>
            </Box>

            {/* TABLE-LIKE CONTAINER */}
            <Paper elevation={2} sx={{ overflow: 'hidden' }}>
                {/* FAKE TABLE HEADER */}
                <Box sx={{
                    display: 'flex', p: 2, bgcolor: 'primary.light', color: 'white', fontWeight: 'bold'
                }}>
                    <Box sx={{ width: '60px' }}>Prio</Box>
                    <Box sx={{ flexGrow: 1, minWidth: '200px' }}>Group Name</Box>
                    <Box sx={{ width: '250px', display: { xs: 'none', sm: 'block' } }}>Constraints</Box>
                    <Box sx={{ width: '80px', textAlign: 'right' }}>Actions</Box>
                </Box>

                {/* DRAGGABLE ROWS */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                        <Box>
                            {groups.map((group) => (
                                <SortableGroupItem key={group.id} group={group} onEdit={handleOpen} onDelete={handleDelete} />
                            ))}
                        </Box>
                    </SortableContext>
                </DndContext>
            </Paper>

            {/* DIALOG */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{editingId ? "Edit Group" : "New Group"}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        <TextField
                            label="Group Name" fullWidth autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Min Watches" type="number" fullWidth
                                value={formData.min_assignments}
                                onChange={(e) => setFormData({ ...formData, min_assignments: parseInt(e.target.value) })}
                            />
                            <TextField
                                label="Max Watches" type="number" fullWidth
                                value={formData.max_assignments}
                                onChange={(e) => setFormData({ ...formData, max_assignments: parseInt(e.target.value) })}
                            />
                        </Box>
                        <TextField
                            label="Seniority Factor" type="number" fullWidth inputProps={{ step: "0.1", min: "0", max: "1" }}
                            value={formData.seniorityFactor}
                            onChange={(e) => setFormData({ ...formData, seniorityFactor: parseFloat(e.target.value) })}
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
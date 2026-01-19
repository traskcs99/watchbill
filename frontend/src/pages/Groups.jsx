import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid
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

// --- COMPONENT: Single Draggable Card ---
function SortableGroupItem({ group, onEdit, onDelete }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging
    } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: '8px',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto', // Keep dragged item on top
        position: 'relative'
    };

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            elevation={isDragging ? 8 : 1}
            sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                '&:hover': { bgcolor: 'action.hover' } // Subtle hover effect
            }}
        >
            {/* Drag Handle */}
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    cursor: 'grab',
                    mr: 2,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'text.secondary',
                    '&:active': { cursor: 'grabbing' }
                }}
            >
                <DragIndicatorIcon />
                <Typography variant="caption" sx={{ ml: 1, fontWeight: 'bold', minWidth: '20px' }}>
                    #{group.priority}
                </Typography>
            </Box>

            {/* Group Info */}
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                    {group.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Watches: <b>{group.min_assignments} - {group.max_assignments}</b> • Factor: {group.seniorityFactor}
                </Typography>
            </Box>

            {/* Actions */}
            <Box>
                <IconButton size="small" onClick={() => onEdit(group)}>
                    <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(group.id)}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
        </Paper>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function Groups() {
    const [groups, setGroups] = useState([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '', min_assignments: 0, max_assignments: 8, seniorityFactor: 1.0
    });

    // DnD Sensors (Mouse + Keyboard accessible)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Drag requires 5px movement (prevents accidental clicks)
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // 1. Fetch Data
    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = () => {
        fetch('/api/groups')
            .then(res => res.json())
            .then(data => {
                // Always render sorted by priority
                const sorted = data.sort((a, b) => a.priority - b.priority);
                setGroups(sorted);
            })
            .catch(err => console.error("Fetch failed:", err));
    };

    // 2. Handle Drag End (Reorder)
    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setGroups((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);

                // Optimistic UI Update: Move items immediately
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Recalculate priorities locally (Index 0 = Priority 1)
                const updatedWithPriorities = newOrder.map((g, idx) => ({ ...g, priority: idx + 1 }));

                // Save to Backend
                saveOrder(updatedWithPriorities);

                return updatedWithPriorities;
            });
        }
    };

    const saveOrder = (orderedGroups) => {
        const ids = orderedGroups.map(g => g.id);
        fetch('/api/groups/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        }).catch(err => console.error("Save order failed:", err));
    };

    // 3. Create / Edit Dialog
    const handleOpen = (group = null) => {
        if (group) {
            setEditingId(group.id);
            setFormData({
                name: group.name,
                min_assignments: group.min_assignments,
                max_assignments: group.max_assignments,
                seniorityFactor: group.seniorityFactor
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

        // Note: We do NOT send priority here. Backend handles auto-append for POST.
        // PUT ignores priority anyway.
        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
            .then(res => {
                if (!res.ok) throw new Error('Request failed');
                return res.json();
            })
            .then(() => {
                fetchGroups();
                setOpen(false);
            })
            .catch(err => console.error(err));
    };

    // 4. Delete
    const handleDelete = (id) => {
        if (!window.confirm("Delete this group? This will unassign any personnel in it.")) return;

        fetch(`/api/groups/${id}`, { method: 'DELETE' })
            .then(() => fetchGroups());
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">Groups & Priority</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Drag to reorder. Top = Highest Priority (1).
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen(null)}>
                    New Group
                </Button>
            </Box>

            {/* Drag & Drop List */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={groups.map(g => g.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <Box display="flex" flexDirection="column" gap={0}>
                        {groups.length === 0 ? (
                            <Typography color="text.secondary" align="center" py={4}>
                                No groups found. Create one to get started.
                            </Typography>
                        ) : (
                            groups.map((group) => (
                                <SortableGroupItem
                                    key={group.id}
                                    group={group}
                                    onEdit={handleOpen}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </Box>
                </SortableContext>
            </DndContext>

            {/* Edit/Create Dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{editingId ? "Edit Group" : "New Group"}</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        <TextField
                            label="Group Name"
                            fullWidth
                            autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <Box display="flex" gap={2}>
                            <TextField
                                label="Min Watches"
                                type="number" fullWidth
                                helperText="Per month"
                                value={formData.min_assignments}
                                onChange={(e) => setFormData({ ...formData, min_assignments: parseInt(e.target.value) })}
                            />
                            <TextField
                                label="Max Watches"
                                type="number" fullWidth
                                helperText="Per month"
                                value={formData.max_assignments}
                                onChange={(e) => setFormData({ ...formData, max_assignments: parseInt(e.target.value) })}
                            />
                        </Box>

                        <TextField
                            label="Seniority Factor"
                            type="number"
                            fullWidth
                            // Enforce 0.0 to 1.0 range with 0.1 increments
                            inputProps={{ step: "0.1", min: "0", max: "1" }}
                            helperText="Range: 0.0 (Trainee) to 1.0 (Full Qual)"
                            value={formData.seniorityFactor}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setFormData({
                                    ...formData,
                                    // simple clamp to ensure it doesn't go below 0
                                    seniorityFactor: val < 0 ? 0 : val
                                })
                            }}
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
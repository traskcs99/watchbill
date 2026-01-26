import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Typography, IconButton
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';

export default function MemberConfigDialog({ open, onClose, member, onSave }) {
    const [seniority, setSeniority] = useState('');
    const [minAssign, setMinAssign] = useState('');
    const [maxAssign, setMaxAssign] = useState('');

    useEffect(() => {
        if (member) {
            // Load existing overrides if they exist, otherwise empty string
            // Note: We check 'override_' keys first as that's what comes from the DB
            setSeniority(member.override_seniorityFactor ?? '');
            setMinAssign(member.override_min_assignments ?? '');
            setMaxAssign(member.override_max_assignments ?? '');
        }
    }, [member]);

    const handleSave = () => {
        // 🟢 FIX: Map the inputs to the EXACT keys the Python Backend expects
        const payload = {
            override_seniorityFactor: seniority === '' ? null : parseFloat(seniority),
            override_min_assignments: minAssign === '' ? null : parseInt(minAssign),
            override_max_assignments: maxAssign === '' ? null : parseInt(maxAssign)
        };

        onSave(member.id, payload);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                Member Settings
                <Typography variant="subtitle2" color="text.secondary" component="div">
                    {member?.person_name}
                </Typography>
            </DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column" gap={3} mt={1}>

                    {/* Seniority Input */}
                    <Box display="flex" gap={1}>
                        <TextField
                            label="Seniority Override"
                            type="number"
                            fullWidth
                            // Show "Default" if empty
                            helperText={seniority === '' ? `Default: ${member?.group_defaults?.seniorityFactor ?? 1.0}` : "Overridden"}
                            value={seniority}
                            onChange={(e) => setSeniority(e.target.value)}
                            InputProps={{ inputProps: { step: 0.1 } }}
                        />
                        <IconButton onClick={() => setSeniority('')} disabled={seniority === ''} title="Reset to Default">
                            <RestoreIcon />
                        </IconButton>
                    </Box>

                    {/* Min Assignments */}
                    <Box display="flex" gap={1}>
                        <TextField
                            label="Min Assignments Override"
                            type="number"
                            fullWidth
                            helperText={minAssign === '' ? `Default: ${member?.group_defaults?.min_assignments ?? 0}` : "Overridden"}
                            value={minAssign}
                            onChange={(e) => setMinAssign(e.target.value)}
                        />
                        <IconButton onClick={() => setMinAssign('')} disabled={minAssign === ''} title="Reset to Default">
                            <RestoreIcon />
                        </IconButton>
                    </Box>

                    {/* Max Assignments */}
                    <Box display="flex" gap={1}>
                        <TextField
                            label="Max Assignments Override"
                            type="number"
                            fullWidth
                            helperText={maxAssign === '' ? `Default: ${member?.group_defaults?.max_assignments ?? 'None'}` : "Overridden"}
                            value={maxAssign}
                            onChange={(e) => setMaxAssign(e.target.value)}
                        />
                        <IconButton onClick={() => setMaxAssign('')} disabled={maxAssign === ''} title="Reset to Default">
                            <RestoreIcon />
                        </IconButton>
                    </Box>

                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary">
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
}
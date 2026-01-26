import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, List,
    ListItem, ListItemButton, ListItemText, Typography
} from '@mui/material';

export default function MemberPickerDialog({ open, onClose, personnel, onAdd, existingMembers }) {
    // 1. Filter out people who are already on the team for this specific schedule
    const available = personnel.filter(
        p => !existingMembers.some(m => m.person_id === p.id)
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Add to Personnel Pool</DialogTitle>
            <DialogContent dividers>
                <List>
                    {available.map((person) => (
                        <ListItem disablePadding key={person.id}>
                            <ListItemButton onClick={() => {
                                onAdd(person.id);
                                onClose();
                            }}>
                                <ListItemText
                                    primary={person.name}
                                    secondary={person.group_name || "No Group Assigned"}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}

                    {available.length === 0 && (
                        <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                            No more personnel available to add.
                        </Typography>
                    )}
                </List>
            </DialogContent>
        </Dialog>
    );
}
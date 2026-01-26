import React from 'react';
import { Card, CardContent, Typography, Box, Divider, List, ListItem, ListItemText, Chip, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export default function CandidateCard({ candidate, onApply, isBest }) {
    // Sort metrics to find the "Top 3 highest goat scores"
    const metrics = Object.entries(candidate.metrics_data || {})
        .sort(([, a], [, b]) => b.score - a.score)
        .slice(0, 3);

    return (
        <Card variant="outlined" sx={{ minWidth: 280, border: isBest ? '2px solid #2e7d32' : '1px solid #ccc' }}>
            <CardContent>
                <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="h6">Score: {candidate.score.toFixed(1)}</Typography>
                    {isBest && <Chip label="Most Fair" color="success" size="small" />}
                </Box>

                <Typography variant="caption" color="text.secondary">Worst Hit Personnel:</Typography>
                <List dense>
                    {metrics.map(([name, data]) => (
                        <ListItem key={name} disableGutters>
                            <ListItemText
                                primary={name}
                                secondary={`${data.assigned} shifts`}
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                            <Typography variant="body2" color="error">{data.score.toFixed(1)} GP</Typography>
                        </ListItem>
                    ))}
                </List>

                <Divider sx={{ my: 2 }} />

                <Button
                    fullWidth
                    variant={isBest ? "contained" : "outlined"}
                    startIcon={<CheckCircleOutlineIcon />}
                    onClick={() => onApply(candidate.id)}
                >
                    Apply This Option
                </Button>
            </CardContent>
        </Card>
    );
}
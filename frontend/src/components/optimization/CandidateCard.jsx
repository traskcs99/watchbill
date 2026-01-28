import React from 'react';
import {
    Card, CardContent, Typography, Box, Button,
    Table, TableBody, TableCell, TableHead, TableRow,
    Chip, Divider, Tooltip, Zoom
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function CandidateCard({ candidate, isBest, onApply, onToggleHighlight }) {

    // Sort by Goat Points (Penalty) descending
    const rows = Object.entries(candidate.metrics_data || {})
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => (b.goat_points || 0) - (a.goat_points || 0));

    return (
        <Card
            variant="outlined"
            sx={{
                minWidth: 380,
                maxWidth: 420,
                flexShrink: 0,
                border: isBest ? '2px solid #1976d2' : '1px solid #ddd',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {isBest && (
                <Chip
                    label="Best Match"
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 10, right: 10 }}
                />
            )}

            <CardContent sx={{ flexGrow: 1, p: 2 }}>
                <Box mb={1}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        Score: {Number(candidate.score || 0).toFixed(0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Run ID: {candidate.run_id ? candidate.run_id.substring(0, 8) : 'N/A'}
                    </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                    <Table size="small" stickyHeader padding="none">
                        <TableHead>
                            <TableRow>
                                {/* 🟢 SHRINK NAME COLUMN: Fixed width of 60px */}
                                <TableCell sx={{ fontSize: '0.7rem', py: 1, pl: 1, width: '60px' }}>Name</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.7rem', py: 1 }}>Shifts</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.7rem', py: 1, fontWeight: 'bold' }}>WA</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.7rem', py: 1 }}>Quota</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.7rem', py: 1, color: 'text.secondary' }}>Pen</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.name}
                                    hover
                                    onClick={() => onToggleHighlight && onToggleHighlight(row.member_id)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    {/* 🟢 TRUNCATE TEXT: Ensure long names don't break layout */}
                                    <TableCell
                                        component="th"
                                        scope="row"
                                        sx={{
                                            fontSize: '0.75rem',
                                            py: 0.5,
                                            pl: 1,
                                            maxWidth: '60px', // Force narrowness
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontWeight: (row.goat_points || 0) > 10 ? 'bold' : 'normal',
                                            color: (row.goat_points || 0) > 10 ? 'error.main' : 'text.primary'
                                        }}
                                    >
                                        <Tooltip title={row.name} placement="top-start">
                                            <span>{row.name.split(" ").pop()}</span>
                                        </Tooltip>
                                    </TableCell>

                                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                                        {row.assigned}
                                    </TableCell>

                                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                                        {Number(row.points || 0).toFixed(1)}
                                    </TableCell>

                                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                                        {Number(row.quota_target || 0).toFixed(1)}
                                    </TableCell>

                                    {/* Penalty Column with Tooltip */}
                                    <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                        <Tooltip
                                            title={
                                                <Box sx={{ p: 0.5 }}>
                                                    <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5, borderBottom: '1px solid #fff' }}>
                                                        Penalty Breakdown
                                                    </Typography>
                                                    {row.breakdown && Object.keys(row.breakdown).length > 0 ? (
                                                        Object.entries(row.breakdown).map(([reason, pts]) => (
                                                            <Box key={reason} display="flex" justifyContent="space-between" gap={2}>
                                                                <Typography variant="caption">{reason}:</Typography>
                                                                <Typography variant="caption" fontWeight="bold">{pts}</Typography>
                                                            </Box>
                                                        ))
                                                    ) : (
                                                        <Typography variant="caption" fontStyle="italic">No penalties</Typography>
                                                    )}
                                                </Box>
                                            }
                                            arrow
                                            TransitionComponent={Zoom}
                                            placement="left"
                                        >
                                            <span style={{ cursor: 'help' }}>
                                                {Number(row.goat_points || 0).toFixed(0)}
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </CardContent>

            <Box sx={{ p: 2, pt: 0 }}>
                <Button
                    variant={isBest ? "contained" : "outlined"}
                    fullWidth
                    onClick={(e) => {
                        e.stopPropagation();
                        onApply(candidate.id);
                    }}
                    startIcon={<CheckCircleIcon />}
                >
                    Apply Schedule
                </Button>
            </Box>
        </Card>
    );
}
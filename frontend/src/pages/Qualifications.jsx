import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Checkbox, CircularProgress, TextField, Chip, IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel'; // The "Red X"
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
export default function Qualifications() {
    const [people, setPeople] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/personnel').then(res => res.json()),
            fetch('/api/master-stations').then(res => res.json())
        ]).then(([peopleData, stationsData]) => {
            setPeople(peopleData);
            setStations(stationsData);
            setLoading(false);
        });
    }, []);
    const formatToUS = (dateStr) => {
        if (!dateStr) return "Set Date";
        const [y, m, d] = dateStr.split('-');
        return `${m}/${d}/${y}`;
    };

    // 1. New function to handle manual date changes (PATCH)
    const handleDateChange = async (qualId, newDate) => {
        try {
            const res = await fetch(`/api/qualifications/${qualId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ earned_date: newDate })
            });
            if (res.ok) {
                refreshData();
            }
        } catch (err) {
            console.error("Error updating date:", err);
        }
    };

    const handleToggle = async (personId, stationId) => {
        const person = people.find(p => p.id === personId);
        const existingQual = person.qualifications.find(q => q.station_id === stationId);

        if (existingQual) {
            // REVOKE (DELETE)
            try {
                const res = await fetch(`/api/qualifications/${existingQual.qual_id}`, {
                    method: 'DELETE'
                });
                if (res.ok) refreshData();
            } catch (err) {
                console.error("Error revoking qual:", err);
            }
        } else {
            // GRANT (POST) with Today's Date as default
            try {
                const res = await fetch('/api/qualifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        person_id: personId,
                        station_id: stationId,
                        earned_date: new Date().toISOString().split('T')[0] // Defaults to Today
                    })
                });
                if (res.ok) refreshData();
            } catch (err) {
                console.error("Error granting qual:", err);
            }
        }
    };

    const refreshData = () => {
        fetch('/api/personnel').then(res => res.json()).then(setPeople);
    };

    if (loading) return <Box p={4} textAlign="center"><CircularProgress /></Box>;

    return (
        <Box sx={{ maxWidth: '100%', mx: 'auto', p: 3 }}>
            <Box mb={3}>
                <Typography variant="h4" fontWeight="bold">Qualification Matrix</Typography>
                <Typography variant="body2" color="text.secondary">
                    Grant qualifications and track earned dates.
                </Typography>
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ maxHeight: '75vh' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'primary.light', color: 'white', fontWeight: 'bold', zIndex: 10 }}>
                                Name / Group
                            </TableCell>
                            {stations.map(station => (
                                <TableCell key={station.id} align="center" sx={{ bgcolor: 'primary.light', color: 'white', fontWeight: 'bold', minWidth: 150 }}>
                                    {station.abbr}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {people.map((person) => (
                            <TableRow key={person.id} hover>
                                <TableCell sx={{ borderRight: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
                                    <Typography variant="subtitle2" fontWeight="bold">{person.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">{person.group_name}</Typography>
                                </TableCell>

                                {stations.map(station => {
                                    const qual = person.qualifications.find(q => q.station_id === station.id);

                                    return (
                                        <TableCell key={station.id} align="center" sx={{ borderRight: '1px solid #f0f0f0', minWidth: 180 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40px' }}>

                                                {/* 1. If NOT qualified, show the simple Checkbox to grant it */}
                                                {!qual ? (
                                                    <Checkbox
                                                        checked={false}
                                                        onChange={() => handleToggle(person.id, station.id)}
                                                        disabled={!person.is_active}
                                                        size="small"
                                                        sx={{ color: '#ccc' }}
                                                    />
                                                ) : (
                                                    /* 2. If QUALIFIED, hide checkbox and show the Status Pill */
                                                    <Box sx={{
                                                        position: 'relative',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        '&:hover .action-buttons': { opacity: 1, visibility: 'visible' }
                                                    }}>
                                                        <Chip
                                                            icon={<CheckCircleIcon style={{ color: '#2e7d32', fontSize: '1rem' }} />}
                                                            label={`Qualified: ${formatToUS(qual.earned_date)}`}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{
                                                                fontSize: '0.7rem',
                                                                height: '26px',
                                                                bgcolor: '#e8f5e9',
                                                                color: '#2e7d32',
                                                                fontWeight: 'bold',
                                                                border: '1px solid #a5d6a7'
                                                            }}
                                                        />

                                                        {/* 3. Action Buttons Overlay (Visible on Hover) */}
                                                        <Box className="action-buttons" sx={{
                                                            position: 'absolute',
                                                            right: -50,
                                                            display: 'flex',
                                                            gap: 0.5,
                                                            opacity: 0,
                                                            visibility: 'hidden',
                                                            transition: 'all 0.2s ease-in-out',
                                                            bgcolor: 'white',
                                                            borderRadius: '4px',
                                                            boxShadow: 1,
                                                            p: 0.2
                                                        }}>
                                                            {/* Edit Button (Trigger for the hidden date input) */}
                                                            <IconButton size="small" sx={{ p: 0.2, color: 'primary.main', position: 'relative' }}>
                                                                <EditIcon sx={{ fontSize: 16 }} />
                                                                <input
                                                                    type="date"
                                                                    value={qual.earned_date || ""}
                                                                    onChange={(e) => handleDateChange(qual.qual_id, e.target.value)}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        opacity: 0,
                                                                        cursor: 'pointer',
                                                                    }}
                                                                />
                                                            </IconButton>

                                                            {/* Revoke Button (Red X) */}
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                sx={{ p: 0.2 }}
                                                                onClick={() => handleToggle(person.id, station.id)} // Revoke logic
                                                            >
                                                                <CancelIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </Box>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
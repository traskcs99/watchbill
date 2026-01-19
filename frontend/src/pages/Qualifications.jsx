import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Checkbox, Chip, CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export default function Qualifications() {
    const [people, setPeople] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Fetch Data
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

    // 2. The Smart Toggle Logic
    const handleToggle = async (personId, stationId) => {
        // Find the person in our local state
        const personIndex = people.findIndex(p => p.id === personId);
        const person = people[personIndex];

        // Check if they already have this qualification
        const existingQual = person.qualifications.find(q => q.station_id === stationId);

        if (existingQual) {
            // --- REVOKE (DELETE) ---
            try {
                // 1. Call Backend
                const res = await fetch(`/api/qualifications/${existingQual.qual_id}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    // 2. Update Frontend State (Remove from array)
                    const updatedQuals = person.qualifications.filter(q => q.station_id !== stationId);
                    updatePersonState(personIndex, updatedQuals);
                }
            } catch (err) {
                console.error("Error revoking qual:", err);
            }
        } else {
            // --- GRANT (POST) ---
            try {
                // 1. Call Backend
                const res = await fetch('/api/qualifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        person_id: personId,
                        station_id: stationId,
                        earned_date: new Date().toISOString().split('T')[0] // Optional: Today's date
                    })
                });

                if (res.ok) {
                    // We need to get the new ID back from the server (if your POST returns it)
                    // Or we re-fetch. Ideally, your backend POST returns { id: 123, ... }
                    // For now, we'll just re-fetch everything to be safe and accurate.
                    refreshData();
                }
            } catch (err) {
                console.error("Error granting qual:", err);
            }
        }
    };

    const updatePersonState = (index, newQuals) => {
        setPeople(prev => {
            const newPeople = [...prev];
            newPeople[index] = { ...newPeople[index], qualifications: newQuals };
            return newPeople;
        });
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
                    Manage who is qualified to stand which watch.
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
                                <TableCell
                                    key={station.id}
                                    align="center"
                                    sx={{ bgcolor: 'primary.light', color: 'white', fontWeight: 'bold', minWidth: 80 }}
                                >
                                    <Box display="flex" flexDirection="column" alignItems="center">
                                        <span>{station.abbr}</span>
                                    </Box>
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
                                    // Check if this station ID exists in the person's qualifications list
                                    const isQualified = person.qualifications.some(q => q.station_id === station.id);

                                    return (
                                        <TableCell key={station.id} align="center" padding="none">
                                            <Checkbox
                                                checked={isQualified}
                                                onChange={() => handleToggle(person.id, station.id)}
                                                disabled={!person.is_active}
                                                sx={{ '&.Mui-checked': { color: 'primary.main' } }}
                                            />
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
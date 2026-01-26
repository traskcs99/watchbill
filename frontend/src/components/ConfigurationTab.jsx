import React from 'react';
import {
    Box, Typography, Button, Divider, List, Grid, Paper
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonnelListItem from './PersonnelListItem';

// Optimization Imports
import OptimizationSettings from './optimization/OptimizationSettings';
import SolverDashboard from './optimization/SolverDashboard';

export default function ConfigurationTab({
    summary,
    groups,
    masterStations,
    onRemoveStation,
    onAddStationClick,
    onRemoveMember,
    onAddMemberClick,
    onOpenWeightSlider,
    onOpenLeave,
    onDeleteLeave,
    onOpenMemberConfig,
    onSaveSettings,
    onRefresh
}) {

    return (
        <Grid container spacing={4}>
            {/* LEFT COLUMN: SETUP DATA */}
            <Grid item xs={12} md={6}>
                <Box>
                    {/* 1. STATION TEMPLATE (Abbr Toggle List) */}
                    <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                        Watch Template
                    </Typography>

                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fcfcfc', mb: 3 }}>
                        <Grid container spacing={1}>
                            {masterStations.map((st) => {
                                // Check if this Master Station is currently "Active" in this schedule
                                const activeLink = summary?.required_stations?.find(
                                    (rs) => rs.station_id === st.id
                                );

                                return (
                                    <Grid item xs={4} key={st.id}>
                                        <Button
                                            fullWidth
                                            size="small"
                                            variant={activeLink ? "contained" : "outlined"}
                                            color={activeLink ? "primary" : "inherit"}
                                            onClick={() => activeLink ? onRemoveStation(activeLink.id) : onAddStationClick(st.id)}
                                            sx={{
                                                fontWeight: 'bold',
                                                py: 1,
                                                fontSize: '0.75rem',
                                                borderColor: activeLink ? 'primary.main' : 'grey.300',
                                                bgcolor: activeLink ? 'primary.main' : 'white',
                                                color: activeLink ? 'white' : 'text.primary',
                                                '&:hover': {
                                                    bgcolor: activeLink ? 'error.main' : 'primary.50',
                                                    color: activeLink ? 'white' : 'primary.main',
                                                }
                                            }}
                                        >
                                            {activeLink ? `✕ ${st.abbr}` : `+ ${st.abbr}`}
                                        </Button>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Paper>

                    <Divider sx={{ my: 3 }} />

                    {/* 2. PERSONNEL POOL SECTION */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Personnel Pool
                        </Typography>
                        <Button size="small" variant="text" startIcon={<PeopleIcon />} onClick={onAddMemberClick} sx={{ fontSize: '0.7rem' }}>
                            Add Person
                        </Button>
                    </Box>

                    <List dense sx={{ bgcolor: '#f9f9f9', borderRadius: 1, maxHeight: '400px', overflow: 'auto', border: '1px solid #eee' }}>
                        {summary?.memberships?.map((mem) => (
                            <PersonnelListItem
                                key={mem.id}
                                member={mem}
                                masterStations={masterStations}
                                onRemove={onRemoveMember}
                                onOpenLeave={onOpenLeave}
                                onOpenWeight={onOpenWeightSlider}
                                onDeleteLeave={onDeleteLeave}
                                onOpenConfig={onOpenMemberConfig}
                            />
                        ))}
                    </List>
                </Box>
            </Grid>

            {/* RIGHT COLUMN: AI OPTIMIZATION */}
            <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <OptimizationSettings
                        schedule={summary}
                        groups={groups || []}
                        onSave={onSaveSettings}
                    />
                    <SolverDashboard
                        scheduleId={summary?.id}
                        onScheduleUpdated={onRefresh}
                    />
                </Box>
            </Grid>
        </Grid>
    );
}
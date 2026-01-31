import React from 'react';
import {
    Box, Typography, Button, Divider, List, Grid, Paper
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonnelListItem from './PersonnelListItem';

import OptimizationSettings from './optimization/OptimizationSettings';
import SolverDashboard from './optimization/SolverDashboard';

export default function ConfigurationTab({
    summary,
    schedule, // <--- This object contains .days
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
    onRefresh,
    onToggleHighlight
}) {

    return (
        <Grid container spacing={4}>
            {/* LEFT COLUMN: SETUP DATA */}
            <Grid item xs={12} md={6}>
                <Box>
                    <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                        Watch Template
                    </Typography>

                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fcfcfc', mb: 3 }}>
                        <Grid container spacing={1}>
                            {masterStations.map((st) => {
                                const activeLink = summary?.required_stations?.find(rs => rs.station_id === st.id);
                                return (
                                    <Grid item key={st.id}>
                                        <Button
                                            variant={activeLink ? "contained" : "outlined"}
                                            color={activeLink ? "primary" : "inherit"}
                                            size="small"
                                            onClick={() => activeLink ? onRemoveStation(activeLink.id) : onAddStationClick(st.id)}
                                            sx={{ borderRadius: 4, textTransform: 'none', fontSize: '0.75rem', minWidth: 60 }}
                                        >
                                            {st.abbr}
                                        </Button>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Paper>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Personnel Pool ({schedule?.memberships?.length || 0})
                        </Typography>
                        <Button
                            startIcon={<PeopleIcon />}
                            size="small"
                            variant="contained"
                            onClick={onAddMemberClick}
                            sx={{ textTransform: 'none' }}
                        >
                            Add Person
                        </Button>
                    </Box>

                    <List dense sx={{ bgcolor: '#f9f9f9', borderRadius: 1, maxHeight: '400px', overflow: 'auto', border: '1px solid #eee' }}>
                        {schedule?.memberships?.map((mem) => (
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
                        schedule={schedule}
                        groups={groups || []}
                        onSave={onSaveSettings}
                    />
                    <SolverDashboard
                        scheduleId={summary?.id}
                        onScheduleUpdated={onRefresh}
                        onToggleHighlight={onToggleHighlight}
                        masterStations={masterStations}
                        memberships={schedule?.memberships || []}
                        scheduleUpdatedAt={schedule}
                        days={schedule?.days || []}
                    />
                </Box>
            </Grid>
        </Grid>
    );
}
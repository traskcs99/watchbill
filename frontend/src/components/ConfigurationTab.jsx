import React from 'react';
import {
    Box, Typography, Button, Chip, Divider, List
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonnelListItem from './PersonnelListItem';

export default function ConfigurationTab({
    summary,
    masterStations,
    onRemoveStation,
    onAddStationClick,
    onRemoveMember,
    onAddMemberClick,
    onOpenWeightSlider,
    onOpenLeave,
    onDeleteLeave,
    onOpenMemberConfig // 🟢 Received here
}) {

    return (
        <Box>
            {/* 1. REQUIRED STATIONS SECTION */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Required Stations</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {summary?.required_stations?.map((st) => (
                    <Chip
                        key={st.id}
                        label={st.abbr}
                        color="primary"
                        variant="outlined"
                        onDelete={() => onRemoveStation(st.id)}
                    />
                ))}
                <Button size="small" sx={{ border: '1px dashed grey' }} onClick={onAddStationClick}>+ Add</Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 2. PERSONNEL POOL SECTION */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">Personnel Pool</Typography>
                <Button size="small" startIcon={<PeopleIcon />}>Manage</Button>
            </Box>

            <List dense sx={{ bgcolor: '#f9f9f9', borderRadius: 1 }}>
                {summary?.memberships?.map((mem) => (
                    <PersonnelListItem
                        key={mem.id}
                        member={mem}
                        masterStations={masterStations}
                        onRemove={onRemoveMember}
                        onOpenLeave={onOpenLeave}
                        onOpenWeight={onOpenWeightSlider}
                        onDeleteLeave={onDeleteLeave}

                        // 🟢 PASS THE CONFIG HANDLER DOWN
                        onOpenConfig={onOpenMemberConfig}
                    />
                ))}
            </List>

            <Button fullWidth size="small" startIcon={<PeopleIcon />} onClick={onAddMemberClick} sx={{ mt: 1 }}>
                Add Personnel
            </Button>
        </Box>
    );
}
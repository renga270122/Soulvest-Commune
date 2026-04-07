import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import Navbar from '../components/Navbar';
import { subscribeToResidents } from '../services/communityData';

const cardStyle = {
  p: 2,
  borderRadius: 3,
  minHeight: 110,
};

export default function ResidentDirectory() {
  const [residents, setResidents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToResidents(setResidents);
    return () => unsubscribe();
  }, []);

  const filteredResidents = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) return residents;

    return residents.filter((resident) =>
      [resident.name, resident.flat, resident.mobile, resident.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [residents, searchTerm]);

  const stats = useMemo(() => {
    const occupiedFlats = new Set(residents.map((resident) => resident.flat).filter(Boolean));
    const residentsWithPhones = residents.filter((resident) => resident.mobile).length;
    return {
      totalResidents: residents.length,
      occupiedFlats: occupiedFlats.size,
      residentsWithPhones,
    };
  }, [residents]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Resident Directory
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Search residents by name, flat number, mobile, or email.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper elevation={1} sx={cardStyle}>
            <Typography color="text.secondary">Total Residents</Typography>
            <Typography variant="h4">{stats.totalResidents}</Typography>
          </Paper>
          <Paper elevation={1} sx={cardStyle}>
            <Typography color="text.secondary">Occupied Flats</Typography>
            <Typography variant="h4">{stats.occupiedFlats}</Typography>
          </Paper>
          <Paper elevation={1} sx={cardStyle}>
            <Typography color="text.secondary">Reachable Contacts</Typography>
            <Typography variant="h4">{stats.residentsWithPhones}</Typography>
          </Paper>
        </Box>

        <Paper elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          <TextField
            fullWidth
            label="Search residents"
            placeholder="Try A-101, Rahul, or 9876..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            sx={{ mb: 2 }}
          />

          <Stack spacing={1.5} divider={<Divider flexItem />}>
            {filteredResidents.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="h6">No residents found</Typography>
                <Typography color="text.secondary">
                  Add resident profiles in Firestore or change the search term.
                </Typography>
              </Box>
            )}

            {filteredResidents.map((resident) => (
              <Box
                key={resident.id}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  py: 1,
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{resident.name || 'Unnamed resident'}</Typography>
                    <Typography color="text.secondary">
                      {resident.email || 'No email on file'}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`Flat ${resident.flat || 'UNASSIGNED'}`} color="primary" variant="outlined" />
                  <Chip label={resident.mobile || 'No mobile'} variant="outlined" />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>
      <Navbar />
    </Box>
  );
}

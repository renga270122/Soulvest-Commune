import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import AddCardIcon from '@mui/icons-material/AddCard';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../components/AuthContext';
import ChatbotWidget from '../components/ChatbotWidget';
import {
  createPaymentRecord,
  subscribeToPayments,
  subscribeToResidents,
  subscribeToVisitors,
} from '../services/communityData';

const formatAmount = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const [residents, setResidents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [creating, setCreating] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    residentId: 'all',
    title: 'Monthly Maintenance',
    amount: '3500',
    dueDate: '',
  });
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubResidents = subscribeToResidents(setResidents);
    const unsubPayments = subscribeToPayments(setPayments);
    const unsubVisitors = subscribeToVisitors(setVisitors);
    return () => {
      unsubResidents();
      unsubPayments();
      unsubVisitors();
    };
  }, []);

  const stats = useMemo(() => {
    const outstanding = payments
      .filter((payment) => payment.status !== 'paid')
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    return {
      residents: residents.length,
      pendingVisitors: visitors.filter((entry) => entry.status === 'pending').length,
      outstanding,
      paymentsReceived: payments.filter((payment) => payment.status === 'paid').length,
    };
  }, [payments, residents, visitors]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChange = (event) => {
    setChargeForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleCreateCharge = async () => {
    const targetResidents = chargeForm.residentId === 'all'
      ? residents
      : residents.filter((resident) => resident.id === chargeForm.residentId);

    if (!targetResidents.length) {
      setBanner({ type: 'error', message: 'No target residents found for this charge.' });
      return;
    }

    setCreating(true);
    setBanner({ type: '', message: '' });
    try {
      await Promise.all(
        targetResidents.map((resident) =>
          createPaymentRecord({
            userId: resident.id,
            residentName: resident.name || 'Resident',
            flat: resident.flat,
            title: chargeForm.title,
            dueDate: chargeForm.dueDate || new Date().toISOString(),
            amount: Number(chargeForm.amount),
            breakdown: {
              Security: 40,
              Housekeeping: 25,
              Utilities: 20,
              Other: 15,
            },
            status: 'due',
            method: 'manual',
          }),
        ),
      );

      setBanner({
        type: 'success',
        message: `Charge created for ${targetResidents.length} resident${targetResidents.length > 1 ? 's' : ''}.`,
      });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to create the charge.' });
    }
    setCreating(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography variant="h4">Admin Dashboard</Typography>
            <Typography color="text.secondary">
              Welcome {user?.name || 'Admin'}. Manage residents, charges, and gate activity from one place.
            </Typography>
          </Box>
          <Button variant="outlined" color="secondary" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Box>

        {banner.message && (
          <Alert severity={banner.type} sx={{ mb: 3 }}>
            {banner.message}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Residents</Typography>
            <Typography variant="h4">{stats.residents}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Pending Visitors</Typography>
            <Typography variant="h4">{stats.pendingVisitors}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Outstanding Dues</Typography>
            <Typography variant="h4">{formatAmount(stats.outstanding)}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Payments Received</Typography>
            <Typography variant="h4">{stats.paymentsReceived}</Typography>
          </Paper>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr' },
            gap: 2,
          }}
        >
          <Stack spacing={2}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
                <AddCardIcon color="primary" />
                <Typography variant="h6">Create Charge</Typography>
              </Stack>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Target"
                  name="residentId"
                  value={chargeForm.residentId}
                  onChange={handleChange}
                >
                  <MenuItem value="all">All residents</MenuItem>
                  {residents.map((resident) => (
                    <MenuItem key={resident.id} value={resident.id}>
                      {resident.name || 'Resident'} • {resident.flat}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Charge title" name="title" value={chargeForm.title} onChange={handleChange} />
                <TextField label="Amount" name="amount" type="number" value={chargeForm.amount} onChange={handleChange} />
                <TextField
                  label="Due date"
                  name="dueDate"
                  type="date"
                  value={chargeForm.dueDate}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                />
                <Button variant="contained" onClick={handleCreateCharge} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Charge'}
                </Button>
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Payments
              </Typography>
              <Stack spacing={1.5}>
                {payments.slice(0, 5).map((payment) => (
                  <Paper key={payment.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle1">{payment.residentName || 'Resident'}</Typography>
                        <Typography color="text.secondary">
                          {payment.title} • Flat {payment.flat || 'N/A'}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Typography fontWeight={700}>{formatAmount(payment.amount)}</Typography>
                        <Chip
                          label={payment.status === 'paid' ? 'Paid' : 'Due'}
                          color={payment.status === 'paid' ? 'success' : 'warning'}
                        />
                      </Stack>
                    </Box>
                  </Paper>
                ))}
                {payments.length === 0 && <Typography color="text.secondary">No payment records yet.</Typography>}
              </Stack>
            </Paper>
          </Stack>

          <Stack spacing={2}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Pending Visitor Queue
              </Typography>
              <Stack spacing={1.5}>
                {visitors.filter((entry) => entry.status === 'pending').slice(0, 5).map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1">{entry.name}</Typography>
                    <Typography color="text.secondary">
                      Flat {entry.flat} • {entry.purpose}
                    </Typography>
                    <Typography color="text.secondary">Arrival: {entry.time}</Typography>
                  </Paper>
                ))}
                {visitors.filter((entry) => entry.status === 'pending').length === 0 && (
                  <Typography color="text.secondary">No pending approvals at the moment.</Typography>
                )}
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Resident Snapshot
              </Typography>
              <Stack spacing={1.5}>
                {residents.slice(0, 6).map((resident) => (
                  <Paper key={resident.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1">{resident.name || 'Unnamed resident'}</Typography>
                    <Typography color="text.secondary">
                      Flat {resident.flat} • {resident.mobile || 'No mobile'}
                    </Typography>
                  </Paper>
                ))}
                {residents.length === 0 && <Typography color="text.secondary">No resident records found.</Typography>}
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Box>

      <ChatbotWidget />
    </Box>
  );
}

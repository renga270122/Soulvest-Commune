import React, { useEffect, useMemo, useState } from 'react';
import {
  Divider,
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
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CampaignIcon from '@mui/icons-material/Campaign';
import BugReportIcon from '@mui/icons-material/BugReport';
import InboxIcon from '@mui/icons-material/Inbox';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ShieldIcon from '@mui/icons-material/Shield';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../components/auth-context';
import ChatbotWidget from '../components/ChatbotWidget';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { resetAllDemoData } from '../services/demoAuth';
import {
  subscribeToFacilityBookings,
  createPaymentRecord,
  seedDemoDayData,
  subscribeToAnnouncements,
  subscribeToComplaints,
  subscribeToPayments,
  subscribeToResidents,
  subscribeToVisitors,
} from '../services/communityData';

const formatAmount = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const [residents, setResidents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [facilityBookings, setFacilityBookings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    residentId: 'all',
    title: 'Monthly Maintenance',
    amount: '3500',
    dueDate: '',
  });
  const { user, logout } = useAuthContext();
  const featureFlags = useFeatureFlags();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubResidents = subscribeToResidents(setResidents);
    const unsubPayments = subscribeToPayments(setPayments, user);
    const unsubVisitors = subscribeToVisitors(setVisitors, user);
    const unsubFacilityBookings = subscribeToFacilityBookings(setFacilityBookings, user);
    const unsubAnnouncements = subscribeToAnnouncements(setAnnouncements, user);
    const unsubComplaints = subscribeToComplaints(setComplaints, { context: user });
    return () => {
      unsubResidents();
      unsubPayments();
      unsubVisitors();
      unsubFacilityBookings();
      unsubAnnouncements();
      unsubComplaints();
    };
  }, [user]);

  const stats = useMemo(() => {
    const outstanding = payments
      .filter((payment) => payment.derivedStatus !== 'paid')
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);

    return {
      residents: residents.length,
      pendingVisitors: visitors.filter((entry) => entry.status === 'pending').length,
      outstanding,
      paymentsReceived: payments.filter((payment) => payment.derivedStatus === 'paid').length,
      openComplaints: complaints.filter((complaint) => complaint.status !== 'resolved').length,
      activeFacilityBookings: facilityBookings.filter((booking) => booking.status !== 'cancelled').length,
      pinnedAnnouncements: announcements.filter((announcement) => announcement.pinned).length,
    };
  }, [announcements, complaints, facilityBookings, payments, residents, visitors]);

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
            societyId: resident.societyId || user?.societyId,
            title: chargeForm.title,
            dueDate: chargeForm.dueDate || new Date().toISOString(),
            amount: Number(chargeForm.amount),
            breakdown: {
              Security: 40,
              Housekeeping: 25,
              Utilities: 20,
              Other: 15,
            },
            status: 'pending',
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

  const handleExportDues = () => {
    const rows = [
      ['Resident', 'Flat', 'Title', 'Amount', 'Status', 'Due Date'],
      ...payments.map((payment) => [
        payment.residentName || 'Resident',
        payment.flat || 'N/A',
        payment.title || 'Charge',
        Number(payment.amount || 0),
        payment.derivedStatus || payment.status,
        payment.dueDate || '',
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'soulvest-dues-summary.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setBanner({ type: '', message: '' });
    try {
      await seedDemoDayData({ adminUser: user, residents });
      setBanner({ type: 'success', message: 'Demo day data seeded for visitors, dues, announcements, and complaints.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to seed demo data.' });
    }
    setSeeding(false);
  };

  const handleResetDemoStore = async () => {
    const confirmed = window.confirm('This will clear all local demo activity and restore the seeded demo records for this browser. Continue?');
    if (!confirmed) return;

    setResetting(true);
    setBanner({ type: '', message: '' });
    try {
      resetAllDemoData();
      setBanner({ type: 'success', message: 'Demo store reset successfully. Seeded residents, visitors, dues, and announcements are restored.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to reset the demo store.' });
    }
    setResetting(false);
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

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
          <Button variant="outlined" startIcon={<InboxIcon />} onClick={() => navigate('/admin/feedback')}>
            View Feedback Inbox
          </Button>
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => navigate('/announcements')}>
            Manage Announcements
          </Button>
          <Button variant="outlined" startIcon={<StorefrontIcon />} onClick={() => navigate('/marketplace')}>
            Review Marketplace
          </Button>
          <Button variant="outlined" startIcon={<BugReportIcon />} onClick={() => navigate('/complaints')}>
            Review Complaints
          </Button>
          <Button variant="outlined" startIcon={<ShieldIcon />} onClick={() => navigate('/security')}>
            Security Logs
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportDues}>
            Export Dues CSV
          </Button>
          <Button variant="contained" color="secondary" startIcon={<AutoAwesomeIcon />} onClick={handleSeedDemo} disabled={seeding}>
            {seeding ? 'Seeding Demo...' : 'Seed Demo Day'}
          </Button>
        </Stack>

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
                          label={payment.derivedStatus === 'paid' ? 'Paid' : payment.derivedStatus === 'overdue' ? 'Overdue' : 'Pending'}
                          color={payment.derivedStatus === 'paid' ? 'success' : payment.derivedStatus === 'overdue' ? 'error' : 'warning'}
                        />
                      </Stack>
                    </Box>
                  </Paper>
                ))}
                {payments.length === 0 && <Typography color="text.secondary">No payment records yet.</Typography>}
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Communications & Issues
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip label={`${stats.pinnedAnnouncements} pinned notice${stats.pinnedAnnouncements === 1 ? '' : 's'}`} color="warning" variant="outlined" />
                <Chip label={`${stats.openComplaints} open complaint${stats.openComplaints === 1 ? '' : 's'}`} color="error" variant="outlined" />
                <Chip label={`${stats.activeFacilityBookings} active booking${stats.activeFacilityBookings === 1 ? '' : 's'}`} color="primary" variant="outlined" />
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                {announcements.slice(0, 2).map((announcement) => (
                  <Paper key={announcement.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1">{announcement.title}</Typography>
                    <Typography color="text.secondary">Ack count: {(announcement.acknowledgements || []).length}</Typography>
                  </Paper>
                ))}
                {complaints.slice(0, 2).map((complaint) => (
                  <Paper key={complaint.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1">{complaint.category}</Typography>
                    <Typography color="text.secondary">{complaint.status} • {complaint.flat || 'No flat'}</Typography>
                  </Paper>
                ))}
                {announcements.length === 0 && complaints.length === 0 && (
                  <Typography color="text.secondary">No announcements or complaints yet.</Typography>
                )}
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Amenity Bookings
              </Typography>
              <Stack spacing={1.5}>
                {facilityBookings.slice(0, 4).map((booking) => (
                  <Paper key={booking.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle1">{booking.amenity}</Typography>
                    <Typography color="text.secondary">
                      {booking.residentName} • Flat {booking.flat || 'N/A'}
                    </Typography>
                    <Typography color="text.secondary">
                      {new Date(booking.bookingDate).toLocaleString()} • {booking.slot}
                    </Typography>
                  </Paper>
                ))}
                {facilityBookings.length === 0 && <Typography color="text.secondary">No amenity bookings yet.</Typography>}
              </Stack>
            </Paper>

            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, border: '1px dashed', borderColor: 'warning.main' }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Demo Controls
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Reset this browser back to the default demo residents, visitors, payments, and announcements.
              </Typography>
              <Button variant="outlined" color="warning" onClick={handleResetDemoStore} disabled={resetting}>
                {resetting ? 'Resetting Demo...' : 'Reset Demo Store'}
              </Button>
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
      {featureFlags.AI_CHATBOT && <ChatbotWidget title="AI Operations Desk" />}
    </Box>
  );
}

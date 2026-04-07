import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CampaignIcon from '@mui/icons-material/Campaign';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupsIcon from '@mui/icons-material/Groups';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuthContext } from '../components/AuthContext';
import {
  createVisitorPass,
  markNotificationAsRead,
  normalizeFlat,
  subscribeToNotifications,
  subscribeToVisitors,
  updateVisitorStatus,
} from '../services/communityData';

const statusColorMap = {
  approved: 'success',
  checked_in: 'success',
  checked_out: 'default',
  denied: 'error',
  expired: 'error',
  pending: 'warning',
  preapproved: 'info',
};

const formatTextValue = (value, fallback = 'Not available') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    if (typeof value.label === 'string' && value.label.trim()) {
      return value.label.trim();
    }
    if (typeof value.text === 'string' && value.text.trim()) {
      return value.text.trim();
    }
  }

  return fallback;
};

const formatDateTimeValue = (value, fallback = 'Not scheduled') => {
  if (!value) return fallback;

  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
  }

  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleString();
  }

  return fallback;
};

export default function ResidentDashboard() {
  const [visitors, setVisitors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [updatingId, setUpdatingId] = useState('');
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [creatingPass, setCreatingPass] = useState(false);
  const [createdPass, setCreatedPass] = useState(null);
  const [passForm, setPassForm] = useState({
    visitorName: '',
    purpose: 'Guest visit',
    phone: '',
    expectedAt: '',
    notes: '',
  });
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const knownNotificationIds = useRef(new Set());
  const notificationsInitialized = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToVisitors(setVisitors, user);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(user?.uid, setNotifications);
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!notifications.length) return;

    if (!notificationsInitialized.current) {
      notifications.forEach((notification) => knownNotificationIds.current.add(notification.id));
      notificationsInitialized.current = true;
      return;
    }

    notifications.forEach((notification) => {
      if (knownNotificationIds.current.has(notification.id)) return;
      knownNotificationIds.current.add(notification.id);

      if (
        ['visitor-entered', 'visitor-exited', 'visitor-awaiting-approval'].includes(notification.type)
        && typeof Notification !== 'undefined'
        && Notification.permission === 'granted'
      ) {
        new Notification(notification.title, { body: notification.message });
      }
    });
  }, [notifications]);

  const myFlat = normalizeFlat(user?.flat);
  const myVisitors = useMemo(
    () => visitors.filter((visitor) => normalizeFlat(visitor.flat) === myFlat),
    [myFlat, visitors],
  );

  const pendingVisitors = myVisitors.filter((visitor) => visitor.status === 'pending');
  const preApprovedVisitors = myVisitors.filter((visitor) => visitor.status === 'preapproved');

  const handlePassFormChange = (event) => {
    setPassForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleCreatePass = async () => {
    if (!user?.uid || !myFlat) {
      setBanner({ type: 'error', message: 'Your resident profile needs a flat number before creating visitor passes.' });
      return;
    }
    if (!passForm.visitorName || !passForm.purpose || !passForm.expectedAt) {
      setBanner({ type: 'error', message: 'Visitor name, purpose, and expected time are required.' });
      return;
    }

    setCreatingPass(true);
    setBanner({ type: '', message: '' });
    try {
      const pass = await createVisitorPass({
        ...passForm,
        residentId: user.uid,
        residentName: user.name || 'Resident',
        flat: myFlat,
        societyId: user.societyId,
      });
      setCreatedPass({
        ...pass,
        visitorName: passForm.visitorName,
        expectedAt: passForm.expectedAt,
      });
      setPassDialogOpen(false);
      setPassForm({ visitorName: '', purpose: 'Guest visit', phone: '', expectedAt: '', notes: '' });
      setBanner({ type: 'success', message: `Visitor pass created for ${passForm.visitorName}. Share the OTP or QR with your guest.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to create the visitor pass.' });
    }
    setCreatingPass(false);
  };

  const handleVisitorDecision = async (visitorId, status) => {
    setUpdatingId(visitorId);
    setBanner({ type: '', message: '' });
    try {
      await updateVisitorStatus(visitorId, status, {
        uid: user?.uid || '',
        name: user?.name || 'Resident',
        societyId: user?.societyId,
      });
      setBanner({ type: 'success', message: `Visitor ${status}.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to update visitor status.' });
    }
    setUpdatingId('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const requestBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setBanner({ type: 'warning', message: 'Browser notifications are not supported on this device.' });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setBanner({ type: 'success', message: 'Browser alerts enabled for visitor entry updates.' });
      return;
    }

    setBanner({ type: 'warning', message: 'Notification permission was not granted.' });
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to mark the notification as read.' });
    }
  };

  const handleCopyPassText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      setBanner({ type: 'success', message: successMessage });
    } catch {
      setBanner({ type: 'warning', message: 'Clipboard access is not available in this browser.' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
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
            <Typography variant="h4">Resident Dashboard</Typography>
            <Typography color="text.secondary">
              Welcome {formatTextValue(user?.name, 'Resident')}{myFlat ? ` • Flat ${myFlat}` : ''}
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

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => navigate('/announcements')}>
            Announcements
          </Button>
          <Button variant="outlined" startIcon={<EventAvailableIcon />} onClick={() => navigate('/bookings')}>
            Facility Booking
          </Button>
          <Button variant="outlined" startIcon={<AccountBalanceWalletIcon />} onClick={() => navigate('/expenses')}>
            Maintenance Dues
          </Button>
          <Button variant="outlined" startIcon={<BugReportIcon />} onClick={() => navigate('/complaints')}>
            Complaint Desk
          </Button>
          <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/directory')}>
            Resident Directory
          </Button>
        </Box>

        {!myFlat && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Your profile does not have a flat number yet. Add one in Firestore to receive visitor approvals.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '1.05fr 1fr 0.95fr' },
            gap: 2,
          }}
        >
          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <QrCode2Icon color="primary" />
                <Typography variant="h6">Pre-Approve Visitor</Typography>
              </Stack>
              <Button variant="contained" onClick={() => setPassDialogOpen(true)}>
                Create Pass
              </Button>
            </Stack>
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              <Typography color="text.secondary">
                Generate a QR pass or OTP before your guest arrives. Each pass stays valid until two hours after the scheduled arrival.
              </Typography>
              <Chip label={`${preApprovedVisitors.length} active pre-approved pass${preApprovedVisitors.length === 1 ? '' : 'es'}`} color="info" variant="outlined" />
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <PersonAddAlt1Icon color="warning" />
              <Typography variant="h6">Pending Approvals</Typography>
            </Stack>
            <Stack spacing={1.5}>
              {pendingVisitors.length === 0 && (
                <Typography color="text.secondary">No visitors are waiting for approval.</Typography>
              )}
              {pendingVisitors.map((visitor) => (
                <Paper key={visitor.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography variant="subtitle1">{formatTextValue(visitor.name, 'Visitor')}</Typography>
                  <Typography color="text.secondary">{formatTextValue(visitor.purpose, 'Purpose not provided')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                    Arrival: {formatTextValue(visitor.time, formatDateTimeValue(visitor.expectedAt, 'Not specified'))}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={updatingId === visitor.id}
                      onClick={() => handleVisitorDecision(visitor.id, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={updatingId === visitor.id}
                      onClick={() => handleVisitorDecision(visitor.id, 'denied')}
                    >
                      Deny
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <HomeIcon color="primary" />
              <Typography variant="h6">Visitor Passes & Timeline</Typography>
            </Stack>
            <Stack spacing={1.5}>
              {myVisitors.length === 0 && (
                <Typography color="text.secondary">No visitor activity for your flat yet.</Typography>
              )}
              {myVisitors.map((visitor) => (
                <Paper key={visitor.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                      flexDirection: { xs: 'column', md: 'row' },
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1">{formatTextValue(visitor.name, 'Visitor')}</Typography>
                      <Typography color="text.secondary">{formatTextValue(visitor.purpose, 'Purpose not provided')}</Typography>
                      <Typography color="text.secondary">
                        {visitor.exitTime
                          ? `Exited: ${formatDateTimeValue(visitor.exitTime)}`
                          : visitor.checkedInAt
                            ? `Checked in: ${formatDateTimeValue(visitor.checkedInAt)}`
                            : visitor.passExpiresAt && visitor.status === 'preapproved'
                              ? `Valid until: ${formatDateTimeValue(visitor.passExpiresAt)}`
                              : visitor.passExpiresAt && visitor.status === 'expired'
                                ? `Expired at: ${formatDateTimeValue(visitor.passExpiresAt)}`
                            : visitor.expectedAt
                              ? `Expected: ${formatDateTimeValue(visitor.expectedAt)}`
                              : `Arrival: ${formatTextValue(visitor.time, 'Not specified')}`}
                      </Typography>
                      {visitor.otp && (
                        <Typography color="text.secondary">OTP: {formatTextValue(visitor.otp, '')}</Typography>
                      )}
                    </Box>
                    <Chip label={visitor.status || 'pending'} color={statusColorMap[visitor.status] || 'default'} />
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <NotificationsActiveIcon color="secondary" />
                <Typography variant="h6">Notifications</Typography>
              </Stack>
              <Button variant="text" onClick={requestBrowserAlerts}>
                Enable Alerts
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {notifications.length === 0 && (
                <Typography color="text.secondary">No notifications yet.</Typography>
              )}
              {notifications.slice(0, 6).map((notification) => (
                <Paper key={notification.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography variant="subtitle2">{formatTextValue(notification.title, 'Notification')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    {formatTextValue(notification.message, 'No message available.')}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {!notification.read && <Chip size="small" color="warning" label="New" />}
                    <Button size="small" onClick={() => handleMarkNotificationRead(notification.id)}>
                      Mark Read
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Dialog open={passDialogOpen} onClose={() => !creatingPass && setPassDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Visitor Pass</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Visitor name" name="visitorName" value={passForm.visitorName} onChange={handlePassFormChange} fullWidth />
            <TextField label="Purpose" name="purpose" value={passForm.purpose} onChange={handlePassFormChange} fullWidth />
            <TextField label="Phone" name="phone" value={passForm.phone} onChange={handlePassFormChange} fullWidth />
            <TextField
              label="Expected arrival"
              name="expectedAt"
              type="datetime-local"
              value={passForm.expectedAt}
              onChange={handlePassFormChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField label="Notes" name="notes" value={passForm.notes} onChange={handlePassFormChange} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPassDialogOpen(false)} disabled={creatingPass}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePass} disabled={creatingPass}>
            {creatingPass ? 'Creating...' : 'Generate Pass'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(createdPass)} onClose={() => setCreatedPass(null)} fullWidth maxWidth="sm">
        <DialogTitle>Visitor Pass Ready</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, alignItems: 'center', textAlign: 'center' }}>
            <Typography variant="h6">{formatTextValue(createdPass?.visitorName, 'Visitor')}</Typography>
            <Typography color="text.secondary">
              Expected at {formatDateTimeValue(createdPass?.expectedAt, 'the scheduled time')}
            </Typography>
            <Typography color="text.secondary">
              Valid until {formatDateTimeValue(createdPass?.passExpiresAt, 'two hours after arrival')}
            </Typography>
            {createdPass?.qrPayload && (
              <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2 }}>
                <QRCode value={createdPass.qrPayload} size={180} />
              </Box>
            )}
            <Chip color="primary" label={`OTP ${createdPass?.otp || ''}`} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button onClick={() => handleCopyPassText(createdPass?.otp || '', 'OTP copied to clipboard.')}>Copy OTP</Button>
              <Button onClick={() => handleCopyPassText(createdPass?.qrPayload || '', 'QR payload copied to clipboard.')}>Copy QR Payload</Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatedPass(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

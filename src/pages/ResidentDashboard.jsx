import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  ButtonBase,
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
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import CampaignIcon from '@mui/icons-material/Campaign';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupsIcon from '@mui/icons-material/Groups';
import BoltIcon from '@mui/icons-material/Bolt';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuthContext } from '../components/AuthContext';
import ChatbotWidget from '../components/ChatbotWidget';
import {
  createVisitorPass,
  markNotificationAsRead,
  normalizeFlat,
  seedResidentPaymentIfMissing,
  subscribeToNotifications,
  subscribeToResidentPayments,
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

const formatDateValue = (value, fallback = 'No due date') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const dashboardShellSx = {
  minHeight: '100vh',
  px: { xs: 2, md: 3 },
  py: { xs: 2.5, md: 3.5 },
  background: 'radial-gradient(circle at top left, rgba(255,255,255,0.82) 0%, rgba(248,243,231,0.96) 36%, #f4ecde 100%)',
};

const softCardSx = {
  p: 2.5,
  borderRadius: 4,
  background: 'rgba(255, 250, 242, 0.92)',
  border: '1px solid rgba(223, 199, 165, 0.4)',
  boxShadow: '0 14px 36px rgba(188, 155, 104, 0.14)',
};

const pillButtonSx = {
  justifyContent: 'flex-start',
  px: 1.8,
  py: 1.05,
  borderRadius: 999,
  color: 'primary.main',
  bgcolor: 'rgba(255,255,255,0.9)',
  borderColor: 'rgba(36, 86, 166, 0.16)',
  boxShadow: '0 10px 24px rgba(166, 138, 90, 0.12)',
  '&:hover': {
    borderColor: 'rgba(36, 86, 166, 0.32)',
    bgcolor: '#fff',
  },
};

const compactCardSx = {
  p: 2,
  borderRadius: 4,
  background: 'rgba(255, 251, 245, 0.94)',
  border: '1px solid rgba(223, 199, 165, 0.42)',
  boxShadow: '0 12px 28px rgba(188, 155, 104, 0.14)',
};

export default function ResidentDashboard() {
  const [visitors, setVisitors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payments, setPayments] = useState([]);
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
  const topSectionRef = useRef(null);
  const visitorsSectionRef = useRef(null);
  const duesSectionRef = useRef(null);
  const swipeStartRef = useRef({});

  useEffect(() => {
    const unsubscribe = subscribeToVisitors(setVisitors, user);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(user?.uid, setNotifications);
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    void seedResidentPaymentIfMissing(user);
    const unsubscribe = subscribeToResidentPayments(user.uid, setPayments, user);
    return () => unsubscribe();
  }, [user]);

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

  const pendingVisitors = useMemo(
    () => myVisitors.filter((visitor) => visitor.status === 'pending'),
    [myVisitors],
  );
  const preApprovedVisitors = useMemo(
    () => myVisitors.filter((visitor) => visitor.status === 'preapproved'),
    [myVisitors],
  );
  const duePayments = useMemo(
    () => payments.filter((payment) => payment.derivedStatus !== 'paid'),
    [payments],
  );

  const dueSummary = useMemo(() => {
    const outstandingAmount = duePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const nextDue = [...duePayments]
      .filter((payment) => payment.dueDate)
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0] || null;

    return {
      outstandingAmount,
      nextDue,
      openCount: duePayments.length,
    };
  }, [duePayments]);

  const leadNotification = notifications[0] || null;
  const spotlightVisitor = preApprovedVisitors[0] || pendingVisitors[0] || myVisitors[0] || null;
  const residentName = formatTextValue(user?.name, 'Resident');
  const residentFirstName = residentName.split(' ')[0];
  const residentInitials = residentName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'R';

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

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSwipeStart = (visitorId, event) => {
    swipeStartRef.current[visitorId] = event.changedTouches[0]?.clientX || 0;
  };

  const handleSwipeEnd = (visitor, event) => {
    const startX = swipeStartRef.current[visitor.id];
    delete swipeStartRef.current[visitor.id];

    if (typeof startX !== 'number') return;

    const endX = event.changedTouches[0]?.clientX || 0;
    const deltaX = endX - startX;
    const swipeThreshold = 72;

    if (Math.abs(deltaX) < swipeThreshold || updatingId === visitor.id) {
      return;
    }

    if (deltaX > 0) {
      void handleVisitorDecision(visitor.id, 'approved');
      return;
    }

    void handleVisitorDecision(visitor.id, 'denied');
  };

  return (
    <Box sx={{ ...dashboardShellSx, pb: { xs: 16, md: 3.5 } }}>
      <Box ref={topSectionRef} sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            ...softCardSx,
            display: { xs: 'block', md: 'none' },
            p: 1.5,
            borderRadius: 5,
            mb: 2,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                sx={{
                  width: 58,
                  height: 58,
                  bgcolor: 'rgba(255,255,255,0.94)',
                  color: 'primary.main',
                  boxShadow: '0 10px 20px rgba(166, 138, 90, 0.18)',
                  fontWeight: 800,
                }}
              >
                {residentInitials}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontSize: 22 }}>{residentName}</Typography>
                <Typography color="text.secondary">{myFlat ? `Flat ${myFlat}` : 'Flat not assigned'}</Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center">
              <IconButton
                onClick={requestBrowserAlerts}
                sx={{
                  bgcolor: 'rgba(243, 160, 72, 0.12)',
                  color: '#f3a048',
                  '&:hover': { bgcolor: 'rgba(243, 160, 72, 0.2)' },
                }}
              >
                <NotificationsActiveIcon fontSize="small" />
              </IconButton>
              <Button size="small" variant="text" color="secondary" onClick={handleLogout} sx={{ minWidth: 0 }}>
                Logout
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 1.75 }}>
            <Button variant="contained" sx={{ flex: 1, borderRadius: 2.5 }}>
              Visitors
            </Button>
            <Button variant="outlined" onClick={() => navigate('/expenses')} sx={{ flex: 1, borderRadius: 2.5 }}>
              Dues
            </Button>
            <Button variant="outlined" onClick={() => navigate('/complaints')} sx={{ flex: 1, borderRadius: 2.5 }}>
              Complaints
            </Button>
          </Stack>
        </Paper>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 3, display: { xs: 'none', md: 'flex' } }}
        >
          <Box>
            <Typography variant="h3" sx={{ fontSize: { xs: 32, md: 42 }, mb: 0.5 }}>
              Resident Dashboard
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 18, md: 22 } }}>
              Welcome {formatTextValue(user?.name, 'Resident')}{myFlat ? ` • Flat ${myFlat}` : ''}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ borderRadius: 999, px: 2.5, py: 1.1, bgcolor: 'rgba(255,250,242,0.88)' }}
          >
            Logout
          </Button>
        </Stack>

        {banner.message && (
          <Alert severity={banner.type} sx={{ mb: 3, borderRadius: 3 }}>
            {banner.message}
          </Alert>
        )}

        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', gap: 1.25, mb: 3 }}>
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => navigate('/announcements')} sx={pillButtonSx}>
            Announcements
          </Button>
          <Button variant="outlined" startIcon={<EventAvailableIcon />} onClick={() => navigate('/bookings')} sx={pillButtonSx}>
            Facility Booking
          </Button>
          <Button variant="outlined" startIcon={<AccountBalanceWalletIcon />} onClick={() => navigate('/expenses')} sx={pillButtonSx}>
            Maintenance Dues
          </Button>
          <Button variant="outlined" startIcon={<BugReportIcon />} onClick={() => navigate('/complaints')} sx={pillButtonSx}>
            Complaint Desk
          </Button>
          <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/directory')} sx={pillButtonSx}>
            Resident Directory
          </Button>
        </Box>

        {!myFlat && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
            Your profile does not have a flat number yet. Add one in Firestore to receive visitor approvals.
          </Alert>
        )}

        <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
          <Paper ref={visitorsSectionRef} elevation={0} sx={compactCardSx}>
            <Typography variant="h5" sx={{ fontSize: 24, mb: 1.5 }}>Pending Approval</Typography>

            {pendingVisitors[0] ? (
              <Paper
                variant="outlined"
                onTouchStart={(event) => handleSwipeStart(pendingVisitors[0].id, event)}
                onTouchEnd={(event) => handleSwipeEnd(pendingVisitors[0], event)}
                sx={{
                  p: 2,
                  borderRadius: 4,
                  borderColor: 'rgba(223, 199, 165, 0.48)',
                  bgcolor: 'rgba(255,255,255,0.84)',
                  boxShadow: '0 12px 24px rgba(188, 155, 104, 0.1)',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 1.75 }}>
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'rgba(36, 86, 166, 0.12)',
                      color: 'primary.main',
                      flexShrink: 0,
                    }}
                  >
                    <QrCode2Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">{formatTextValue(pendingVisitors[0].name, 'Visitor')}</Typography>
                    <Typography color="text.secondary">{formatTextValue(pendingVisitors[0].purpose, 'Guest visit')}</Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
                      <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography color="text.secondary">
                        Arriving, {formatTextValue(pendingVisitors[0].time, formatDateTimeValue(pendingVisitors[0].expectedAt, 'Not specified'))}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    disabled={updatingId === pendingVisitors[0].id}
                    onClick={() => handleVisitorDecision(pendingVisitors[0].id, 'approved')}
                    sx={{ minHeight: 52, fontSize: 18, borderRadius: 2.75 }}
                  >
                    Approve
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    color="error"
                    disabled={updatingId === pendingVisitors[0].id}
                    onClick={() => handleVisitorDecision(pendingVisitors[0].id, 'denied')}
                    sx={{ minHeight: 52, fontSize: 18, borderRadius: 2.75 }}
                  >
                    Deny
                  </Button>
                </Stack>

                <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                  Swipe right to approve or left to deny
                </Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 4,
                  borderColor: 'rgba(223, 199, 165, 0.48)',
                  bgcolor: 'rgba(255,255,255,0.84)',
                }}
              >
                <Typography variant="subtitle1">No pending approvals</Typography>
                <Typography color="text.secondary">Create a visitor pass with the plus button or wait for a new gate request.</Typography>
              </Paper>
            )}
          </Paper>

          <Paper elevation={0} sx={compactCardSx}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <BoltIcon color="secondary" />
              <Typography variant="h5" sx={{ fontSize: 24 }}>Notifications</Typography>
            </Stack>

            {leadNotification ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.75,
                  borderRadius: 4,
                  borderColor: 'rgba(223, 199, 165, 0.48)',
                  bgcolor: 'rgba(255,255,255,0.84)',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Chip size="small" label={!leadNotification.read ? 'Alert' : 'Update'} color="warning" sx={{ borderRadius: 999, mt: 0.25 }} />
                    <Typography sx={{ fontSize: 16.5 }}>
                      {formatTextValue(leadNotification.message, 'No message available.')}
                    </Typography>
                  </Stack>
                  {!leadNotification.read && (
                    <Button size="small" onClick={() => handleMarkNotificationRead(leadNotification.id)} sx={{ flexShrink: 0 }}>
                      Mark Read
                    </Button>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.75,
                  borderRadius: 4,
                  borderColor: 'rgba(223, 199, 165, 0.48)',
                  bgcolor: 'rgba(255,255,255,0.84)',
                }}
              >
                <Typography variant="subtitle1">No alerts right now</Typography>
                <Typography color="text.secondary">Resident notifications will appear here when guards or admins trigger them.</Typography>
              </Paper>
            )}
          </Paper>

          <Paper
            ref={duesSectionRef}
            elevation={0}
            sx={{
              ...compactCardSx,
              p: 0,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(187, 211, 241, 0.95) 0%, rgba(210, 228, 248, 0.92) 48%, rgba(188, 214, 239, 0.86) 100%)',
            }}
          >
            <Box sx={{ p: 2.1 }}>
              <Typography variant="h5" sx={{ fontSize: 22, color: 'primary.main', textDecoration: 'underline', mb: 1.75 }}>
                Maintenance Due
              </Typography>
              <Typography sx={{ fontSize: 18, mb: 2 }}>
                Due: <Box component="span" sx={{ fontWeight: 800 }}>{formatCurrency(dueSummary.nextDue?.amount || dueSummary.outstandingAmount)}</Box>
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={() => navigate('/expenses')}
                sx={{ minWidth: 150, minHeight: 52, borderRadius: 2.75, fontSize: 18 }}
              >
                Pay Now
              </Button>
            </Box>
          </Paper>
        </Stack>

        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr 0.95fr' },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          <Paper elevation={0} sx={softCardSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2.5 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <QrCode2Icon color="primary" />
                <Typography variant="h5" sx={{ fontSize: { xs: 28, md: 34 }, lineHeight: 1.08 }}>
                  Pre-Approve
                  <br />
                  Visitor
                </Typography>
              </Stack>
              <Button variant="contained" onClick={() => setPassDialogOpen(true)} sx={{ minWidth: 118, minHeight: 86, borderRadius: 3 }}>
                Create
                <br />
                Pass
              </Button>
            </Stack>

            <Typography color="text.secondary" sx={{ fontSize: 18, maxWidth: 320, mb: 2.5 }}>
              Generate a QR pass or OTP before your guest arrives. Each pass stays valid until two hours after the scheduled arrival.
            </Typography>

            <Chip
              label={`${preApprovedVisitors.length} active pre-approved pass${preApprovedVisitors.length === 1 ? '' : 'es'}`}
              variant="outlined"
              sx={{
                mb: 3,
                width: 'fit-content',
                borderRadius: 999,
                borderColor: 'rgba(93, 143, 214, 0.42)',
                color: 'primary.main',
                bgcolor: 'rgba(239, 247, 255, 0.85)',
              }}
            />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <PersonAddAlt1Icon color="secondary" />
              <Typography variant="h5" sx={{ fontSize: 24 }}>
                Pending Approvals
              </Typography>
            </Stack>

            <Stack spacing={1.5}>
              {pendingVisitors.length === 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 3.5,
                    borderColor: 'rgba(223, 199, 165, 0.52)',
                    bgcolor: 'rgba(255,255,255,0.72)',
                  }}
                >
                  <Typography variant="subtitle1">No visitors waiting</Typography>
                  <Typography color="text.secondary">New gate approvals will appear here as soon as guards log them.</Typography>
                </Paper>
              )}
              {pendingVisitors.map((visitor) => (
                <Paper
                  key={visitor.id}
                  variant="outlined"
                  sx={{
                    p: 2.25,
                    borderRadius: 3.5,
                    borderColor: 'rgba(223, 199, 165, 0.52)',
                    bgcolor: 'rgba(255,255,255,0.72)',
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 0.5 }}>{formatTextValue(visitor.name, 'Visitor')}</Typography>
                  <Typography sx={{ color: '#4d6284', mb: 0.5 }}>{formatTextValue(visitor.purpose, 'Purpose not provided')}</Typography>
                  <Typography color="text.secondary" sx={{ mb: 1.8 }}>
                    Arrival: {formatTextValue(visitor.time, formatDateTimeValue(visitor.expectedAt, 'Not specified'))}
                  </Typography>
                  <Stack direction="row" spacing={1.2}>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={updatingId === visitor.id}
                      onClick={() => handleVisitorDecision(visitor.id, 'approved')}
                      sx={{ minWidth: 96 }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={updatingId === visitor.id}
                      onClick={() => handleVisitorDecision(visitor.id, 'denied')}
                      sx={{ minWidth: 88, bgcolor: 'rgba(255,255,255,0.7)' }}
                    >
                      Deny
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={softCardSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.25 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BoltIcon color="secondary" />
                <Typography variant="h4" sx={{ fontSize: 24 }}>
                  Notifications
                </Typography>
              </Stack>
              <Button size="small" onClick={requestBrowserAlerts} sx={{ borderRadius: 999 }}>
                Enable Alerts
              </Button>
            </Stack>

            {leadNotification ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 4,
                  mb: 1.5,
                  borderColor: 'rgba(223, 199, 165, 0.5)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,249,240,0.86) 100%)',
                }}
              >
                <Typography sx={{ fontSize: 18, mb: 1.5 }}>{formatTextValue(leadNotification.message, 'No message available.')}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Chip
                    size="small"
                    label={!leadNotification.read ? 'Alert' : 'Update'}
                    color={!leadNotification.read ? 'warning' : 'default'}
                    sx={{ borderRadius: 999 }}
                  />
                  <Typography variant="subtitle1">{formatTextValue(leadNotification.title, 'Notification')}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {notifications.slice(0, 3).map((notification, index) => (
                    <Box
                      key={notification.id}
                      sx={{
                        width: index === 0 ? 12 : 10,
                        height: index === 0 ? 12 : 10,
                        borderRadius: '50%',
                        bgcolor: index === 0 ? 'rgba(36, 86, 166, 0.58)' : 'rgba(171, 165, 156, 0.38)',
                      }}
                    />
                  ))}
                </Stack>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  borderColor: 'rgba(223, 199, 165, 0.52)',
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                <Stack spacing={1} alignItems="flex-start">
                  <NotificationsNoneIcon color="disabled" />
                  <Typography variant="subtitle1">No notifications yet</Typography>
                  <Typography color="text.secondary">Gate alerts and resident updates will appear here.</Typography>
                </Stack>
              </Paper>
            )}

            <Stack spacing={1.2} sx={{ mt: 2.2 }}>
              {notifications.slice(0, 3).map((notification) => (
                <Paper
                  key={notification.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    borderColor: 'rgba(223, 199, 165, 0.46)',
                    bgcolor: 'rgba(255,255,255,0.64)',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>{formatTextValue(notification.title, 'Notification')}</Typography>
                      <Typography color="text.secondary" variant="body2" noWrap>{formatTextValue(notification.message, 'No message available.')}</Typography>
                    </Box>
                    {!notification.read && (
                      <Button size="small" onClick={() => handleMarkNotificationRead(notification.id)}>
                        Mark Read
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={softCardSx}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <CreditCardIcon color="secondary" />
              <Typography variant="h4" sx={{ fontSize: 24 }}>
                Maintenance Dues
              </Typography>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 4,
                mb: 2.2,
                borderColor: 'rgba(173, 194, 223, 0.72)',
                bgcolor: 'rgba(229, 236, 247, 0.9)',
              }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                <Box>
                  <Typography color="text.secondary">{formatTextValue(user?.name, 'Resident')} owes</Typography>
                  <Typography color="text.secondary" sx={{ mt: 2 }}>Next due amount</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5 }}>Due date</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 40 }, mb: 2 }}>
                    {formatCurrency(dueSummary.outstandingAmount)}
                  </Typography>
                  <Typography sx={{ color: 'primary.main', fontWeight: 700 }}>
                    {formatCurrency(dueSummary.nextDue?.amount || 0)}
                  </Typography>
                  <Typography sx={{ mt: 1.25, fontWeight: 700 }}>
                    {formatDateValue(dueSummary.nextDue?.dueDate)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Chip
              label={`${dueSummary.openCount} open bill${dueSummary.openCount === 1 ? '' : 's'}`}
              variant="outlined"
              sx={{ mb: 2.5, bgcolor: 'rgba(255,255,255,0.65)' }}
            />

            <Button
              variant="contained"
              color="success"
              fullWidth
              onClick={() => navigate('/expenses')}
              sx={{ minHeight: 46, borderRadius: 3, fontSize: 22 }}
            >
              Pay Now
            </Button>
          </Paper>

          <Box sx={{ gridColumn: { xs: '1', lg: '2 / 4' } }}>
            <Paper
              elevation={0}
              sx={{
                ...softCardSx,
                p: 0,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(189, 211, 238, 0.92) 0%, rgba(214, 228, 245, 0.9) 44%, rgba(188, 212, 238, 0.78) 100%)',
              }}
            >
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: { xs: 2.5, md: 2.75 },
                  position: 'relative',
                  minHeight: 180,
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        position: 'relative',
                        width: 88,
                        height: 88,
                        borderRadius: '50%',
                        background: 'conic-gradient(from 18deg, #f3a048 0deg 292deg, rgba(255,255,255,0.65) 292deg 360deg)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 68,
                          height: 68,
                          borderRadius: '50%',
                          bgcolor: 'rgba(247, 244, 237, 0.94)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          color: '#3d4d6e',
                          fontSize: 18,
                        }}
                      >
                        {spotlightVisitor ? 'Alert' : 'Ready'}
                      </Box>
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: 18, color: '#4b6387', mb: 0.5 }}>
                        {spotlightVisitor?.status === 'preapproved' ? 'Open pre-approved pass' : spotlightVisitor?.status === 'pending' ? 'Open visitor approval' : 'Visitor update'}
                      </Typography>
                      <Typography variant="h5" sx={{ mb: 0.5 }}>
                        {formatTextValue(spotlightVisitor?.name, spotlightVisitor ? 'Visitor' : 'No active pass yet')}
                      </Typography>
                      <Typography sx={{ color: '#4f6382' }}>
                        {spotlightVisitor
                          ? formatTextValue(spotlightVisitor.purpose, 'Guest visit')
                          : 'Create a pass to keep guest entry smooth at the gate.'}
                      </Typography>
                      <Typography sx={{ color: '#4f6382', mt: 0.5 }}>
                        {spotlightVisitor?.otp
                          ? `OTP: ${spotlightVisitor.otp}`
                          : spotlightVisitor?.expectedAt
                            ? `Arrival: ${formatDateTimeValue(spotlightVisitor.expectedAt)}`
                            : 'Resident concierge is ready for the next request.'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1.25}>
                    <Chip
                      icon={<SmartToyIcon />}
                      label="AI Concierge active"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.9)',
                        borderRadius: 999,
                        '& .MuiChip-icon': { color: '#d48b33' },
                      }}
                    />
                    <Stack direction="row" spacing={1}>
                      {spotlightVisitor?.otp && (
                        <Button variant="outlined" onClick={() => handleCopyPassText(spotlightVisitor.otp, 'OTP copied to clipboard.')}>
                          Copy OTP
                        </Button>
                      )}
                      <Button variant="contained" onClick={() => navigate('/expenses')} startIcon={<CreditCardIcon />}>
                        Open Dues
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <ChatbotWidget
        variant="bubble"
        greetingName={residentFirstName}
        bottomOffset={{ xs: 104, md: 24 }}
      />

      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          px: 1.5,
          zIndex: 1100,
        }}
      >
        <Box sx={{ maxWidth: 430, mx: 'auto', position: 'relative' }}>
          <Paper
            elevation={10}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 72px 1fr 1fr',
              alignItems: 'center',
              px: 1,
              py: 1.2,
              borderRadius: 999,
              bgcolor: 'rgba(255, 250, 242, 0.98)',
              border: '1px solid rgba(223, 199, 165, 0.46)',
              boxShadow: '0 18px 34px rgba(120, 108, 88, 0.16)',
            }}
          >
            <ButtonBase onClick={() => scrollToSection(topSectionRef)} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <HomeIcon sx={{ color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Home</Typography>
              </Stack>
            </ButtonBase>

            <ButtonBase onClick={() => scrollToSection(visitorsSectionRef)} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <QrCode2Icon sx={{ color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Visitors</Typography>
              </Stack>
            </ButtonBase>

            <Box />

            <ButtonBase onClick={() => scrollToSection(duesSectionRef)} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <AccountBalanceWalletIcon sx={{ color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Dues</Typography>
              </Stack>
            </ButtonBase>

            <ButtonBase onClick={() => navigate('/directory')} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <GroupsIcon sx={{ color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Directory</Typography>
              </Stack>
            </ButtonBase>
          </Paper>

          <Button
            variant="contained"
            onClick={() => setPassDialogOpen(true)}
            sx={{
              position: 'absolute',
              left: '50%',
              top: -26,
              transform: 'translateX(-50%)',
              minWidth: 72,
              width: 72,
              height: 72,
              borderRadius: '50%',
              boxShadow: '0 18px 30px rgba(36, 86, 166, 0.34)',
            }}
          >
            <AddIcon sx={{ fontSize: 34 }} />
          </Button>
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

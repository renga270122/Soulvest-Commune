import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import BadgeIcon from '@mui/icons-material/Badge';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/AuthContext';
import {
  clockInStaff,
  clockOutStaff,
  subscribeToMyAttendance,
  subscribeToStaffAttendance,
  subscribeToVisitors,
} from '../services/communityData';

const statusColorMap = {
  clocked_in: 'success',
  clocked_out: 'default',
};

const visitorStatusColorMap = {
  pending: 'warning',
  approved: 'success',
  checked_in: 'success',
  checked_out: 'default',
  denied: 'error',
  expired: 'error',
  preapproved: 'info',
};

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
  if (value?.toDate) return value.toDate().toLocaleString();
  return 'Not recorded';
};

export default function SecurityLogs() {
  const { user } = useAuthContext();
  const [attendance, setAttendance] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubAttendance = subscribeToStaffAttendance(setAttendance, user);
    const unsubMyAttendance = subscribeToMyAttendance(user?.uid, setMyAttendance, user);
    const unsubVisitors = subscribeToVisitors(setVisitors, user);
    return () => {
      unsubAttendance();
      unsubMyAttendance();
      unsubVisitors();
    };
  }, [user?.uid]);

  const activeShift = useMemo(
    () => myAttendance.find((entry) => entry.status === 'clocked_in'),
    [myAttendance],
  );

  const stats = useMemo(() => ({
    activeStaff: attendance.filter((entry) => entry.status === 'clocked_in').length,
    checkedInVisitors: visitors.filter((entry) => entry.status === 'checked_in').length,
    completedVisits: visitors.filter((entry) => entry.status === 'checked_out').length,
    pendingApprovals: visitors.filter((entry) => entry.status === 'pending').length,
  }), [attendance, visitors]);

  const handleClockIn = async () => {
    setSubmitting(true);
    setBanner({ type: '', message: '' });
    try {
      await clockInStaff(user, { notes: attendanceNotes });
      setBanner({ type: 'success', message: 'Shift started and attendance logged.' });
      setAttendanceNotes('');
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to clock in.' });
    }
    setSubmitting(false);
  };

  const handleClockOut = async () => {
    setSubmitting(true);
    setBanner({ type: '', message: '' });
    try {
      await clockOutStaff(activeShift?.id, user, { notes: attendanceNotes });
      setBanner({ type: 'success', message: 'Shift ended and attendance updated.' });
      setAttendanceNotes('');
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to clock out.' });
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Security Logs</Typography>
            <Typography color="text.secondary">
              Monitor staff attendance and visitor entry or exit activity from one place.
            </Typography>
          </Box>
          <Chip label={(user?.role || 'staff').toUpperCase()} color="primary" variant="outlined" />
        </Stack>

        {banner.message && <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Staff On Duty</Typography>
            <Typography variant="h4">{stats.activeStaff}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Checked-In Visitors</Typography>
            <Typography variant="h4">{stats.checkedInVisitors}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Completed Visits</Typography>
            <Typography variant="h4">{stats.completedVisits}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Pending Approvals</Typography>
            <Typography variant="h4">{stats.pendingApprovals}</Typography>
          </Paper>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '0.95fr 1.05fr' }, gap: 2 }}>
          <Stack spacing={2}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <BadgeIcon color="primary" />
                <Typography variant="h6">Staff Attendance</Typography>
              </Stack>
              <TextField
                label="Shift notes"
                value={attendanceNotes}
                onChange={(event) => setAttendanceNotes(event.target.value)}
                fullWidth
                multiline
                minRows={2}
                sx={{ mb: 2 }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <Button variant="contained" startIcon={<LoginIcon />} disabled={Boolean(activeShift) || submitting} onClick={handleClockIn}>
                  Clock In
                </Button>
                <Button variant="outlined" color="secondary" startIcon={<LogoutIcon />} disabled={!activeShift || submitting} onClick={handleClockOut}>
                  Clock Out
                </Button>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {activeShift ? `Active shift started at ${formatDateTime(activeShift.clockInAt)}.` : 'No active shift logged for your account.'}
              </Typography>
              <Stack spacing={1.5}>
                {attendance.slice(0, 8).map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="subtitle1">{entry.name}</Typography>
                        <Typography color="text.secondary">{entry.role || 'staff'} • {entry.shift || 'general'}</Typography>
                        <Typography color="text.secondary">In: {formatDateTime(entry.clockInAt)}</Typography>
                        <Typography color="text.secondary">Out: {formatDateTime(entry.clockOutAt)}</Typography>
                      </Box>
                      <Chip label={entry.status || 'clocked_out'} color={statusColorMap[entry.status] || 'default'} />
                    </Stack>
                  </Paper>
                ))}
                {attendance.length === 0 && <Typography color="text.secondary">No attendance records yet.</Typography>}
              </Stack>
            </Paper>
          </Stack>

          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <DirectionsWalkIcon color="primary" />
              <Typography variant="h6">Visitor Entry & Exit Records</Typography>
            </Stack>
            <Stack spacing={1.5}>
              {visitors.slice(0, 12).map((entry) => (
                <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="subtitle1">{entry.name}</Typography>
                      <Typography color="text.secondary">Flat {entry.flat} • {entry.purpose}</Typography>
                      <Typography color="text.secondary">Expected: {entry.expectedAt ? formatDateTime(entry.expectedAt) : entry.time || 'Not specified'}</Typography>
                      <Typography color="text.secondary">Checked in: {formatDateTime(entry.checkedInAt)}</Typography>
                      <Typography color="text.secondary">Exited: {formatDateTime(entry.exitTime)}</Typography>
                    </Box>
                    <Chip label={entry.status || 'pending'} color={visitorStatusColorMap[entry.status] || 'default'} />
                  </Stack>
                </Paper>
              ))}
              {visitors.length === 0 && <Typography color="text.secondary">No visitor records yet.</Typography>}
            </Stack>
          </Paper>
        </Box>
      </Box>

      {user?.role === 'resident' ? <Navbar /> : null}
    </Box>
  );
}
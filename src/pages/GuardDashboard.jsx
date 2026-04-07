import React, { useEffect, useMemo, useState } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../components/AuthContext';
import ChatbotWidget from '../components/ChatbotWidget';
import { createVisitor, subscribeToVisitors, verifyVisitorPass } from '../services/communityData';

const statusColorMap = {
  approved: 'success',
  checked_in: 'success',
  denied: 'error',
  pending: 'warning',
  preapproved: 'info',
};

export default function GuardDashboard() {
  const [visitors, setVisitors] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [visitor, setVisitor] = useState({ name: '', flat: '', purpose: '', time: '' });
  const [submitting, setSubmitting] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToVisitors(setVisitors);
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => ({
    total: visitors.length,
    pending: visitors.filter((entry) => entry.status === 'pending').length,
    preapproved: visitors.filter((entry) => entry.status === 'preapproved').length,
    checkedIn: visitors.filter((entry) => entry.status === 'checked_in').length,
  }), [visitors]);

  const handleChange = (event) => {
    setVisitor((currentVisitor) => ({
      ...currentVisitor,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!visitor.name || !visitor.flat || !visitor.purpose || !visitor.time) {
      setBanner({ type: 'error', message: 'All visitor fields are required.' });
      return;
    }

    setSubmitting(true);
    setBanner({ type: '', message: '' });
    try {
      await createVisitor(visitor);
      setVisitor({ name: '', flat: '', purpose: '', time: '' });
      setDialogOpen(false);
      setBanner({ type: 'success', message: 'Visitor logged successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to log visitor.' });
    }
    setSubmitting(false);
  };

  const handleVerifyPass = async () => {
    if (!verificationCode.trim()) {
      setBanner({ type: 'error', message: 'Enter an OTP or paste the QR payload to verify the visitor.' });
      return;
    }

    setVerifying(true);
    setBanner({ type: '', message: '' });
    try {
      const verifiedVisitor = await verifyVisitorPass(verificationCode, user);
      setVerifyDialogOpen(false);
      setVerificationCode('');
      setBanner({ type: 'success', message: `${verifiedVisitor.name || verifiedVisitor.visitorName} checked in successfully.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to verify this visitor pass.' });
    }
    setVerifying(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
            <Typography variant="h4">Guard Dashboard</Typography>
            <Typography color="text.secondary">
              Welcome {user?.name || 'Guard'}. Verify visitor passes, log walk-ins, and monitor gate activity.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<QrCode2Icon />} onClick={() => setVerifyDialogOpen(true)}>
              Verify Pass
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Log Walk-in
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<LogoutIcon />} onClick={handleLogout}>
              Logout
            </Button>
          </Stack>
        </Box>

        {banner.message && (
          <Alert severity={banner.type} sx={{ mb: 3 }}>
            {banner.message}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">All Logs</Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Pre-Approved Passes</Typography>
            <Typography variant="h4">{stats.preapproved}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Checked-In Visitors</Typography>
            <Typography variant="h4">{stats.checkedIn}</Typography>
          </Paper>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ready To Verify
            </Typography>
            <Stack spacing={1.5}>
              {visitors.filter((entry) => entry.status === 'preapproved').length === 0 && (
                <Typography color="text.secondary">No pre-approved passes are waiting at the gate.</Typography>
              )}

              {visitors.filter((entry) => entry.status === 'preapproved').slice(0, 6).map((entry) => (
                <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography variant="subtitle1">{entry.name}</Typography>
                  <Typography color="text.secondary">Flat {entry.flat} • {entry.purpose}</Typography>
                  <Typography color="text.secondary">OTP {entry.otp}</Typography>
                  <Typography color="text.secondary">
                    Expected: {entry.expectedAt ? new Date(entry.expectedAt).toLocaleString() : 'Not specified'}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recent Visitors
            </Typography>
            <Stack spacing={1.5}>
              {visitors.length === 0 && (
                <Typography color="text.secondary">No visitors logged yet.</Typography>
              )}

              {visitors.slice(0, 8).map((entry) => (
                <Paper
                  key={entry.id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.55)' }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1">{entry.name}</Typography>
                      <Typography color="text.secondary">
                        Flat {entry.flat} • {entry.purpose}
                      </Typography>
                      <Typography color="text.secondary">
                        {entry.checkedInAt ? 'Checked in' : entry.expectedAt ? `Expected: ${new Date(entry.expectedAt).toLocaleString()}` : `Arrival: ${entry.time}`}
                      </Typography>
                    </Box>
                    <Chip label={entry.status || 'pending'} color={statusColorMap[entry.status] || 'default'} />
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Log Walk-in Visitor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Visitor name" name="name" value={visitor.name} onChange={handleChange} fullWidth />
            <TextField label="Flat number" name="flat" value={visitor.flat} onChange={handleChange} fullWidth />
            <TextField label="Purpose" name="purpose" value={visitor.purpose} onChange={handleChange} fullWidth />
            <TextField
              label="Expected time"
              name="time"
              type="datetime-local"
              value={visitor.time}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Visitor'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={verifyDialogOpen} onClose={() => !verifying && setVerifyDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Verify Visitor Pass</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              Scan the resident QR into a text field or enter the 6-digit OTP manually.
            </Typography>
            <TextField
              label="OTP or QR payload"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyDialogOpen(false)} disabled={verifying}>Cancel</Button>
          <Button variant="contained" onClick={handleVerifyPass} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify & Check In'}
          </Button>
        </DialogActions>
      </Dialog>

      <ChatbotWidget />
    </Box>
  );
}

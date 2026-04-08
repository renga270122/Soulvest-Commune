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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/AuthContext';
import {
  createComplaint,
  subscribeToComplaints,
  subscribeToResidentComplaints,
  updateComplaintStatus,
} from '../services/communityData';
import { useLocation } from 'react-router-dom';

const complaintCategories = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'lift', label: 'Lift' },
  { value: 'security', label: 'Security' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'staff-access', label: 'Staff Access' },
  { value: 'general', label: 'General' },
];

const getCategoryLabel = (value) => complaintCategories.find((entry) => entry.value === value)?.label || value;

const priorityColor = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const statusColor = {
  open: 'warning',
  inprogress: 'info',
  resolved: 'success',
};

const formatTimestamp = (value) => {
  if (!value) return 'Just now';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (value?.toDate) return value.toDate().toLocaleString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
  return 'Just now';
};

export default function Complaints() {
  const { user } = useAuthContext();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const [complaints, setComplaints] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [form, setForm] = useState({ category: 'plumbing', description: '' });
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = isAdmin
      ? subscribeToComplaints(setComplaints, { context: user })
      : subscribeToResidentComplaints(user?.uid, setComplaints, user);
    return () => unsubscribe();
  }, [isAdmin, user?.uid]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const category = params.get('category');
    const source = params.get('source');

    if (!category) return;

    setForm((current) => ({
      ...current,
      category,
      description: current.description || (source ? `Issue noticed in ${source.replace('-', ' ')} flow.` : ''),
    }));

    if (!isAdmin) {
      setDialogOpen(true);
    }
  }, [isAdmin, location.search]);

  const summary = useMemo(() => ({
    total: complaints.length,
    open: complaints.filter((item) => item.status === 'open').length,
    inprogress: complaints.filter((item) => item.status === 'inprogress').length,
    resolved: complaints.filter((item) => item.status === 'resolved').length,
  }), [complaints]);

  const filteredComplaints = useMemo(
    () => (statusFilter === 'all' ? complaints : complaints.filter((item) => item.status === statusFilter)),
    [complaints, statusFilter],
  );

  const handleOpenComplaintDialog = (category = 'plumbing') => {
    setForm((current) => ({
      ...current,
      category,
    }));
    setDialogOpen(true);
  };

  const handleCreateComplaint = async () => {
    if (!form.description) {
      setBanner({ type: 'error', message: 'Describe the issue before submitting.' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', message: '' });
    try {
      await createComplaint({
        ...form,
        residentId: user?.uid || '',
        residentName: user?.name || 'Resident',
        flat: user?.flat || '',
        societyId: user?.societyId,
      });
      setForm({ category: 'plumbing', description: '' });
      setDialogOpen(false);
      setBanner({ type: 'success', message: 'Complaint submitted successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to submit complaint.' });
    }
    setSaving(false);
  };

  const handleStatusChange = async (complaintId, status) => {
    try {
      await updateComplaintStatus(complaintId, status, {
        uid: user?.uid || '',
        name: user?.name || 'Admin',
        societyId: user?.societyId,
      });
      setBanner({ type: 'success', message: `Complaint moved to ${status}.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to update complaint status.' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Complaint Desk</Typography>
            <Typography color="text.secondary">
              Residents can raise issues with categories and admins can move them transparently from open to resolved.
            </Typography>
          </Box>
          {!isAdmin && <Button variant="contained" onClick={() => handleOpenComplaintDialog(form.category)}>Raise Complaint</Button>}
        </Stack>

        {banner.message && <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert>}

        {!isAdmin && (
          <Paper elevation={1} sx={{ p: 2, borderRadius: 3, mb: 3, display: { xs: 'block', md: 'none' } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
              <Typography variant="h6">Quick Report</Typography>
              <Chip label="Mobile" size="small" color="primary" sx={{ borderRadius: 999 }} />
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              {['security', 'staff-access', 'delivery', 'housekeeping'].map((category) => (
                <Button
                  key={category}
                  variant="outlined"
                  onClick={() => handleOpenComplaintDialog(category)}
                  sx={{ minHeight: 58, borderRadius: 3 }}
                >
                  {getCategoryLabel(category)}
                </Button>
              ))}
            </Box>
          </Paper>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Total Complaints</Typography>
            <Typography variant="h4">{summary.total}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Open</Typography>
            <Typography variant="h4">{summary.open}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">In Progress</Typography>
            <Typography variant="h4">{summary.inprogress}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Resolved</Typography>
            <Typography variant="h4">{summary.resolved}</Typography>
          </Paper>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
          {[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'inprogress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
          ].map((entry) => (
            <Chip
              key={entry.value}
              label={entry.label}
              color={statusFilter === entry.value ? 'primary' : 'default'}
              variant={statusFilter === entry.value ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(entry.value)}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>

        <Stack spacing={2}>
          {filteredComplaints.length === 0 && (
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6">No complaints in this view</Typography>
              <Typography color="text.secondary">Switch filters or raise a new issue to start tracking it here.</Typography>
            </Paper>
          )}

          {filteredComplaints.map((complaint) => (
            <Paper key={complaint.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="h6">{getCategoryLabel(complaint.category)}</Typography>
                    <Typography color="text.secondary">
                      {complaint.residentName || 'Resident'}{complaint.flat ? ` • Flat ${complaint.flat}` : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip label={complaint.status} color={statusColor[complaint.status] || 'default'} />
                    <Chip label={`${complaint.aiPriority || 'low'} priority`} color={priorityColor[complaint.aiPriority] || 'default'} variant="outlined" />
                  </Stack>
                </Stack>
                <Typography>{complaint.description}</Typography>
                <Typography color="text.secondary">Opened {formatTimestamp(complaint.createdAt)}</Typography>
                {complaint.adminNotes && <Typography color="text.secondary">Admin note: {complaint.adminNotes}</Typography>}
                {complaint.resolutionNote && <Typography color="text.secondary">Resolution: {complaint.resolutionNote}</Typography>}
                {isAdmin && complaint.status !== 'resolved' && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    {complaint.status === 'open' && (
                      <Button variant="outlined" onClick={() => handleStatusChange(complaint.id, 'inprogress')}>
                        Move To In Progress
                      </Button>
                    )}
                    <Button variant="contained" color="success" onClick={() => handleStatusChange(complaint.id, 'resolved')}>
                      Mark Resolved
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Raise New Complaint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {complaintCategories.map((category) => (
                <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Describe the issue"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateComplaint} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Complaint'}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}

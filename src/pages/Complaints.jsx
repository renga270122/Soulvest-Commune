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
import { useAuthContext } from '../components/auth-context';
import {
  createComplaint,
  subscribeToComplaints,
  subscribeToResidentComplaints,
  updateComplaintStatus,
} from '../services/communityData';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const complaintCategories = [
  { value: 'plumbing', labelKey: 'complaints.categories.plumbing' },
  { value: 'electrical', labelKey: 'complaints.categories.electrical' },
  { value: 'lift', labelKey: 'complaints.categories.lift' },
  { value: 'security', labelKey: 'complaints.categories.security' },
  { value: 'housekeeping', labelKey: 'complaints.categories.housekeeping' },
  { value: 'delivery', labelKey: 'complaints.categories.delivery' },
  { value: 'staff-access', labelKey: 'complaints.categories.staffAccess' },
  { value: 'general', labelKey: 'complaints.categories.general' },
];

const getCategoryLabel = (value, t) => {
  const match = complaintCategories.find((entry) => entry.value === value);
  return match ? t(match.labelKey) : value;
};

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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const prefilledCategory = searchParams.get('category');
  const prefilledSource = searchParams.get('source');
  const [complaints, setComplaints] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(() => Boolean(prefilledCategory && !isAdmin));
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [form, setForm] = useState(() => ({
    category: prefilledCategory || 'plumbing',
    description: prefilledSource ? t('complaints.issueNoticedInFlow', { source: prefilledSource.replace('-', ' ') }) : '',
  }));
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = isAdmin
      ? subscribeToComplaints(setComplaints, { context: user })
      : subscribeToResidentComplaints(user?.uid, setComplaints, user);
    return () => unsubscribe();
  }, [isAdmin, user]);

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
      setBanner({ type: 'error', message: t('complaints.messages.describeIssue') });
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
      setBanner({ type: 'success', message: t('complaints.messages.submitted') });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || t('complaints.messages.submitFailed') });
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
      setBanner({ type: 'success', message: t('complaints.messages.statusMoved', { status }) });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || t('complaints.messages.statusFailed') });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">{t('complaints.title')}</Typography>
            <Typography color="text.secondary">
              {t('complaints.subtitle')}
            </Typography>
          </Box>
          {!isAdmin && <Button variant="contained" onClick={() => handleOpenComplaintDialog(form.category)}>{t('complaints.raiseComplaint')}</Button>}
        </Stack>

        {banner.message && <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert>}

        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 0.75 }}>Issue tracking that residents can trust</Typography>
              <Typography color="text.secondary">
                Residents can log issues quickly, track status changes clearly, and see resolution progress without leaving the app.
              </Typography>
            </Box>
            {!isAdmin ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Button variant="contained" onClick={() => handleOpenComplaintDialog('general')}>{t('complaints.raiseComplaint')}</Button>
                <Button variant="outlined" onClick={() => navigate('/announcements')}>Check notices first</Button>
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        {!isAdmin && (
          <Paper elevation={1} sx={{ p: 2, borderRadius: 3, mb: 3, display: { xs: 'block', md: 'none' } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
              <Typography variant="h6">{t('complaints.quickReport')}</Typography>
              <Chip label={t('complaints.mobileChip')} size="small" color="primary" sx={{ borderRadius: 999 }} />
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              {['security', 'staff-access', 'delivery', 'housekeeping'].map((category) => (
                <Button
                  key={category}
                  variant="outlined"
                  onClick={() => handleOpenComplaintDialog(category)}
                  sx={{ minHeight: 58, borderRadius: 3 }}
                >
                  {getCategoryLabel(category, t)}
                </Button>
              ))}
            </Box>
          </Paper>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('complaints.stats.total')}</Typography>
            <Typography variant="h4">{summary.total}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('complaints.stats.open')}</Typography>
            <Typography variant="h4">{summary.open}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('complaints.stats.inprogress')}</Typography>
            <Typography variant="h4">{summary.inprogress}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('complaints.stats.resolved')}</Typography>
            <Typography variant="h4">{summary.resolved}</Typography>
          </Paper>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
          {[
            { value: 'all', label: t('complaints.filters.all') },
            { value: 'open', label: t('complaints.filters.open') },
            { value: 'inprogress', label: t('complaints.filters.inprogress') },
            { value: 'resolved', label: t('complaints.filters.resolved') },
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
              <Typography variant="h6" sx={{ mb: 0.75 }}>
                {statusFilter === 'all' ? t('complaints.emptyTitle') : `No ${statusFilter === 'inprogress' ? 'in-progress' : statusFilter} complaints right now`}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {statusFilter === 'all'
                  ? t('complaints.emptySubtitle')
                  : 'Try another filter or raise a new issue if something still needs attention.'}
              </Typography>
              {!isAdmin ? (
                <Button variant="outlined" onClick={() => handleOpenComplaintDialog(form.category)}>
                  {t('complaints.raiseComplaint')}
                </Button>
              ) : null}
            </Paper>
          )}

          {filteredComplaints.map((complaint) => (
            <Paper key={complaint.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="h6">{getCategoryLabel(complaint.category, t)}</Typography>
                    <Typography color="text.secondary">
                      {complaint.residentName || t('complaints.residentFallback')}{complaint.flat ? ` • ${t('complaints.flatLabel', { flat: complaint.flat })}` : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip label={t(`complaints.status.${complaint.status}`, { defaultValue: complaint.status })} color={statusColor[complaint.status] || 'default'} />
                    <Chip label={t(`complaints.priority.${complaint.aiPriority || 'low'}`)} color={priorityColor[complaint.aiPriority] || 'default'} variant="outlined" />
                  </Stack>
                </Stack>
                <Typography>{complaint.description}</Typography>
                <Typography color="text.secondary">{t('complaints.openedAt', { time: formatTimestamp(complaint.createdAt) })}</Typography>
                {complaint.adminNotes && <Typography color="text.secondary">{t('complaints.adminNote', { note: complaint.adminNotes })}</Typography>}
                {complaint.resolutionNote && <Typography color="text.secondary">{t('complaints.resolutionNote', { note: complaint.resolutionNote })}</Typography>}
                {isAdmin && complaint.status !== 'resolved' && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    {complaint.status === 'open' && (
                      <Button variant="outlined" onClick={() => handleStatusChange(complaint.id, 'inprogress')}>
                        {t('complaints.actions.moveToInprogress')}
                      </Button>
                    )}
                    <Button variant="contained" color="success" onClick={() => handleStatusChange(complaint.id, 'resolved')}>
                      {t('complaints.actions.markResolved')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('complaints.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label={t('complaints.fields.category')} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {complaintCategories.map((category) => (
                <MenuItem key={category.value} value={category.value}>{t(category.labelKey)}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('complaints.fields.description')}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateComplaint} disabled={saving}>
            {saving ? t('complaints.submitting') : t('complaints.submitComplaint')}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}

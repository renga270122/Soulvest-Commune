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
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import PushPinIcon from '@mui/icons-material/PushPin';
import Navbar from '../components/Navbar';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { useAuthContext } from '../components/auth-context';
import {
  acknowledgeAnnouncement,
  createAnnouncement,
  subscribeToAnnouncements,
} from '../services/communityData';

const formatTimestamp = (value) => {
  if (!value) return 'Just now';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (value?.toDate) return value.toDate().toLocaleString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
  return 'Just now';
};

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [form, setForm] = useState({
    title: '',
    body: '',
    language: 'en',
    pinned: false,
  });
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((items) => {
      setAnnouncements(items);
      setLoading(false);
    }, user);
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => ({
    total: announcements.length,
    pinned: announcements.filter((item) => item.pinned).length,
    acknowledged: announcements.filter((item) => (item.acknowledgements || []).some((entry) => entry.userId === user?.uid)).length,
  }), [announcements, user?.uid]);

  const handleCreateAnnouncement = async () => {
    if (!form.title || !form.body) {
      setBanner({ type: 'error', message: 'Title and message are required.' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', message: '' });
    try {
      await createAnnouncement({
        ...form,
        societyId: user?.societyId,
        postedBy: {
          uid: user?.uid || '',
          name: user?.name || 'Admin',
        },
      });
      setForm({ title: '', body: '', language: 'en', pinned: false });
      setDialogOpen(false);
      setBanner({ type: 'success', message: 'Announcement posted successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to post announcement.' });
    }
    setSaving(false);
  };

  const handleAcknowledge = async (announcementId) => {
    try {
      await acknowledgeAnnouncement(announcementId, user);
      setBanner({ type: 'success', message: 'Acknowledgment recorded.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to acknowledge this announcement.' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4">Announcements & Communication</Typography>
            <Typography color="text.secondary">
              Broadcast maintenance notices, pin critical messages, and track who acknowledged them.
            </Typography>
          </Box>
          {isAdmin && (
            <Button variant="contained" startIcon={<CampaignIcon />} onClick={() => setDialogOpen(true)}>
              New Announcement
            </Button>
          )}
        </Stack>

        {banner.message && <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Total Notices</Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Pinned</Typography>
            <Typography variant="h4">{stats.pinned}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Your Acknowledgments</Typography>
            <Typography variant="h4">{stats.acknowledged}</Typography>
          </Paper>
        </Box>

        <Stack spacing={2}>
          {!loading && announcements.length === 0 && (
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6">No announcements yet</Typography>
              <Typography color="text.secondary">
                Admin notices will appear here and residents can acknowledge them with one tap.
              </Typography>
            </Paper>
          )}

          {announcements.map((announcement) => {
            const acknowledged = (announcement.acknowledgements || []).some((entry) => entry.userId === user?.uid);
            return (
              <Paper key={announcement.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="h6">{announcement.title}</Typography>
                        {announcement.pinned && <Chip size="small" color="warning" icon={<PushPinIcon />} label="Pinned" />}
                      </Stack>
                      <Typography color="text.secondary">{formatTimestamp(announcement.createdAt || announcement.date)}</Typography>
                    </Box>
                    <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                      <Chip size="small" label={`${announcement.language || 'en'}`.toUpperCase()} variant="outlined" />
                      <Chip size="small" color={acknowledged ? 'success' : 'default'} label={acknowledged ? 'Acknowledged' : 'Pending'} />
                    </Stack>
                  </Stack>
                  <Typography>{announcement.body || announcement.content}</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <Typography color="text.secondary">
                      Ack count: {(announcement.acknowledgements || []).length}
                    </Typography>
                    {!isAdmin && !acknowledged && (
                      <Button variant="contained" onClick={() => handleAcknowledge(announcement.id)}>
                        Got It
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Announcement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} fullWidth />
            <TextField label="Message" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} multiline minRows={4} fullWidth />
            <TextField select label="Language" value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}>
              {SUPPORTED_LANGUAGES.map((language) => (
                <MenuItem key={language.value} value={language.value}>{language.label}</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch checked={form.pinned} onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))} />
              <Typography>Pin this notice</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAnnouncement} disabled={saving}>
            {saving ? 'Posting...' : 'Post Notice'}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}

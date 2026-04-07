import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { listResidentFeedback } from '../services/feedback';

function formatFeedbackTime(value) {
  if (!value) return 'Unknown time';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeedbackInbox() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ type: '', message: '' });

  const loadFeedback = async () => {
    setLoading(true);
    setBanner({ type: '', message: '' });

    try {
      const records = await listResidentFeedback();
      setFeedback(records);
      if (!records.length) {
        setBanner({ type: 'info', message: 'No feedback submissions found yet.' });
      }
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to load feedback right now.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="md">
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Feedback Inbox</Typography>
            <Typography color="text.secondary">
              Review public resident submissions collected from the feedback form.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin')}>
              Back to Admin
            </Button>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadFeedback} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {banner.message && (
          <Alert severity={banner.type || 'info'} sx={{ mb: 3 }}>
            {banner.message}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {feedback.map((entry) => (
              <Paper key={entry.id} elevation={1} sx={{ p: 3, borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6">{entry.name || 'Anonymous resident'}</Typography>
                    <Typography color="text.secondary">
                      Flat: {entry.flat || 'Not provided'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={`Rating ${entry.rating || '-'}/5`} color="primary" variant="outlined" />
                    <Chip label={entry.category || 'general'} variant="outlined" />
                  </Stack>
                </Stack>

                <Typography sx={{ whiteSpace: 'pre-wrap', mb: 1.5 }}>{entry.message || 'No message provided.'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Submitted: {formatFeedbackTime(entry.createdAt)}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
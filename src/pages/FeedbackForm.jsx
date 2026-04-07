import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { submitResidentFeedback } from '../services/feedback';

const categories = [
  { value: 'general', label: 'General feedback' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'security', label: 'Security' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'payments', label: 'Payments and billing' },
  { value: 'community', label: 'Community activities' },
];

const initialForm = {
  phone: '',
  rating: '5',
  category: 'general',
  message: '',
};

export default function FeedbackForm() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [referenceId, setReferenceId] = useState('');

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setBanner({ type: '', message: '' });
    setReferenceId('');

    try {
      const result = await submitResidentFeedback({
        ...form,
        rating: Number(form.rating),
      });

      setBanner({ type: 'success', message: 'Thank you. Your feedback has been submitted to the community team.' });
      setReferenceId(result.id || '');
      setForm(initialForm);
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to submit your feedback right now.' });
    }

    setSubmitting(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        background: 'linear-gradient(180deg, #f7efe3 0%, #f3f6fb 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={4} sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <Box sx={{ p: 4, bgcolor: '#69411d', color: '#fff7ef' }}>
            <Typography variant="overline" sx={{ letterSpacing: 2.4 }}>
              Soulvest Commune
            </Typography>
            <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
              Resident Feedback Form
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255, 247, 239, 0.84)' }}>
              Share this link in the residents WhatsApp group so neighbors can submit quick feedback without signing in or sharing personal details.
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ p: 3.5 }}>
            <Stack spacing={2.25}>
              {banner.message && <Alert severity={banner.type || 'info'}>{banner.message}</Alert>}
              {referenceId && (
                <Alert severity="info">
                  Reference ID: {referenceId}
                </Alert>
              )}

              <TextField label="Phone number" value={form.phone} onChange={updateField('phone')} fullWidth />

              <TextField
                select
                label="Feedback category"
                value={form.category}
                onChange={updateField('category')}
                fullWidth
              >
                {categories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField select label="Overall rating" value={form.rating} onChange={updateField('rating')} fullWidth>
                {[5, 4, 3, 2, 1].map((value) => (
                  <MenuItem key={value} value={String(value)}>
                    {value} / 5
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Your feedback"
                value={form.message}
                onChange={updateField('message')}
                required
                fullWidth
                multiline
                minRows={5}
                placeholder="Tell us what is working well, what needs attention, or what you would like the community team to improve."
              />

              <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ py: 1.4 }}>
                {submitting ? 'Submitting...' : 'Submit feedback'}
              </Button>

              <Typography variant="body2" color="text.secondary">
                Tip: Share the public page URL ending in /feedback in your residents WhatsApp group.
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
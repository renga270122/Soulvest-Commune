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
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/AuthContext';
import {
  cancelFacilityBooking,
  createFacilityBooking,
  normalizeFlat,
  subscribeToResidentFacilityBookings,
} from '../services/communityData';

const amenities = [
  { value: 'Gym', detail: 'Reserve workout slots for peak hours.' },
  { value: 'Swimming Pool', detail: 'Book family or lane-swim windows.' },
  { value: 'Clubhouse', detail: 'Reserve indoor gatherings and celebrations.' },
  { value: 'Community Hall', detail: 'Block event space for parties and meetings.' },
  { value: 'Tennis Court', detail: 'Reserve coaching or match-time sessions.' },
];

const slotOptions = [
  '06:00 AM - 07:00 AM',
  '07:00 AM - 08:00 AM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM',
  '08:00 PM - 09:00 PM',
];

export default function FacilityBookings() {
  const { user } = useAuthContext();
  const [bookings, setBookings] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [form, setForm] = useState({
    amenity: 'Gym',
    bookingDate: '',
    slot: slotOptions[0],
    guestCount: 1,
    notes: '',
  });

  useEffect(() => {
    const unsubscribe = subscribeToResidentFacilityBookings(user?.uid, setBookings, user);
    return () => unsubscribe();
  }, [user?.uid]);

  const summary = useMemo(() => ({
    active: bookings.filter((booking) => booking.status !== 'cancelled').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    nextBooking: bookings
      .filter((booking) => booking.status !== 'cancelled')
      .sort((left, right) => new Date(left.bookingDate).getTime() - new Date(right.bookingDate).getTime())[0],
  }), [bookings]);

  const handleCreateBooking = async () => {
    if (!user?.uid || !normalizeFlat(user?.flat)) {
      setBanner({ type: 'warning', message: 'Add your flat number before reserving amenities.' });
      return;
    }

    if (!form.bookingDate || !form.slot || !form.amenity) {
      setBanner({ type: 'error', message: 'Amenity, date, and slot are required.' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', message: '' });
    try {
      const booking = await createFacilityBooking({
        ...form,
        residentId: user.uid,
        residentName: user.name || 'Resident',
        flat: user.flat,
        societyId: user.societyId,
      });
      setDialogOpen(false);
      setForm({ amenity: 'Gym', bookingDate: '', slot: slotOptions[0], guestCount: 1, notes: '' });
      setBanner({ type: 'success', message: `${form.amenity} booked successfully. Booking code: ${booking.bookingCode}.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to create booking.' });
    }
    setSaving(false);
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await cancelFacilityBooking(bookingId, user);
      setBanner({ type: 'success', message: 'Amenity booking cancelled.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to cancel the booking.' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Facility Booking</Typography>
            <Typography color="text.secondary">
              Reserve shared amenities like the gym, pool, clubhouse, or community hall without waiting for manual confirmation.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<EventAvailableIcon />} onClick={() => setDialogOpen(true)}>
            Reserve Amenity
          </Button>
        </Stack>

        {banner.message && <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Active Bookings</Typography>
            <Typography variant="h4">{summary.active}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Cancelled</Typography>
            <Typography variant="h4">{summary.cancelled}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Next Reservation</Typography>
            <Typography variant="h6">{summary.nextBooking?.amenity || 'None'}</Typography>
            <Typography color="text.secondary">{summary.nextBooking ? new Date(summary.nextBooking.bookingDate).toLocaleDateString() : 'Reserve your first slot'}</Typography>
          </Paper>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.1fr' }, gap: 2 }}>
          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Available Amenities</Typography>
            <Stack spacing={1.5}>
              {amenities.map((amenity) => (
                <Paper key={amenity.value} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography variant="subtitle1">{amenity.value}</Typography>
                      <Typography color="text.secondary">{amenity.detail}</Typography>
                    </Box>
                    <Chip label="Open" color="success" variant="outlined" />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>My Bookings</Typography>
            <Stack spacing={1.5}>
              {bookings.length === 0 && (
                <Typography color="text.secondary">No amenity bookings yet. Reserve a slot to see it here.</Typography>
              )}
              {bookings.map((booking) => (
                <Paper key={booking.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="subtitle1">{booking.amenity}</Typography>
                        <Typography color="text.secondary">
                          {new Date(booking.bookingDate).toLocaleString()} • {booking.slot}
                        </Typography>
                      </Box>
                      <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                        <Chip label={booking.status || 'confirmed'} color={booking.status === 'cancelled' ? 'default' : 'success'} />
                        <Chip label={booking.bookingCode || 'Pending code'} variant="outlined" />
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <GroupsIcon fontSize="small" color="action" />
                      <Typography color="text.secondary">Guests: {booking.guestCount || 1}</Typography>
                    </Stack>
                    {booking.notes && <Typography color="text.secondary">Notes: {booking.notes}</Typography>}
                    {booking.status !== 'cancelled' && (
                      <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => handleCancelBooking(booking.id)}>
                        Cancel Booking
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reserve Amenity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Amenity" value={form.amenity} onChange={(event) => setForm((current) => ({ ...current, amenity: event.target.value }))}>
              {amenities.map((amenity) => (
                <MenuItem key={amenity.value} value={amenity.value}>{amenity.value}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Booking date"
              type="date"
              value={form.bookingDate}
              onChange={(event) => setForm((current) => ({ ...current, bookingDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField select label="Slot" value={form.slot} onChange={(event) => setForm((current) => ({ ...current, slot: event.target.value }))}>
              {slotOptions.map((slot) => (
                <MenuItem key={slot} value={slot}>{slot}</MenuItem>
              ))}
            </TextField>
            <TextField label="Guest count" type="number" value={form.guestCount} onChange={(event) => setForm((current) => ({ ...current, guestCount: event.target.value }))} fullWidth />
            <TextField label="Notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} multiline minRows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBooking} disabled={saving}>
            {saving ? 'Reserving...' : 'Confirm Booking'}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}
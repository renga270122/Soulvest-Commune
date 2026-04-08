import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonIcon from '@mui/icons-material/Person';
import ShieldIcon from '@mui/icons-material/Shield';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import TranslateIcon from '@mui/icons-material/Translate';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/AuthContext';
import { getUserProfileByUid, normalizeFlat, upsertUserProfile } from '../services/communityData';

const profileShellSx = {
  minHeight: '100vh',
  bgcolor: 'background.default',
  px: 2,
  py: 3,
  pb: 11,
};

const profileCardSx = {
  p: 2.5,
  borderRadius: 3,
};

const defaultForm = {
  name: '',
  email: '',
  mobile: '',
  flat: '',
  language: 'en',
  emergencyContactName: '',
  emergencyContactPhone: '',
  householdSize: '1',
  vehicleNumber: '',
  photoDataUrl: '',
};

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ta', label: 'Tamil' },
];

export default function Profile() {
  const { user, updateUser } = useAuthContext();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    let active = true;
    void getUserProfileByUid(user.uid)
      .then((profile) => {
        if (!active) return;
        setForm({
          ...defaultForm,
          name: profile?.name || user.name || '',
          email: profile?.email || user.email || '',
          mobile: profile?.mobile || user.mobile || '',
          flat: normalizeFlat(profile?.flat || user.flat || ''),
          language: profile?.language || user.language || 'en',
          emergencyContactName: profile?.emergencyContactName || '',
          emergencyContactPhone: profile?.emergencyContactPhone || '',
          householdSize: String(profile?.householdSize || '1'),
          vehicleNumber: profile?.vehicleNumber || '',
          photoDataUrl: profile?.photoDataUrl || user.photoDataUrl || '',
        });
      })
      .catch((error) => {
        if (!active) return;
        setBanner({ type: 'warning', message: error.message || 'Unable to load the latest profile details.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.email, user?.flat, user?.language, user?.mobile, user?.name, user?.uid]);

  const residentInitials = useMemo(() => {
    const name = form.name || user?.name || 'Resident';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'R';
  }, [form.name, user?.name]);

  const profileHighlights = useMemo(() => ([
    {
      icon: <HomeWorkIcon color="primary" />,
      label: 'Flat',
      value: form.flat || 'Not assigned',
    },
    {
      icon: <TranslateIcon color="primary" />,
      label: 'Language',
      value: languageOptions.find((item) => item.value === form.language)?.label || 'English',
    },
    {
      icon: <ShieldIcon color="primary" />,
      label: 'Household Size',
      value: `${form.householdSize || '1'} resident${String(form.householdSize || '1') === '1' ? '' : 's'}`,
    },
    {
      icon: <PhoneInTalkIcon color="primary" />,
      label: 'Emergency Contact',
      value: form.emergencyContactName ? `${form.emergencyContactName} • ${form.emergencyContactPhone || 'No phone added'}` : 'Not added',
    },
  ]), [form.emergencyContactName, form.emergencyContactPhone, form.flat, form.householdSize, form.language]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'flat' ? value.toUpperCase() : value,
    }));
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBanner({ type: 'error', message: 'Please select an image file for the profile photo.' });
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setBanner({ type: 'error', message: 'Profile photo must be smaller than 2 MB.' });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        photoDataUrl: typeof reader.result === 'string' ? reader.result : current.photoDataUrl,
      }));
      setBanner({ type: 'success', message: 'Profile photo ready. Save changes to keep it.' });
    };
    reader.onerror = () => {
      setBanner({ type: 'error', message: 'Unable to read the selected image.' });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemovePhoto = () => {
    setForm((current) => ({
      ...current,
      photoDataUrl: '',
    }));
    setBanner({ type: 'success', message: 'Profile photo removed. Save changes to keep it removed.' });
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    if (!form.name.trim() || !form.mobile.trim()) {
      setBanner({ type: 'error', message: 'Name and mobile number are required.' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', message: '' });
    try {
      await upsertUserProfile(user.uid, {
        ...form,
        flat: normalizeFlat(form.flat),
        householdSize: Number(form.householdSize || 1),
        role: user.role,
        societyId: user.societyId,
        cityId: user.cityId,
      });

      updateUser({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        flat: normalizeFlat(form.flat),
        language: form.language,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        householdSize: Number(form.householdSize || 1),
        vehicleNumber: form.vehicleNumber.trim(),
        photoDataUrl: form.photoDataUrl,
      });

      setBanner({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to save your profile.' });
    }
    setSaving(false);
  };

  return (
    <Box sx={profileShellSx}>
      <Box sx={{ maxWidth: 1040, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ mb: 3 }}>
          <Paper elevation={2} sx={{ ...profileCardSx, flex: { lg: '0 0 320px' } }}>
            <Stack spacing={2} alignItems={{ xs: 'flex-start', sm: 'center', lg: 'flex-start' }}>
              <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center', lg: 'flex-start' }}>
                <Avatar src={form.photoDataUrl || undefined} sx={{ width: 96, height: 96, bgcolor: 'primary.main', fontSize: 28, fontWeight: 700 }}>
                  {residentInitials}
                </Avatar>
                <Stack direction={{ xs: 'row', sm: 'column' }} spacing={1}>
                  <Button variant="outlined" startIcon={<CameraAltIcon />} onClick={() => fileInputRef.current?.click()}>
                    Add Photo
                  </Button>
                  {form.photoDataUrl && (
                    <Button variant="text" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleRemovePhoto}>
                      Remove
                    </Button>
                  )}
                </Stack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
              </Stack>
              <Box>
                <Typography variant="h4" sx={{ mb: 0.5 }}>{form.name || 'Resident Profile'}</Typography>
                <Typography color="text.secondary">Manage your contact details, household information, and emergency access preferences.</Typography>
              </Box>
              <Stack spacing={1.2} sx={{ width: '100%' }}>
                {profileHighlights.map((item) => (
                  <Paper key={item.label} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      {item.icon}
                      <Box>
                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                        <Typography variant="subtitle1">{item.value}</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={2} sx={{ ...profileCardSx, flex: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
              <Box>
                <Typography variant="h5">Resident Profile</Typography>
                <Typography color="text.secondary">Keep your visitor, security, and payment details current so the resident workflows work cleanly.</Typography>
              </Box>
              <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Stack>

            {banner.message && (
              <Alert severity={banner.type} sx={{ mb: 2.5 }}>
                {banner.message}
              </Alert>
            )}

            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Identity</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <TextField label="Full name" name="name" value={form.name} onChange={handleChange} fullWidth disabled={loading} />
                  <TextField label="Email" name="email" type="email" value={form.email} onChange={handleChange} fullWidth disabled={loading} />
                  <TextField label="Mobile" name="mobile" value={form.mobile} onChange={handleChange} fullWidth disabled={loading} />
                  <TextField label="Flat" name="flat" value={form.flat} onChange={handleChange} fullWidth disabled={loading} />
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Household Preferences</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <TextField select label="Preferred language" name="language" value={form.language} onChange={handleChange} fullWidth disabled={loading}>
                    {languageOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Household size" name="householdSize" type="number" value={form.householdSize} onChange={handleChange} fullWidth disabled={loading} inputProps={{ min: 1, max: 15 }} />
                  <TextField label="Vehicle number" name="vehicleNumber" value={form.vehicleNumber} onChange={handleChange} fullWidth disabled={loading} />
                  <TextField label="Resident type" value={user?.role === 'resident' ? 'Resident' : (user?.role || 'Resident')} fullWidth disabled InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} /> }} />
                </Box>
              </Box>

              <Box>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Emergency Contact</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  <TextField label="Emergency contact name" name="emergencyContactName" value={form.emergencyContactName} onChange={handleChange} fullWidth disabled={loading} />
                  <TextField label="Emergency contact phone" name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={handleChange} fullWidth disabled={loading} />
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Navbar />
    </Box>
  );
}

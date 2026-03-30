import React, { useState, useEffect } from 'react';
import {
  Button, TextField, Select, MenuItem, InputLabel, FormControl,
  Box, Typography, Paper, CircularProgress, Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../components/AuthContext';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const LoginPage = () => {
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('guard');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const navigate = useNavigate();
  const { login, user } = useAuthContext();

  useEffect(() => {
    if (user) {
      if (user.role === 'guard') navigate('/guard');
      else if (user.role === 'resident') navigate('/resident');
      else if (user.role === 'admin') navigate('/admin');
    }
  }, [user, navigate]);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible', // ✅ invisible reCAPTCHA
          callback: (response) => {
            console.log('Recaptcha verified');
          },
        }
      );
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setupRecaptcha();

    // User enters only 10 digits (e.g., 9663801374)
    let phoneNumber = mobile.trim();

    // Validate length
    if (!/^\d{10}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    // Convert to E.164 format for India
    phoneNumber = '+91' + phoneNumber;

    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send OTP. Please check the number and try again.');
      console.error('OTP send error:', err);
    }

    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      login(mobile, role);
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    }
    setLoading(false);
  };

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={3} sx={{ p: 4, minWidth: 320 }}>
        <Typography variant="h5" mb={2} align="center">Login</Typography>
        {!otpSent ? (
          <form onSubmit={handleSendOtp}>
            <TextField
              fullWidth
              label="Mobile Number"
              placeholder="Enter 10-digit mobile number"
              margin="normal"
              variant="outlined"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel id="role-label">Role</InputLabel>
              <Select
                labelId="role-label"
                label="Role"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <MenuItem value="guard">Guard</MenuItem>
                <MenuItem value="resident">Resident</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <div id="recaptcha-container" style={{ display: 'none' }} /> {/* ✅ hidden container */}
            <Button fullWidth variant="contained" color="primary" sx={{ mt: 2 }} type="submit" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Send OTP'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <TextField
              fullWidth
              label="Enter OTP"
              placeholder="Enter the OTP received"
              margin="normal"
              variant="outlined"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              required
            />
            <Button fullWidth variant="contained" color="primary" sx={{ mt: 2 }} type="submit" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Verify OTP'}
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </form>
        )}
      </Paper>
    </Box>
  );
};

export default LoginPage;

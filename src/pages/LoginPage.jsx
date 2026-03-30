import React, { useState } from 'react';
import { Button, TextField, Select, MenuItem, InputLabel, FormControl, Box, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('guard');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // For MVP, just navigate based on role
    if (role === 'guard') navigate('/guard');
    else if (role === 'resident') navigate('/resident');
    else if (role === 'admin') navigate('/admin');
  };

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={3} sx={{ p: 4, minWidth: 320 }}>
        <Typography variant="h5" mb={2} align="center">Login</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Mobile Number"
            placeholder="Enter mobile number"
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
          <Button fullWidth variant="contained" color="primary" sx={{ mt: 2 }} type="submit">
            Send OTP
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default LoginPage;

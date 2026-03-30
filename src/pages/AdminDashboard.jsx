import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useAuthContext } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';


const AdminDashboard = () => {
  const { logout } = useAuthContext();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <Box p={3} bgcolor="#f5f5f5" minHeight="100vh">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" mb={2}>Admin Dashboard</Typography>
        </Box>
        <Box>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
        </Box>
      </Paper>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Visitor Logs</Typography>
        {/* Visitor logs will be listed here */}
      </Paper>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">User Management</Typography>
        {/* User management features will be added here */}
      </Paper>
    </Box>
  );
};

export default AdminDashboard;

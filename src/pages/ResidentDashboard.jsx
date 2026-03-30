

import React, { useState, useEffect } from 'react';
import { List, ListItem, ListItemText, Button, Box, Paper, Typography } from '@mui/material';
import { useAuthContext } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';

const ResidentDashboard = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const { logout } = useAuthContext();
  const navigate = useNavigate();

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/visitors');
      const data = await res.json();
      setVisitors(data);
    } catch (err) {
      // Optionally handle error
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleApprove = async (id) => {
    try {
      await fetch(`http://localhost:4000/visitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      fetchVisitors();
    } catch (err) {
      // Optionally handle error
    }
  };

  const handleDeny = async (id) => {
    try {
      await fetch(`http://localhost:4000/visitors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'denied' }),
      });
      fetchVisitors();
    } catch (err) {
      // Optionally handle error
    }
  };

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
          <Typography variant="h5" mb={2}>Resident Dashboard</Typography>
        </Box>
        <Box>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
        </Box>
      </Paper>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Pending Visitor Approvals</Typography>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <List>
            {visitors.filter(v => v.status === 'pending').length === 0 && (
              <ListItem>
                <ListItemText primary="No pending approvals." />
              </ListItem>
            )}
            {visitors.filter(v => v.status === 'pending').map((v) => (
              <ListItem key={v.id} divider>
                <ListItemText
                  primary={`${v.name} (Flat: ${v.flat})`}
                  secondary={`Purpose: ${v.purpose} | Time: ${v.time}`}
                />
                <Button color="success" variant="contained" sx={{ mr: 1 }} onClick={() => handleApprove(v.id)}>Approve</Button>
                <Button color="error" variant="outlined" onClick={() => handleDeny(v.id)}>Deny</Button>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Notifications</Typography>
        {/* Notifications will be listed here */}
      </Paper>
      {/* <ChatbotWidget /> */}
    </Box>
  );
};

export default ResidentDashboard;

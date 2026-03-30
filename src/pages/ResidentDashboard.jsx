

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

  // Filter for your flat (C 218)
  const myFlat = 'C 218';
  const myVisitors = visitors.filter(v => v.flat && v.flat.trim().toUpperCase() === myFlat.toUpperCase());

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
        Soulvest Commune – C 218 Resident Dashboard
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" mb={2}>Welcome, C 218</Typography>
        </Box>
        <Box>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
        </Box>
      </Paper>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Pending Approvals (Visitors, Delivery, Staff)</Typography>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <List>
            {myVisitors.filter(v => v.status === 'pending').length === 0 && (
              <ListItem>
                <ListItemText primary="No pending approvals for your flat." />
              </ListItem>
            )}
            {myVisitors.filter(v => v.status === 'pending').map((v) => (
              <ListItem key={v.id} divider>
                <ListItemText
                  primary={`${v.name} (${v.purpose || 'Visitor'})`}
                  secondary={`Type: ${getVisitorType(v.purpose)} | Time: ${v.time}`}
                />
                <Button color="success" variant="contained" sx={{ mr: 1 }} onClick={() => handleApprove(v.id)}>Approve</Button>
                <Button color="error" variant="outlined" onClick={() => handleDeny(v.id)}>Deny</Button>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Recent Activity</Typography>
        <List>
          {myVisitors.length === 0 && (
            <ListItem>
              <ListItemText primary="No visitor activity for your flat yet." />
            </ListItem>
          )}
          {myVisitors.map((v) => (
            <ListItem key={v.id + '-activity'} divider>
              <ListItemText
                primary={`${v.name} (${v.purpose || 'Visitor'})`}
                secondary={`Type: ${getVisitorType(v.purpose)} | Time: ${v.time} | Status: ${v.status}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Notifications</Typography>
        {/* Notifications will be listed here */}
      </Paper>
      {/* <ChatbotWidget /> */}
    </Box>
  );
// Helper to classify visitor type
function getVisitorType(purpose) {
  if (!purpose) return 'Visitor';
  const p = purpose.toLowerCase();
  if (p.includes('delivery')) return 'Delivery';
  if (p.includes('maid') || p.includes('help') || p.includes('staff')) return 'Staff/Maid';
  return 'Visitor';
}
};

export default ResidentDashboard;

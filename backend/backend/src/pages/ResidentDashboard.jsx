

import React, { useState, useEffect } from 'react';
import {
  List, ListItem, ListItemText, Button, Box, Paper, Typography, Avatar, Badge, Grid, Divider, IconButton
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HandymanIcon from '@mui/icons-material/Handyman';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import HomeIcon from '@mui/icons-material/Home';
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
      const res = await fetch('https://commune.soulvest.ai/visitors');
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

  // Dynamic greeting
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  // Notification badge count (simulate new alerts)
  const notificationCount = 2; // Replace with real data if available

  const handleApprove = async (id) => {
    try {
      await fetch(`https://commune.soulvest.ai/visitors/${id}`, {
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
      await fetch(`https://commune.soulvest.ai/visitors/${id}`, {
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
    <Box p={{ xs: 1, md: 3 }} bgcolor="background.default" minHeight="100vh">
      {/* Top Bar */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <Avatar src="/src/assets/hero.png" sx={{ width: 48, height: 48, mr: 2, bgcolor: 'primary.main' }}>
            <HomeIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {getGreeting()}, Resident of {myFlat}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Soulvest Commune
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
      </Box>
      {/* Main Grid */}
      <Grid container spacing={3}>
        {/* Left: Pending Approvals */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: '#fffbe6', boxShadow: '0 2px 12px #ffecb3' }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Badge color="warning" variant="dot" invisible={myVisitors.filter(v => v.status === 'pending').length === 0}>
                <HourglassEmptyIcon color="warning" sx={{ mr: 1 }} />
              </Badge>
              <Typography variant="h6" fontWeight={600} color="warning.main">
                Pending Approvals
              </Typography>
            </Box>
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
                  <ListItem key={v.id} divider alignItems="flex-start">
                    <Avatar sx={{ bgcolor: getVisitorColor(v.purpose), mr: 2 }}>
                      {getVisitorIcon(v.purpose)}
                    </Avatar>
                    <ListItemText
                      primary={<Typography fontWeight={600}>{v.name} ({getVisitorType(v.purpose)})</Typography>}
                      secondary={<>
                        <Typography variant="caption" color="text.secondary">Time: {v.time}</Typography>
                      </>}
                    />
                    <IconButton color="success" onClick={() => handleApprove(v.id)}><CheckCircleIcon /></IconButton>
                    <IconButton color="error" onClick={() => handleDeny(v.id)}><CancelIcon /></IconButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        {/* Center: Recent Activity Timeline */}
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: '#e3f2fd', boxShadow: '0 2px 12px #90caf9' }}>
            <Box display="flex" alignItems="center" mb={1}>
              <PersonIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" fontWeight={600} color="primary.main">
                Activity Timeline
              </Typography>
            </Box>
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {myVisitors.length === 0 ? (
                <Typography color="text.secondary">No visitor activity for your flat yet.</Typography>
              ) : (
                <List>
                  {myVisitors.map((v, idx) => (
                    <Box key={v.id + '-activity'}>
                      <ListItem alignItems="flex-start" disableGutters>
                        <Avatar sx={{ bgcolor: getVisitorColor(v.purpose), mr: 2 }}>
                          {getVisitorIcon(v.purpose)}
                        </Avatar>
                        <ListItemText
                          primary={<Typography fontWeight={600}>{v.name} ({getVisitorType(v.purpose)})</Typography>}
                          secondary={<>
                            <Typography variant="caption" color="text.secondary">Time: {v.time}</Typography>
                            <Divider orientation="vertical" flexItem sx={{ mx: 1, display: 'inline-block' }} />
                            <Typography variant="caption" color={getStatusColor(v.status)} fontWeight={600}>{v.status}</Typography>
                          </>}
                        />
                      </ListItem>
                      {idx < myVisitors.length - 1 && <Divider sx={{ my: 0.5 }} />}
                    </Box>
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>
        {/* Right: Notifications */}
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: '#f5f5f5', boxShadow: '0 2px 12px #bdbdbd' }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Badge badgeContent={notificationCount} color="error" max={9} sx={{ mr: 1 }}>
                <NotificationsIcon color={notificationCount > 0 ? 'error' : 'action'} />
              </Badge>
              <Typography variant="h6" fontWeight={600} color="text.primary">
                Notifications
              </Typography>
            </Box>
            {/* Notifications will be listed here */}
            <Typography color="text.secondary">No new notifications.</Typography>
          </Paper>
        </Grid>
      </Grid>
      {/* Optional: Bottom Nav */}
      {/* <Box position="fixed" bottom={0} left={0} width="100%" bgcolor="#fff" boxShadow="0 -2px 8px #e0e0e0" display="flex" justifyContent="space-around" py={1}>
        <IconButton color="primary"><HomeIcon /></IconButton>
        <IconButton color="primary"><PersonIcon /></IconButton>
        <IconButton color="primary"><NotificationsIcon /></IconButton>
        <IconButton color="primary"><HandymanIcon /></IconButton>
      </Box> */}
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

// Helper to get icon for visitor type
function getVisitorIcon(purpose) {
  const p = (purpose || '').toLowerCase();
  if (p.includes('delivery')) return <LocalShippingIcon />;
  if (p.includes('maid') || p.includes('help') || p.includes('staff')) return <HandymanIcon />;
  return <PersonIcon />;
}

// Helper to get color for visitor type
function getVisitorColor(purpose) {
  const p = (purpose || '').toLowerCase();
  if (p.includes('delivery')) return 'info.main';
  if (p.includes('maid') || p.includes('help') || p.includes('staff')) return 'success.main';
  return 'primary.main';
}

// Helper to get color for status
function getStatusColor(status) {
  if (status === 'approved') return 'success.main';
  if (status === 'denied') return 'error.main';
  if (status === 'pending') return 'warning.main';
  return 'text.secondary';
}
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



import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, TextField, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText } from '@mui/material';
import { useAuthContext } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';


const GuardDashboard = () => {

  const [open, setOpen] = useState(false);
  const [visitor, setVisitor] = useState({ name: '', flat: '', purpose: '', time: '' });
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setVisitor({ name: '', flat: '', purpose: '', time: '' });
  };

  const handleChange = (e) => {
    setVisitor({ ...visitor, [e.target.name]: e.target.value });
  };

  const handleLogVisitor = async () => {
    if (visitor.name && visitor.flat && visitor.purpose && visitor.time) {
      try {
        await fetch('https://commune.soulvest.ai/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visitor),
        });
        fetchVisitors();
      } catch (err) {
        // Optionally handle error
      }
      handleClose();
    }
  };

  return (
    <Box p={3} bgcolor="#f5f5f5" minHeight="100vh">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" mb={2}>Guard Dashboard</Typography>
        </Box>
        <Box>
          <Button variant="contained" color="primary" onClick={handleOpen} sx={{ mr: 2 }}>Log Visitor</Button>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
        </Box>
      </Paper>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Recent Visitors</Typography>
        <List>
          {visitors.length === 0 && (
            <ListItem>
              <ListItemText primary="No visitors logged yet." />
            </ListItem>
          )}
          {visitors.map((v, idx) => (
            <ListItem key={idx} divider>
              <ListItemText
                primary={`${v.name} (Flat: ${v.flat})`}
                secondary={`Purpose: ${v.purpose} | Time: ${v.time} | Status: ${v.status}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Log Visitor - Soulvest Commune</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Visitor Name"
            fullWidth
            value={visitor.name}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="purpose"
            label="Purpose"
            fullWidth
            value={visitor.purpose}
            onChange={handleChange}
          />
          <TextField
            margin="dense"
            name="time"
            label="Time"
            fullWidth
            value={visitor.time}
            onChange={handleChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleLogVisitor} variant="contained">Log</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GuardDashboard;

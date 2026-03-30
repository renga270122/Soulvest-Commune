import React, { useState } from 'react';
import { Box, Typography, Button, Paper, TextField, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText } from '@mui/material';


const GuardDashboard = () => {
  const [open, setOpen] = useState(false);
  const [visitor, setVisitor] = useState({ name: '', flat: '', purpose: '', time: '' });
  const [visitors, setVisitors] = useState([]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setVisitor({ name: '', flat: '', purpose: '', time: '' });
  };

  const handleChange = (e) => {
    setVisitor({ ...visitor, [e.target.name]: e.target.value });
  };

  const handleLogVisitor = () => {
    if (visitor.name && visitor.flat && visitor.purpose && visitor.time) {
      setVisitors([ { ...visitor, status: 'pending' }, ...visitors ]);
      handleClose();
    }
  };

  return (
    <Box p={3} bgcolor="#f5f5f5" minHeight="100vh">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" mb={2}>Guard Dashboard</Typography>
        <Button variant="contained" color="primary" onClick={handleOpen}>Log Visitor</Button>
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
            name="flat"
            label="Flat Number"
            fullWidth
            value={visitor.flat}
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
            type="time"
            fullWidth
            value={visitor.time}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleLogVisitor} variant="contained">Log Visitor</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GuardDashboard;

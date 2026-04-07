import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, TextField, IconButton, List, ListItem, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuthContext } from './AuthContext';
import { subscribeToResidentComplaints, subscribeToResidentFacilityBookings, subscribeToResidentPayments } from '../services/communityData';

const initialMessages = [
  { sender: 'bot', text: 'Hi! I am your AI assistant. How can I help you today?' }
];

const getLLMReply = async (input) => {
  try {
    const res = await fetch('https://commune.soulvest.ai/chatbot-llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input })
    });
    const data = await res.json();
    if (data.reply) return data.reply;
    return data.error ? `Error: ${data.error}` : 'Sorry, I could not get a reply.';
  } catch (err) {
    return 'Sorry, there was a problem connecting to the AI service.';
  }
};

const getLocalConciergeReply = (input, { payments, complaints, bookings }) => {
  const query = input.toLowerCase();
  if (query.includes('due') || query.includes('payment') || query.includes('maintenance')) {
    const openPayments = payments.filter((payment) => payment.derivedStatus !== 'paid');
    if (!openPayments.length) {
      return 'You do not have any pending maintenance dues right now.';
    }
    const total = openPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const nextDue = openPayments
      .filter((payment) => payment.dueDate)
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0];
    return `You have ${openPayments.length} open due${openPayments.length === 1 ? '' : 's'} totaling Rs. ${total.toLocaleString('en-IN')}. ${nextDue ? `Next due date is ${new Date(nextDue.dueDate).toLocaleDateString()}.` : ''}`;
  }

  if (query.includes('complaint')) {
    if (!complaints.length) {
      return 'You have no active complaints at the moment.';
    }
    const activeComplaint = complaints.find((complaint) => complaint.status !== 'resolved') || complaints[0];
    return `Your latest complaint is ${activeComplaint.category} and it is currently ${activeComplaint.status}. Priority is ${activeComplaint.aiPriority || 'low'}.`;
  }

  if (query.includes('booking') || query.includes('amenity') || query.includes('gym') || query.includes('pool') || query.includes('clubhouse')) {
    const activeBooking = bookings.find((booking) => booking.status !== 'cancelled');
    if (!activeBooking) {
      return 'You have no active amenity bookings. Open Amenities to reserve the gym, pool, clubhouse, or other facilities.';
    }
    return `Your next amenity booking is for ${activeBooking.amenity} during ${activeBooking.slot} on ${new Date(activeBooking.bookingDate).toLocaleDateString()}.`;
  }

  return '';
};

const ChatbotWidget = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubPayments = subscribeToResidentPayments(user.uid, setPayments, user);
    const unsubComplaints = subscribeToResidentComplaints(user.uid, setComplaints, user);
    const unsubBookings = subscribeToResidentFacilityBookings(user.uid, setBookings, user);
    return () => {
      unsubPayments();
      unsubComplaints();
      unsubBookings();
    };
  }, [user?.uid]);

  const conciergeContext = useMemo(() => ({ payments, complaints, bookings }), [payments, complaints, bookings]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    setInput('');
    const localReply = getLocalConciergeReply(input, conciergeContext);
    const reply = localReply || await getLLMReply(input);
    setMessages((msgs) => [...msgs, { sender: 'bot', text: reply }]);
    setLoading(false);
  };

  return (
    <Box position="fixed" bottom={24} right={24} zIndex={1000}>
      <Paper elevation={6} sx={{ width: 320, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
        <Box bgcolor="#1976d2" color="#fff" p={2} borderRadius="4px 4px 0 0">
          <Typography variant="h6">AI Chatbot</Typography>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1 }}>
          {messages.map((msg, idx) => (
            <ListItem key={idx} alignItems={msg.sender === 'bot' ? 'flex-start' : 'flex-end'}>
              <ListItemText
                primary={msg.text}
                sx={{ textAlign: msg.sender === 'bot' ? 'left' : 'right' }}
                primaryTypographyProps={{ fontSize: 15, color: msg.sender === 'bot' ? 'text.primary' : 'primary.main' }}
              />
            </ListItem>
          ))}
        </List>
        <Box display="flex" p={1} borderTop="1px solid #eee">
          <TextField
            fullWidth
            size="small"
            placeholder={loading ? 'Waiting for AI reply...' : 'Type your message...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSend(); }}
            disabled={loading}
          />
          <IconButton color="primary" onClick={handleSend} sx={{ ml: 1 }} disabled={loading}>
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatbotWidget;

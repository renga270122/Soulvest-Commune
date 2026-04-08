import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  ButtonBase,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { useAuthContext } from './AuthContext';
import {
  subscribeToResidentComplaints,
  subscribeToResidentFacilityBookings,
  subscribeToResidentPayments,
  subscribeToResidentStaffAttendance,
} from '../services/communityData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');
const CHATBOT_TIMEOUT_MS = 5000;

const initialMessages = [
  { sender: 'bot', text: 'Hi! I am your AI assistant. How can I help you today?' }
];

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

const getLLMReply = async (input) => {
  if (!API_BASE_URL) {
    return '';
  }

  const { signal, cleanup } = createTimeoutSignal(CHATBOT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/chatbot-llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input }),
      signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return '';
    }

    return data.reply || '';
  } catch {
    return '';
  } finally {
    cleanup();
  }
};

const getLocalConciergeReply = (input, { payments, complaints, bookings, staffAttendance }) => {
  const query = input.toLowerCase();
  if (/(^|\b)(hi|hello|hey|good morning|good evening)(\b|$)/.test(query)) {
    return 'Hello! I can help with dues, complaints, amenity bookings, and staff attendance.';
  }

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

  if (query.includes('staff') || query.includes('maid') || query.includes('driver') || query.includes('cook') || query.includes('attendance')) {
    if (!staffAttendance.length) {
      return 'No staff attendance records are available yet.';
    }

    const flaggedAlert = staffAttendance.find((entry) => entry.alertType);
    if (flaggedAlert?.alertMessage) {
      return flaggedAlert.alertMessage;
    }

    const presentCount = staffAttendance.filter((entry) => entry.status !== 'absent').length;
    return `${presentCount} staff member${presentCount === 1 ? '' : 's'} are marked present today.`;
  }

  return '';
};

const getFallbackReply = () => 'I can help with maintenance dues, complaints, amenity bookings, and staff attendance. Ask me about any of those.';

const ChatbotWidget = ({ variant = 'panel', greetingName = 'there', bottomOffset = { xs: 20, md: 24 } }) => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(variant !== 'bubble');
  const [payments, setPayments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [staffAttendance, setStaffAttendance] = useState([]);
  const { user } = useAuthContext();

  useEffect(() => {
    setOpen(variant !== 'bubble');
  }, [variant]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubPayments = subscribeToResidentPayments(user.uid, setPayments, user);
    const unsubComplaints = subscribeToResidentComplaints(user.uid, setComplaints, user);
    const unsubBookings = subscribeToResidentFacilityBookings(user.uid, setBookings, user);
    const unsubStaffAttendance = subscribeToResidentStaffAttendance(user.uid, setStaffAttendance, user);
    return () => {
      unsubPayments();
      unsubComplaints();
      unsubBookings();
      unsubStaffAttendance();
    };
  }, [user?.uid]);

  const conciergeContext = useMemo(
    () => ({ payments, complaints, bookings, staffAttendance }),
    [bookings, complaints, payments, staffAttendance],
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    setInput('');
    const localReply = getLocalConciergeReply(input, conciergeContext);
    const llmReply = localReply ? '' : await getLLMReply(input);
    const reply = localReply || llmReply || getFallbackReply();
    setMessages((msgs) => [...msgs, { sender: 'bot', text: reply }]);
    setLoading(false);
  };

  const handleToggleOpen = () => {
    setOpen((currentOpen) => !currentOpen);
  };

  const widgetShellSx = {
    position: 'fixed',
    bottom: bottomOffset,
    right: { xs: 16, md: 24 },
    zIndex: 1200,
  };

  const panel = (
    <Paper
      elevation={10}
      sx={{
        width: { xs: 'min(92vw, 340px)', md: 340 },
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 4,
        border: '1px solid rgba(223, 199, 165, 0.42)',
        boxShadow: '0 22px 44px rgba(89, 105, 141, 0.2)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          bgcolor: '#2456A6',
          color: '#fff',
        }}
      >
        <Typography variant="h6">AI Concierge</Typography>
        {variant === 'bubble' && (
          <IconButton size="small" onClick={handleToggleOpen} sx={{ color: '#fff' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <List sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.25, bgcolor: 'rgba(255, 249, 240, 0.78)' }}>
        {messages.map((msg, idx) => (
          <ListItem key={idx} sx={{ px: 0, alignItems: 'flex-start', justifyContent: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
            <ListItemText
              primary={msg.text}
              sx={{
                maxWidth: '88%',
                m: 0,
                '& .MuiListItemText-primary': {
                  display: 'inline-block',
                  px: 1.5,
                  py: 1,
                  borderRadius: 3,
                  bgcolor: msg.sender === 'bot' ? 'rgba(255,255,255,0.92)' : 'rgba(36,86,166,0.12)',
                  color: msg.sender === 'bot' ? 'text.primary' : 'primary.main',
                  boxShadow: '0 4px 12px rgba(120, 108, 88, 0.08)',
                },
              }}
              primaryTypographyProps={{ fontSize: 15, lineHeight: 1.45 }}
            />
          </ListItem>
        ))}
      </List>

      <Box display="flex" p={1.25} borderTop="1px solid rgba(223, 199, 165, 0.45)" bgcolor="rgba(255,255,255,0.9)">
        <TextField
          fullWidth
          size="small"
          placeholder={loading ? 'Waiting for AI reply...' : 'Type your message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleSend(); }}
          disabled={loading}
        />
        <IconButton color="primary" onClick={handleSend} sx={{ ml: 1 }} disabled={loading}>
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );

  if (variant === 'bubble') {
    return (
      <Box sx={widgetShellSx}>
        {open ? (
          panel
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Paper
              elevation={8}
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.96)',
                boxShadow: '0 16px 34px rgba(104, 126, 166, 0.22)',
              }}
            >
              <Typography sx={{ fontSize: { xs: 16, md: 18 } }}>
                Hi {greetingName}! How can I assist you today?
              </Typography>
            </Paper>
            <ButtonBase
              onClick={handleToggleOpen}
              sx={{
                width: 62,
                height: 62,
                borderRadius: '50%',
                overflow: 'hidden',
              }}
            >
              <Avatar
                sx={{
                  width: 62,
                  height: 62,
                  bgcolor: '#fff1df',
                  color: '#d48b33',
                  border: '4px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 14px 30px rgba(104, 126, 166, 0.24)',
                }}
              >
                <SmartToyIcon />
              </Avatar>
            </ButtonBase>
          </Box>
        )}
      </Box>
    );
  }

  return <Box sx={widgetShellSx}>{panel}</Box>;
};

export default ChatbotWidget;

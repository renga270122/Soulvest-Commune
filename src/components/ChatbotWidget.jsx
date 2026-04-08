import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chip,
  Avatar,
  Box,
  Button,
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
import MicIcon from '@mui/icons-material/Mic';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import { useAuthContext } from './auth-context';
import {
  subscribeToAnnouncements,
  subscribeToComplaints,
  subscribeToFacilityBookings,
  subscribeToPayments,
  subscribeToResidents,
  subscribeToResidentComplaints,
  subscribeToResidentFacilityBookings,
  subscribeToResidentPayments,
  subscribeToResidentStaff,
  subscribeToResidentStaffAttendance,
  subscribeToStaffAttendance,
  subscribeToVisitors,
} from '../services/communityData';
import { sendAgentMessage } from '../services/aiConcierge';
import { executeLocalAiTask } from '../services/aiTaskExecutor';

const initialMessages = [
  { sender: 'bot', text: 'Hi! I am your AI assistant. How can I help you today?' },
];

const taskStatusLabelMap = {
  preview: 'Preview',
  queued: 'Queued',
  completed: 'Completed',
  blocked: 'Blocked',
  failed: 'Failed',
  skipped: 'Skipped',
  processing: 'Processing',
};

const taskStatusColorMap = {
  preview: 'warning',
  queued: 'info',
  completed: 'success',
  blocked: 'error',
  failed: 'error',
  skipped: 'default',
  processing: 'info',
};

const buildTaskOutcomeMessage = (task) => {
  if (!task) {
    return 'I could not complete that action.';
  }

  if (task.status === 'completed') {
    if (task.type === 'delivery-routing-preview') {
      return task.payload?.route === 'doorstep'
        ? 'Delivery has been approved for doorstep drop-off.'
        : 'Parcel has been sent to the security desk.';
    }

    if (task.type === 'complaint-create') {
      return 'Your complaint has been created successfully.';
    }

    if (task.type === 'visitor-status-update') {
      return task.payload?.status === 'approved'
        ? `${task.payload?.visitorName || 'The visitor'} has been approved.`
        : `${task.payload?.visitorName || 'The visitor'} has been updated successfully.`;
    }

    if (task.type === 'visitor-create') {
      return `${task.payload?.visitorName || 'The visitor'} has been logged at the gate.`;
    }

    if (task.type === 'visitor-verify-pass' || task.type === 'visitor-check-in') {
      return `${task.payload?.visitorName || 'The visitor'} has been checked in.`;
    }

    if (task.type === 'visitor-check-out') {
      return `${task.payload?.visitorName || 'The visitor'} has been checked out.`;
    }

    if (task.type === 'payment-create-charge') {
      return 'The maintenance charge has been created successfully.';
    }

    if (task.type === 'complaint-status-update') {
      return 'The complaint has been updated successfully.';
    }

    if (task.type === 'announcement-draft') {
      return 'The announcement draft has been created successfully.';
    }
  }

  if (task.status === 'queued') {
    return 'The action has been accepted and queued for processing.';
  }

  if (task.status === 'blocked') {
    return task.executionNote || 'This action is blocked for your account.';
  }

  if (task.status === 'failed') {
    return task.executionNote || 'The action failed before it could be completed.';
  }

  return task.executionNote || 'I could not complete that action.';
};

const buildPreviewTaskLabel = (task) => {
  if (!task) {
    return 'Ready for review';
  }

  if (task.type === 'delivery-routing-preview') {
    return task.payload?.route === 'doorstep'
      ? 'Ready to approve doorstep delivery'
      : 'Ready to send parcel to security desk';
  }

  if (task.type === 'complaint-create') {
    return 'Ready to create complaint';
  }

  if (task.type === 'visitor-status-update') {
    return task.payload?.status === 'approved'
      ? `Ready to approve ${task.payload?.visitorName || 'visitor'}`
      : task.title || 'Ready to update visitor';
  }

  if (task.type === 'payment-reminder') {
    return 'Ready to schedule dues reminder';
  }

  if (task.type === 'payment-create-charge') {
    return 'Ready to create maintenance charge';
  }

  if (task.type === 'announcement-draft') {
    return 'Ready to draft announcement';
  }

  if (task.type === 'complaint-status-update') {
    return 'Ready to update complaint status';
  }

  if (task.type === 'visitor-create') {
    return 'Ready to log walk-in visitor';
  }

  if (task.type === 'visitor-verify-pass') {
    return 'Ready to verify visitor pass';
  }

  if (task.type === 'visitor-check-in') {
    return 'Ready to check in visitor';
  }

  if (task.type === 'visitor-check-out') {
    return 'Ready to check out visitor';
  }

  return task.title || 'Ready for review';
};

const buildExecuteReply = (agentResponse) => {
  const tasks = agentResponse?.tasks || [];
  const primaryTask = tasks[0] || null;

  if (!primaryTask) {
    return agentResponse?.reply || 'I could not complete that action.';
  }

  if (tasks.length === 1) {
    return buildTaskOutcomeMessage(primaryTask);
  }

  return tasks.map((task) => buildTaskOutcomeMessage(task)).join(' ');
};

const getLocalConciergeReply = (input, { payments, complaints, bookings, staffAttendance, visitors, announcements, residents }, role = 'resident') => {
  const query = input.toLowerCase();
  if (/(^|\b)(hi|hello|hey|good morning|good evening)(\b|$)/.test(query)) {
    if (role === 'guard') {
      return 'Hello! I can help with gate approvals, walk-ins, pass verification, and check-ins.';
    }

    if (role === 'admin') {
      return 'Hello! I can help with charges, complaints, announcements, and visitor oversight.';
    }

    return 'Hello! I can help with dues, complaints, amenity bookings, and staff attendance.';
  }

  if (role === 'guard') {
    if (query.includes('visitor') || query.includes('gate') || query.includes('pass') || query.includes('otp')) {
      const preapproved = visitors.filter((visitor) => visitor.status === 'preapproved').length;
      const approved = visitors.filter((visitor) => visitor.status === 'approved').length;
      const checkedIn = visitors.filter((visitor) => visitor.status === 'checked_in').length;
      return `Gate status: ${preapproved} pre-approved pass${preapproved === 1 ? '' : 'es'}, ${approved} approved visitor${approved === 1 ? '' : 's'}, and ${checkedIn} checked-in visitor${checkedIn === 1 ? '' : 's'}.`;
    }

    return 'I can help with walk-in logging, pass verification, and visitor check-in or check-out.';
  }

  if (role === 'admin') {
    if (query.includes('charge') || query.includes('maintenance') || query.includes('dues')) {
      const totalOutstanding = payments
        .filter((payment) => payment.derivedStatus !== 'paid')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return `${residents.length} residents are in scope. Outstanding dues total Rs. ${totalOutstanding.toLocaleString('en-IN')}.`;
    }

    if (query.includes('complaint')) {
      const openComplaints = complaints.filter((complaint) => complaint.status !== 'resolved');
      return openComplaints.length
        ? `${openComplaints.length} complaint${openComplaints.length === 1 ? '' : 's'} are open. Latest issue is ${openComplaints[0].category} for Flat ${openComplaints[0].flat || 'unknown'}.`
        : 'There are no open complaints right now.';
    }

    if (query.includes('announcement') || query.includes('notice')) {
      return announcements.length
        ? `Latest announcement is ${announcements[0].title}.`
        : 'No announcements have been posted yet.';
    }
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

  if (query.includes('visitor') || query.includes('guest') || query.includes('delivery') || query.includes('parcel')) {
    const pendingVisitors = visitors.filter((visitor) => visitor.status === 'pending');
    if (!pendingVisitors.length) {
      return 'There are no pending visitors or deliveries waiting for your approval right now.';
    }

    return `${pendingVisitors.length} visitor or delivery request${pendingVisitors.length === 1 ? '' : 's'} are pending. Latest request is ${pendingVisitors[0].name} for ${pendingVisitors[0].purpose}.`;
  }

  if (query.includes('announcement') || query.includes('notice')) {
    if (!announcements.length) {
      return 'There are no recent announcements for your society.';
    }

    return `Latest announcement: ${announcements[0].title}.`;
  }

  return '';
};

const getFallbackReply = () => 'I can help with maintenance dues, complaints, amenity bookings, and staff attendance. Ask me about any of those.';

const ChatbotWidget = ({
  variant = 'panel',
  greetingName = 'there',
  bottomOffset = { xs: 20, md: 24 },
  title = 'AI Concierge',
  onClose,
}) => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(variant !== 'bubble');
  const [payments, setPayments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffAttendance, setStaffAttendance] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [residents, setResidents] = useState([]);
  const [executingTaskId, setExecutingTaskId] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const { user } = useAuthContext();
  const recognitionRef = useRef(null);
  const inputModeRef = useRef('text');

  useEffect(() => {
    setOpen(variant !== 'bubble');
  }, [variant]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let unsubPayments = () => {};
    let unsubComplaints = () => {};
    let unsubBookings = () => {};
    let unsubStaffMembers = () => {};
    let unsubStaffAttendance = () => {};
    let unsubVisitors = () => {};
    let unsubAnnouncements = () => {};
    let unsubResidents = () => {};

    if (user.role === 'admin') {
      unsubResidents = subscribeToResidents(setResidents);
      unsubPayments = subscribeToPayments(setPayments, user);
      unsubComplaints = subscribeToComplaints(setComplaints, { context: user });
      unsubBookings = subscribeToFacilityBookings(setBookings, user);
      unsubVisitors = subscribeToVisitors(setVisitors, user);
      unsubAnnouncements = subscribeToAnnouncements(setAnnouncements, user);
      unsubStaffAttendance = subscribeToStaffAttendance(setStaffAttendance, user);
    } else if (user.role === 'guard') {
      unsubVisitors = subscribeToVisitors(setVisitors, user);
      unsubAnnouncements = subscribeToAnnouncements(setAnnouncements, user);
      unsubStaffAttendance = subscribeToStaffAttendance(setStaffAttendance, user);
    } else {
      unsubPayments = subscribeToResidentPayments(user.uid, setPayments, user);
      unsubComplaints = subscribeToResidentComplaints(user.uid, setComplaints, user);
      unsubBookings = subscribeToResidentFacilityBookings(user.uid, setBookings, user);
      unsubStaffMembers = subscribeToResidentStaff(user.uid, setStaffMembers, user);
      unsubStaffAttendance = subscribeToResidentStaffAttendance(user.uid, setStaffAttendance, user);
      unsubVisitors = subscribeToVisitors((nextVisitors) => {
        setVisitors(nextVisitors.filter((visitor) => visitor.residentId === user.uid || visitor.flat === user.flat));
      }, user);
      unsubAnnouncements = subscribeToAnnouncements(setAnnouncements, user);
    }

    return () => {
      unsubPayments();
      unsubComplaints();
      unsubBookings();
      unsubStaffMembers();
      unsubStaffAttendance();
      unsubVisitors();
      unsubAnnouncements();
      unsubResidents();
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      recognitionRef.current = null;
      return undefined;
    }

    const recognition = new Recognition();
    recognition.lang = user?.language === 'kn' ? 'kn-IN' : user?.language === 'ta' ? 'ta-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        inputModeRef.current = 'voice';
        setInput(transcript);
      }
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.stop();
    };
  }, [user?.language]);

  const conciergeContext = useMemo(
    () => ({ payments, complaints, bookings, staffMembers, staffAttendance, visitors, announcements, residents }),
    [announcements, bookings, complaints, payments, residents, staffAttendance, staffMembers, visitors],
  );

  const channel = user?.role === 'guard'
    ? 'guard-dashboard-chat'
    : user?.role === 'admin'
      ? 'admin-dashboard-chat'
      : 'resident-dashboard-chat';

  const chatHistory = useMemo(
    () => messages.map((message) => ({ role: message.sender === 'bot' ? 'assistant' : 'user', content: message.text })).slice(-8),
    [messages],
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const currentInputMode = inputModeRef.current || 'text';
    const userMsg = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    setInput('');
    const agentResponse = await sendAgentMessage({
      message: input,
      chatHistory,
      authToken: user?.accessToken,
      inputMode: currentInputMode,
      channel,
      user: {
        uid: user?.uid,
        name: user?.name,
        role: user?.role,
        flat: user?.flat,
        societyId: user?.societyId,
        language: user?.language,
      },
      contextSnapshot: conciergeContext,
      executionMode: 'preview',
    });
    const localReply = agentResponse ? '' : getLocalConciergeReply(input, conciergeContext, user?.role);
    const reply = agentResponse?.reply || localReply || getFallbackReply();
    setMessages((msgs) => [...msgs, {
      sender: 'bot',
      text: reply,
      meta: agentResponse ? {
        agents: agentResponse.routing?.agents || [],
        gateway: agentResponse.gateway || null,
        requestMessage: input,
        requestInputMode: currentInputMode,
        tasks: agentResponse.tasks || [],
      } : null,
    }]);
    inputModeRef.current = 'text';
    setLoading(false);
  };

  const handleExecuteTask = async (task, requestMessage, requestInputMode = 'text') => {
    if (!task?.id || !requestMessage || !user?.uid) return;

    setExecutingTaskId(task.id);
    let agentResponse = null;

    if (String(user?.authProvider || '').startsWith('demo')) {
      agentResponse = await executeLocalAiTask(task, user, conciergeContext);
    } else {
      agentResponse = await sendAgentMessage({
        message: requestMessage,
        chatHistory,
        authToken: user?.accessToken,
        inputMode: 'text',
        channel,
        user: {
          uid: user?.uid,
          name: user?.name,
          role: user?.role,
          flat: user?.flat,
          societyId: user?.societyId,
          language: user?.language,
        },
        contextSnapshot: conciergeContext,
        executionMode: 'execute',
        approvedTaskIds: [task.id],
        requireConfirmation: true,
      });

      if (!agentResponse && String(user?.authProvider || '').startsWith('demo')) {
        agentResponse = await executeLocalAiTask(task, user, conciergeContext);
      }
    }

    setMessages((msgs) => [...msgs, {
      sender: 'bot',
      text: buildExecuteReply(agentResponse),
      meta: agentResponse ? {
        agents: agentResponse.routing?.agents || [],
        gateway: agentResponse.gateway || null,
        requestMessage,
        requestInputMode,
        tasks: agentResponse.tasks || [],
      } : null,
    }]);
    setExecutingTaskId('');
  };

  const handleVoiceToggle = () => {
    if (!recognitionRef.current || loading) return;

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleToggleOpen = () => {
    setOpen((currentOpen) => !currentOpen);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }

    handleToggleOpen();
  };

  const widgetShellSx = {
    position: 'fixed',
    bottom: bottomOffset,
    right: { xs: 16, md: 24 },
    zIndex: 1200,
  };

  const panelSx = {
    width: variant === 'embedded' ? '100%' : { xs: 'min(92vw, 340px)', md: 340 },
    maxHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: 4,
    border: '1px solid rgba(223, 199, 165, 0.42)',
    boxShadow: '0 22px 44px rgba(89, 105, 141, 0.2)',
  };

  const panel = (
    <Paper elevation={10} sx={panelSx}>
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
        <Typography variant="h6">{title}</Typography>
        {(variant === 'bubble' || onClose) && (
          <IconButton size="small" onClick={handleClose} sx={{ color: '#fff' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <List sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.25, bgcolor: 'rgba(255, 249, 240, 0.78)' }}>
        {messages.map((msg, idx) => (
          <ListItem key={idx} sx={{ px: 0, alignItems: 'flex-start', justifyContent: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
            <ListItemText
              primary={(
                <Box>
                  <Typography sx={{ fontSize: 15, lineHeight: 1.45 }}>{msg.text}</Typography>
                  {msg.meta?.agents?.length ? (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                      {msg.meta.requestInputMode ? (
                        <Chip label={msg.meta.requestInputMode === 'voice' ? 'Voice request' : 'Text request'} size="small" />
                      ) : null}
                      {msg.meta.agents.map((agent) => (
                        <Chip key={agent} label={`${agent} agent`} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : null}
                  {msg.meta?.tasks?.length ? (
                    <Box sx={{ mt: 1 }}>
                      {msg.meta.tasks.slice(0, 3).map((task) => (
                        <Box key={task.id || `${task.title}-${task.status}`} sx={{ mt: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {task.status === 'preview' ? buildPreviewTaskLabel(task) : task.title}
                            </Typography>
                            <Chip
                              label={taskStatusLabelMap[task.status] || task.status || 'Status unknown'}
                              size="small"
                              color={taskStatusColorMap[task.status] || 'default'}
                              variant={task.status === 'preview' ? 'outlined' : 'filled'}
                            />
                          </Box>
                          {task.executionNote ? (
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                              {task.executionNote}
                            </Typography>
                          ) : null}
                          {task.status === 'preview' && task.requiresConfirmation ? (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ mt: 0.75 }}
                              disabled={loading || executingTaskId === task.id}
                              onClick={() => handleExecuteTask(task, msg.meta.requestMessage, msg.meta.requestInputMode)}
                            >
                              {executingTaskId === task.id ? 'Running...' : 'Run Plan'}
                            </Button>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              )}
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
            />
          </ListItem>
        ))}
      </List>

      <Box display="flex" p={1.25} borderTop="1px solid rgba(223, 199, 165, 0.45)" bgcolor="rgba(255,255,255,0.9)">
        <TextField
          fullWidth
          size="small"
          placeholder={loading ? 'Waiting for AI reply...' : isListening ? 'Listening...' : 'Type or speak your message...'}
          value={input}
          onChange={(e) => {
            inputModeRef.current = 'text';
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) {
              inputModeRef.current = 'text';
              handleSend();
            }
          }}
          disabled={loading}
        />
        {speechSupported ? (
          <IconButton color={isListening ? 'secondary' : 'default'} onClick={handleVoiceToggle} sx={{ ml: 0.5 }} disabled={loading}>
            <MicIcon />
          </IconButton>
        ) : null}
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

  if (variant === 'embedded') {
    return panel;
  }

  return <Box sx={widgetShellSx}>{panel}</Box>;
};

export default ChatbotWidget;

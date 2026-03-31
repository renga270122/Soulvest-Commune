import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, IconButton, List, ListItem, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const initialMessages = [
  { sender: 'bot', text: 'Hi! I am your AI assistant. How can I help you today?' }
];

const simpleBotReply = (input) => {
  const text = input.toLowerCase();
  if (text.includes('approve')) return 'To approve a visitor, click the Approve button next to their name.';
  if (text.includes('visitor')) return 'You can view all visitors in the Pending Visitor Approvals section.';
  if (text.includes('help')) return 'I can help you with visitor approvals, notifications, and more!';
  if (text.includes('log')) return 'Visitor logs are available in the dashboard.';
  return "Sorry, I didn't understand that. Please try asking about visitors, approvals, or help.";
};

const ChatbotWidget = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    const botMsg = { sender: 'bot', text: simpleBotReply(input) };
    setMessages((msgs) => [...msgs, userMsg, botMsg]);
    setInput('');
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
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          />
          <IconButton color="primary" onClick={handleSend} sx={{ ml: 1 }}>
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatbotWidget;

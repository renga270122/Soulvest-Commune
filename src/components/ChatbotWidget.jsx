import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, IconButton, List, ListItem, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

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

const ChatbotWidget = () => {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    setInput('');
    const reply = await getLLMReply(input);
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

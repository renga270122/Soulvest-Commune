// This file provides a backend endpoint for LLM-powered chatbot replies using OpenAI API.
require('dotenv').config();
const express = require('express');
const router = express.Router();
router.use(express.json());
console.log('Chatbot LLM route loaded');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { orchestrateAgentMessage } = require('./ai/agent-orchestrator');
const { getDb, getFirebaseStatus } = require('./firebase');

// POST /chatbot-llm
router.post('/chatbot-llm', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not set' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant for an apartment management app. Answer user queries about visitors, approvals, amenities, and general help.' },
          { role: 'user', content: message }
        ],
        max_tokens: 200
      })
    });
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: 'No reply from LLM', details: data });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to get LLM reply', details: err.message });
  }
});

router.post('/agent-message', async (req, res) => {
  const {
    message,
    user = {},
    chatHistory = [],
    contextSnapshot = {},
    executionMode = 'preview',
    approvedTaskIds = [],
    requireConfirmation = false,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const result = await orchestrateAgentMessage(
      {
        message,
        user,
        chatHistory,
        contextSnapshot,
        executionMode,
        approvedTaskIds,
        requireConfirmation,
      },
      { getDb, getFirebaseStatus },
    );

    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process agent message',
      details: error.message,
    });
  }
});

module.exports = router;

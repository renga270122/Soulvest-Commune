// This file provides a backend endpoint for LLM-powered chatbot replies using OpenAI API.
require('dotenv').config();
const express = require('express');
const router = express.Router();
router.use(express.json());
console.log('Chatbot LLM route loaded');

const { buildAgentGatewayRequest } = require('./ai/agent-gateway');
const { orchestrateAgentMessage } = require('./ai/agent-orchestrator');
const { logAiEvaluation } = require('./ai/evaluation-logger');
const { generateSimpleReply } = require('./ai/llm-client');
const { getAdminAuth, getDb, getFirebaseStatus } = require('./firebase');
const { resolveAuthenticatedActor } = require('./auth/identity');

// POST /chatbot-llm
router.post('/chatbot-llm', async (req, res) => {
  const startedAt = Date.now();
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try {
    const llmResponse = await generateSimpleReply({
      systemPrompt: 'You are a helpful AI assistant for an apartment management app. Answer user queries about visitors, approvals, amenities, and general help.',
      userMessage: message,
      maxTokens: 200,
      temperature: 0.4,
    });

    if (llmResponse?.text) {
      await logAiEvaluation({
        route: '/chatbot-llm',
        gateway: {
          requestId: null,
          receivedAt: new Date().toISOString(),
          route: '/chatbot-llm',
          channel: 'legacy-chatbot',
          inputMode: 'text',
          executionMode: 'preview',
          durationMs: Date.now() - startedAt,
        },
        request: {
          message,
          executionMode: 'preview',
          inputMode: 'text',
          channel: 'legacy-chatbot',
        },
        responseText: llmResponse.text,
        llm: {
          provider: llmResponse.provider,
          model: llmResponse.model,
        },
        dependencies: { getDb, getFirebaseStatus },
      });
      res.json({ reply: llmResponse.text });
    } else {
      res.status(500).json({ error: 'No reply from LLM' });
    }
  } catch (err) {
    await logAiEvaluation({
      route: '/chatbot-llm',
      gateway: {
        requestId: null,
        receivedAt: new Date().toISOString(),
        route: '/chatbot-llm',
        channel: 'legacy-chatbot',
        inputMode: 'text',
        executionMode: 'preview',
        durationMs: Date.now() - startedAt,
      },
      request: {
        message,
        executionMode: 'preview',
        inputMode: 'text',
        channel: 'legacy-chatbot',
      },
      error: err,
      dependencies: { getDb, getFirebaseStatus },
    });
    res.status(500).json({ error: 'Failed to get LLM reply', details: err.message });
  }
});

router.post('/agent-message', async (req, res) => {
  const startedAt = Date.now();
  try {
    const gatewayRequest = await buildAgentGatewayRequest(req, {
      resolveAuthenticatedActor,
      getAdminAuth,
      getDb,
      getFirebaseStatus,
    });

    if (gatewayRequest.request.executionMode === 'execute' && !gatewayRequest.authResult.authenticated) {
      await logAiEvaluation({
        route: '/agent-message',
        gateway: gatewayRequest.gateway,
        request: gatewayRequest.request,
        error: Object.assign(new Error(gatewayRequest.authResult.errorMessage || 'Authenticated execution is required'), {
          statusCode: 401,
        }),
        dependencies: { getDb, getFirebaseStatus },
      });
      return res.status(401).json({
        error: 'Authenticated execution is required',
        details: gatewayRequest.authResult.errorMessage,
        code: gatewayRequest.authResult.errorCode,
      });
    }

    const result = await orchestrateAgentMessage(gatewayRequest.request, { getDb, getFirebaseStatus });
    gatewayRequest.gateway.durationMs = Date.now() - startedAt;
    gatewayRequest.request.contextMeta = result.mcpContext?.contextMeta || null;

    await logAiEvaluation({
      route: '/agent-message',
      gateway: gatewayRequest.gateway,
      request: gatewayRequest.request,
      result,
      llm: result.llm,
      dependencies: { getDb, getFirebaseStatus },
    });

    res.json({
      ok: true,
      requestId: gatewayRequest.requestId,
      gateway: gatewayRequest.gateway,
      ...result,
    });
  } catch (error) {
    await logAiEvaluation({
      route: '/agent-message',
      gateway: {
        requestId: null,
        receivedAt: new Date().toISOString(),
        route: '/agent-message',
        channel: String(req.body?.channel || 'resident-dashboard-chat'),
        inputMode: req.body?.inputMode === 'voice' ? 'voice' : 'text',
        executionMode: req.body?.executionMode || 'preview',
        durationMs: Date.now() - startedAt,
      },
      request: {
        message: req.body?.message || '',
        executionMode: req.body?.executionMode || 'preview',
        inputMode: req.body?.inputMode === 'voice' ? 'voice' : 'text',
        channel: String(req.body?.channel || 'resident-dashboard-chat'),
        contextMeta: null,
      },
      error,
      dependencies: { getDb, getFirebaseStatus },
    });
    res.status(error.statusCode || 500).json({
      error: 'Failed to process agent message',
      details: error.message,
    });
  }
});

module.exports = router;

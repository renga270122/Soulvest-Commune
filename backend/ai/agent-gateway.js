const crypto = require('crypto');

function createGatewayError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function buildAgentGatewayRequest(req, services) {
  const {
    message,
    user = {},
    chatHistory = [],
    contextSnapshot = {},
    executionMode = 'preview',
    approvedTaskIds = [],
    requireConfirmation = false,
    inputMode = 'text',
    channel = 'resident-dashboard-chat',
    clientRequestId,
  } = req.body || {};

  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    throw createGatewayError('Missing message');
  }

  if (!['preview', 'execute'].includes(executionMode)) {
    throw createGatewayError('executionMode must be preview or execute.');
  }

  const authResult = await services.resolveAuthenticatedActor(req, user, services);
  const requestId = String(clientRequestId || crypto.randomUUID());
  const receivedAt = new Date().toISOString();

  return {
    requestId,
    receivedAt,
    authResult,
    request: {
      message: normalizedMessage,
      user: authResult.actor || user,
      chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
      contextSnapshot: contextSnapshot && typeof contextSnapshot === 'object' ? contextSnapshot : {},
      executionMode,
      approvedTaskIds: Array.isArray(approvedTaskIds) ? approvedTaskIds : [],
      requireConfirmation: Boolean(requireConfirmation),
      inputMode: inputMode === 'voice' ? 'voice' : 'text',
      channel: String(channel || 'resident-dashboard-chat'),
      auth: {
        authenticated: authResult.authenticated,
        authProvider: authResult.authProvider,
      },
    },
    gateway: {
      requestId,
      receivedAt,
      route: req.path,
      channel: String(channel || 'resident-dashboard-chat'),
      inputMode: inputMode === 'voice' ? 'voice' : 'text',
      executionMode,
      authProvider: authResult.authProvider || 'anonymous',
      approvedTaskCount: Array.isArray(approvedTaskIds) ? approvedTaskIds.length : 0,
    },
  };
}

module.exports = {
  buildAgentGatewayRequest,
};
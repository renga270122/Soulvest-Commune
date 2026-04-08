require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetchImpl }) => fetchImpl(...args));

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
const CONCIERGE_PROMPT_VERSION = 'concierge-v2';
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 5000);

function trimTrailingSlash(value = '') {
  return String(value).replace(/\/$/, '');
}

function getLlmProviderConfig() {
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_DEPLOYMENT) {
    const endpoint = trimTrailingSlash(process.env.AZURE_OPENAI_ENDPOINT);
    return {
      provider: 'azure-openai',
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      url: `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${DEFAULT_AZURE_API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
      buildBody: ({ messages, maxTokens, temperature }) => ({
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: DEFAULT_MODEL,
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      buildBody: ({ messages, maxTokens, temperature }) => ({
        model: DEFAULT_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    };
  }

  return null;
}

async function requestChatCompletion({ messages, maxTokens, temperature }) {
  const providerConfig = getLlmProviderConfig();
  if (!providerConfig) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(providerConfig.url, {
      method: 'POST',
      headers: providerConfig.headers,
      body: JSON.stringify(providerConfig.buildBody({ messages, maxTokens, temperature })),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${LLM_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'LLM request failed.');
  }

  return {
    text: data?.choices?.[0]?.message?.content?.trim() || '',
    provider: providerConfig.provider,
    model: providerConfig.model,
    promptVersion: CONCIERGE_PROMPT_VERSION,
  };
}

async function generateConciergeReply({ promptContext, agentSummaries, userMessage, language = 'en' }) {
  const messages = [
    {
      role: 'system',
      content: [
        'You are Soulvest Commune AI Concierge.',
        'Ground every answer in the supplied MCP context and agent summaries.',
        'Keep replies concise, action-oriented, and accurate.',
        'If work is only planned or previewed, say that clearly.',
        `Reply in ${language === 'kn' ? 'Kannada' : language === 'ta' ? 'Tamil' : 'English'} unless the user message clearly requests a different supported language.`,
      ].join(' '),
    },
    { role: 'system', content: promptContext },
    { role: 'system', content: `Agent summaries:\n${agentSummaries.join('\n')}` },
    { role: 'user', content: userMessage },
  ];

  const result = await requestChatCompletion({
    messages,
    maxTokens: 300,
    temperature: 0.3,
  });

  return result || {
    text: '',
    provider: 'none',
    model: null,
    promptVersion: CONCIERGE_PROMPT_VERSION,
  };
}

async function generateSimpleReply({ systemPrompt, userMessage, maxTokens = 200, temperature = 0.4 }) {
  const result = await requestChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    maxTokens,
    temperature,
  });

  return result || {
    text: '',
    provider: 'none',
    model: null,
  };
}

module.exports = {
  CONCIERGE_PROMPT_VERSION,
  generateConciergeReply,
  generateSimpleReply,
  getLlmProviderConfig,
};
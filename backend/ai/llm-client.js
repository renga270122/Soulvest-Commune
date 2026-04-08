require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetchImpl }) => fetchImpl(...args));

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

async function generateConciergeReply({ promptContext, agentSummaries, userMessage, language = 'en' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return '';
  }

  const systemPrompt = [
    'You are Soulvest Commune AI Concierge.',
    'Ground every answer in the supplied MCP context and agent summaries.',
    'Keep replies concise, action-oriented, and accurate.',
    'If work is only planned or previewed, say that clearly.',
    `Reply in ${language === 'kn' ? 'Kannada' : 'English'} unless the user message clearly requests a different supported language.`,
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: promptContext },
        { role: 'system', content: `Agent summaries:\n${agentSummaries.join('\n')}` },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'LLM request failed.');
  }

  return data?.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = {
  generateConciergeReply,
};
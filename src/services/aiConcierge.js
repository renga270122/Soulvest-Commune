const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');
const CHATBOT_TIMEOUT_MS = 8000;

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

export async function sendAgentMessage(payload) {
  if (!API_BASE_URL) {
    return null;
  }

  const { signal, cleanup } = createTimeoutSignal(CHATBOT_TIMEOUT_MS);
  const { authToken, ...requestBody } = payload;

  try {
    const response = await fetch(`${API_BASE_URL}/agent-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return null;
    }

    return data;
  } catch {
    return null;
  } finally {
    cleanup();
  }
}
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');
const FEEDBACK_REQUEST_TIMEOUT_MS = 15000;

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

async function fetchFeedback(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('Feedback backend is not configured. Set VITE_API_BASE_URL before using the feedback form.');
  }

  const { signal, cleanup } = createTimeoutSignal(FEEDBACK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.details || 'Unable to complete the feedback request.');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The feedback service took too long to respond. Please try again in a few seconds.');
    }

    throw error;
  } finally {
    cleanup();
  }
}

export async function submitResidentFeedback(payload) {
  return fetchFeedback('/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listResidentFeedback() {
  const data = await fetchFeedback('/feedback');
  return Array.isArray(data.feedback) ? data.feedback : [];
}
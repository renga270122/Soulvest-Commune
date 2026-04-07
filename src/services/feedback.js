const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');

export async function submitResidentFeedback(payload) {
  if (!API_BASE_URL) {
    throw new Error('Feedback backend is not configured. Set VITE_API_BASE_URL before using the feedback form.');
  }

  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.details || 'Unable to submit feedback.');
  }

  return data;
}
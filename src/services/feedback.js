import { IS_DEMO_MODE } from '../config/appMode';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');
const FEEDBACK_REQUEST_TIMEOUT_MS = 15000;
const DEMO_FEEDBACK_STORAGE_KEY = 'soulvest-resident-feedback';

function getDemoFeedbackRecords() {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(DEMO_FEEDBACK_STORAGE_KEY);
    const parsedValue = JSON.parse(rawValue || '[]');
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function setDemoFeedbackRecords(records) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_FEEDBACK_STORAGE_KEY, JSON.stringify(records));
}

function createDemoFeedbackId() {
  return `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shouldUseDemoFeedbackFallback() {
  return IS_DEMO_MODE && !API_BASE_URL;
}

async function submitDemoResidentFeedback(payload) {
  const created = {
    id: createDemoFeedbackId(),
    name: String(payload?.name || '').trim(),
    flat: String(payload?.flat || '').trim(),
    rating: Number(payload?.rating || 0),
    category: String(payload?.category || 'general').trim() || 'general',
    message: String(payload?.message || '').trim(),
    source: String(payload?.source || 'public-feedback-form'),
    createdAt: new Date().toISOString(),
  };

  const records = getDemoFeedbackRecords();
  records.unshift(created);
  setDemoFeedbackRecords(records);

  return {
    ok: true,
    id: created.id,
    message: 'Feedback submitted successfully.',
  };
}

async function listDemoResidentFeedback() {
  return getDemoFeedbackRecords().sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime() || 0;
    const rightTime = new Date(right.createdAt || 0).getTime() || 0;
    return rightTime - leftTime;
  });
}

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
  if (shouldUseDemoFeedbackFallback()) {
    return submitDemoResidentFeedback(payload);
  }

  return fetchFeedback('/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listResidentFeedback() {
  if (shouldUseDemoFeedbackFallback()) {
    return listDemoResidentFeedback();
  }

  const data = await fetchFeedback('/feedback');
  return Array.isArray(data.feedback) ? data.feedback : [];
}
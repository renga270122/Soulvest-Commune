import { DEFAULT_CITY_ID } from '../config/cities';
import { DEFAULT_SOCIETY_ID } from '../config/firestore';
import {
  DEMO_PASSWORD,
  addDemoUser,
  findDemoUserByIdentifier,
  getDemoAccounts,
  resetDemoState,
  sanitizeUser,
  normalizeFlatValue,
} from './demoStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');

async function requestBackendDemoSession({ identifier, password, role }) {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.token) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function requestBackendDemoRegistration(form) {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/demo-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.details || data?.error || 'Failed to register demo resident.');
    }

    if (!data?.token || !data?.user) {
      throw new Error('Backend demo registration did not return a session token.');
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

const buildSessionUser = (user, auth = {}) => ({
  uid: user.id,
  email: user.email || '',
  mobile: user.mobile || '',
  role: user.role || 'resident',
  name: user.name || 'Resident',
  flat: user.flat || '',
  cityId: user.cityId || DEFAULT_CITY_ID,
  societyId: user.societyId || DEFAULT_SOCIETY_ID,
  language: user.language || 'en',
  emergencyContactName: user.emergencyContactName || '',
  emergencyContactPhone: user.emergencyContactPhone || '',
  householdSize: user.householdSize || 1,
  vehicleNumber: user.vehicleNumber || '',
  photoDataUrl: user.photoDataUrl || '',
  accessToken: auth.token || '',
  authProvider: auth.user?.authProvider || auth.authProvider || 'demo-local',
});

export async function loginDemoUser({ identifier, password, role }) {
  const user = findDemoUserByIdentifier(identifier);
  if (!user) {
    throw new Error('No demo user found with this mobile number or email.');
  }
  if (user.password !== password) {
    throw new Error('Incorrect demo password. Use demo123.');
  }
  if (role && user.role !== role) {
    throw new Error(`This account is registered as ${user.role}, not ${role}.`);
  }
  const auth = await requestBackendDemoSession({ identifier, password, role });
  return buildSessionUser(user, auth || {});
}

export async function quickDemoAccess(role = 'resident') {
  const account = getDemoAccounts().find((entry) => entry.role === role) || getDemoAccounts()[0];
  const user = findDemoUserByIdentifier(account.email || account.mobile);
  const auth = await requestBackendDemoSession({
    identifier: account.email || account.mobile,
    password: user.password,
    role: user.role,
  });
  return buildSessionUser(user, auth || {});
}

export async function registerDemoResident(form) {
  const email = form.email.trim().toLowerCase();
  const mobile = form.mobile.trim();
  const normalizedForm = {
    name: form.name.trim(),
    flat: normalizeFlatValue(form.flat),
    mobile,
    email,
    password: form.password,
    language: form.language || 'en',
  };

  if (findDemoUserByIdentifier(email)) {
    throw new Error('A demo user already exists with this email.');
  }
  if (findDemoUserByIdentifier(mobile)) {
    throw new Error('A demo user already exists with this mobile number.');
  }

  const backendRegistration = await requestBackendDemoRegistration(normalizedForm);

  const nextState = addDemoUser({
    id: backendRegistration?.user?.uid,
    ...normalizedForm,
    role: 'resident',
  });

  const createdUser = nextState.users[nextState.users.length - 1];
  return buildSessionUser(createdUser, backendRegistration || {});
}

export async function requestDemoPasswordReset(identifier) {
  const user = findDemoUserByIdentifier(identifier);
  if (!user) {
    throw new Error('No demo user found with this mobile number or email.');
  }
  return `Demo mode: password reset is not required. Use ${DEMO_PASSWORD} to sign in.`;
}

export function getDemoAccountList() {
  return getDemoAccounts();
}

export function resetAllDemoData() {
  return resetDemoState();
}

export function toSafeDemoUser(user) {
  return sanitizeUser(user);
}

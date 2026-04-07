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

const buildSessionUser = (user) => ({
  uid: user.id,
  email: user.email || '',
  mobile: user.mobile || '',
  role: user.role || 'resident',
  name: user.name || 'Resident',
  flat: user.flat || '',
  cityId: user.cityId || DEFAULT_CITY_ID,
  societyId: user.societyId || DEFAULT_SOCIETY_ID,
  language: user.language || 'en',
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
  return buildSessionUser(user);
}

export async function quickDemoAccess(role = 'resident') {
  const account = getDemoAccounts().find((entry) => entry.role === role) || getDemoAccounts()[0];
  const user = findDemoUserByIdentifier(account.email || account.mobile);
  return buildSessionUser(user);
}

export async function registerDemoResident(form) {
  const email = form.email.trim().toLowerCase();
  const mobile = form.mobile.trim();
  if (findDemoUserByIdentifier(email)) {
    throw new Error('A demo user already exists with this email.');
  }
  if (findDemoUserByIdentifier(mobile)) {
    throw new Error('A demo user already exists with this mobile number.');
  }

  const nextState = addDemoUser({
    name: form.name.trim(),
    flat: normalizeFlatValue(form.flat),
    mobile,
    email,
    password: form.password,
    role: 'resident',
  });

  const createdUser = nextState.users[nextState.users.length - 1];
  return buildSessionUser(createdUser);
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

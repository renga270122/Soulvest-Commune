import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_CITY_ID, getCityConfig } from './cities';

export const ROOT_COLLECTIONS = Object.freeze({
  cities: 'cities',
  societies: 'societies',
  users: 'users',
});

export const SOCIETY_COLLECTIONS = Object.freeze({
  apartments: 'apartments',
  residents: 'residents',
  visitors: 'visitors',
  staff: 'staff',
  staffAttendance: 'staffAttendance',
  announcements: 'announcements',
  complaints: 'complaints',
  payments: 'payments',
});

export const DEFAULT_SOCIETY_ID = import.meta.env.VITE_DEFAULT_SOCIETY_ID || 'brigade-metropolis';

export const FIRESTORE_SCHEMA = Object.freeze({
  city: () => ({
    name: '',
    state: '',
    language: 'en',
    active: true,
    createdAt: null,
  }),
  society: () => ({
    cityId: DEFAULT_CITY_ID,
    name: '',
    address: {},
    totalUnits: 0,
    plan: 'free',
    planExpiry: null,
    language: getCityConfig(DEFAULT_CITY_ID).language,
    settings: {
      featureFlags: {},
      notifications: {},
      branding: {},
    },
    createdAt: null,
  }),
  apartment: () => ({
    floor: 0,
    unit: '',
    residentId: null,
    status: 'vacant',
  }),
  resident: () => ({
    userId: null,
    aptId: null,
    name: '',
    phone: '',
    email: '',
    role: 'owner',
    active: true,
  }),
  visitor: () => ({
    name: '',
    phone: '',
    photo: '',
    purpose: '',
    hostResidentId: null,
    otp: '',
    otpExpiry: null,
    status: 'pending',
    entryTime: null,
    exitTime: null,
    aiRiskScore: 0,
    createdAt: null,
  }),
  staff: () => ({
    name: '',
    phone: '',
    role: '',
    type: 'guard',
    shift: 'morning',
    active: true,
  }),
  staffAttendance: () => ({
    userId: null,
    name: '',
    role: 'guard',
    shift: 'morning',
    status: 'clocked_in',
    clockInAt: null,
    clockOutAt: null,
    notes: '',
  }),
  announcement: () => ({
    title: '',
    body: '',
    postedBy: null,
    aiGenerated: false,
    language: 'en',
    createdAt: null,
  }),
  complaint: () => ({
    residentId: null,
    category: 'security',
    description: '',
    status: 'open',
    aiPriority: 'low',
    createdAt: null,
    resolvedAt: null,
  }),
  payment: () => ({
    residentId: null,
    aptId: null,
    month: '',
    year: new Date().getFullYear(),
    amount: 0,
    status: 'pending',
    razorpayOrderId: '',
    paidAt: null,
  }),
  user: () => ({
    name: '',
    phone: '',
    email: '',
    societyId: DEFAULT_SOCIETY_ID,
    aptId: null,
    role: 'resident',
    language: 'en',
    fcmToken: '',
    createdAt: null,
  }),
});

function assertSocietyCollection(collectionName) {
  if (!Object.prototype.hasOwnProperty.call(SOCIETY_COLLECTIONS, collectionName)) {
    throw new Error(`Unknown society collection: ${collectionName}`);
  }

  return SOCIETY_COLLECTIONS[collectionName];
}

export function getSocietyRuntimeContext(user) {
  const cityId = user?.cityId || DEFAULT_CITY_ID;
  const societyId = user?.societyId || DEFAULT_SOCIETY_ID;
  const cityConfig = getCityConfig(cityId);

  return {
    cityId,
    societyId,
    language: user?.language || cityConfig.language || 'en',
    societySettings: user?.settings || {},
  };
}

export function getSocietyId(userOrSocietyId) {
  if (typeof userOrSocietyId === 'string' && userOrSocietyId) {
    return userOrSocietyId;
  }

  return getSocietyRuntimeContext(userOrSocietyId).societyId;
}

export function getSocietyPath(societyId = DEFAULT_SOCIETY_ID) {
  return `${ROOT_COLLECTIONS.societies}/${societyId}`;
}

export function getSocietyCollectionPath(collectionName, societyId = DEFAULT_SOCIETY_ID) {
  return `${getSocietyPath(societyId)}/${assertSocietyCollection(collectionName)}`;
}

export function getSocietyCollectionRef(collectionName, societyId = DEFAULT_SOCIETY_ID) {
  return collection(db, getSocietyCollectionPath(collectionName, societyId));
}

export function getSocietyDocRef(collectionName, docId, societyId = DEFAULT_SOCIETY_ID) {
  return doc(db, getSocietyCollectionPath(collectionName, societyId), docId);
}
import { DEFAULT_CITY_ID } from '../config/cities';
import { DEFAULT_SOCIETY_ID } from '../config/firestore';

const STORAGE_KEY = 'soulvest_demo_store_v1';
const DEMO_PASSWORD = 'demo123';
const listeners = new Set();
let stateCache = null;
let storageListenerAttached = false;

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const normalizeFlatValue = (flat) => flat?.trim().toUpperCase() || '';

const createSeedState = () => {
  const societyId = DEFAULT_SOCIETY_ID;
  const createdAt = nowIso();
  const adminId = 'user_admin_demo';
  const guardId = 'user_guard_demo';
  const residentOneId = 'user_resident_demo_1';
  const residentTwoId = 'user_resident_demo_2';
  const residentThreeId = 'user_resident_demo_3';

  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentYear = today.getFullYear();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(today.getTime() + 48 * 60 * 60 * 1000);
  const twoHoursAhead = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const threeHoursAhead = new Date(Date.now() + 3 * 60 * 60 * 1000);

  return {
    meta: {
      version: 1,
      initializedAt: createdAt,
    },
    users: [
      {
        id: adminId,
        name: 'Aarav Rao',
        email: 'admin@soulvest.demo',
        mobile: '9000000001',
        password: DEMO_PASSWORD,
        role: 'admin',
        flat: '',
        cityId: DEFAULT_CITY_ID,
        societyId,
        language: 'en',
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: guardId,
        name: 'Mahesh Kumar',
        email: 'guard@soulvest.demo',
        mobile: '9000000002',
        password: DEMO_PASSWORD,
        role: 'guard',
        flat: '',
        cityId: DEFAULT_CITY_ID,
        societyId,
        language: 'en',
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: residentOneId,
        name: 'Priya Nair',
        email: 'resident@soulvest.demo',
        mobile: '9000000003',
        password: DEMO_PASSWORD,
        role: 'resident',
        flat: 'A-101',
        cityId: DEFAULT_CITY_ID,
        societyId,
        language: 'en',
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: residentTwoId,
        name: 'Karan Shah',
        email: 'resident2@soulvest.demo',
        mobile: '9000000004',
        password: DEMO_PASSWORD,
        role: 'resident',
        flat: 'A-102',
        cityId: DEFAULT_CITY_ID,
        societyId,
        language: 'en',
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: residentThreeId,
        name: 'Meera Iyer',
        email: 'resident3@soulvest.demo',
        mobile: '9000000005',
        password: DEMO_PASSWORD,
        role: 'resident',
        flat: 'B-201',
        cityId: DEFAULT_CITY_ID,
        societyId,
        language: 'en',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    visitors: [
      {
        id: 'visitor_pending_demo',
        name: 'Rohan Mehta',
        phone: '9876500011',
        purpose: 'Guest visit',
        flat: 'A-101',
        residentId: residentOneId,
        residentName: 'Priya Nair',
        societyId,
        status: 'pending',
        time: 'Today 6:30 PM',
        entryMethod: 'walk-in',
        history: [{ type: 'pending', actor: 'Mahesh Kumar', at: nowIso() }],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'visitor_preapproved_demo',
        name: 'Anita Rao',
        visitorName: 'Anita Rao',
        phone: '9876500012',
        purpose: 'Family visit',
        flat: 'A-101',
        residentId: residentOneId,
        residentName: 'Priya Nair',
        societyId,
        status: 'preapproved',
        otp: '483920',
        passToken: 'SV-DEMO100',
        qrPayload: JSON.stringify({ type: 'soulvest-pass', passToken: 'SV-DEMO100', otp: '483920' }),
        expectedAt: twoHoursAhead.toISOString(),
        passExpiresAt: threeHoursAhead.toISOString(),
        entryMethod: 'resident-pass',
        history: [{ type: 'preapproved', actor: 'Priya Nair', at: createdAt }],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'visitor_checked_in_demo',
        name: 'Fresh Mart Delivery',
        phone: '9876500013',
        purpose: 'Delivery',
        flat: 'A-102',
        residentId: residentTwoId,
        residentName: 'Karan Shah',
        societyId,
        status: 'checked_in',
        time: 'Today 4:15 PM',
        checkedInAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        entryMethod: 'walk-in',
        history: [
          { type: 'pending', actor: 'Mahesh Kumar', at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
          { type: 'approved', actor: 'Karan Shah', at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
          { type: 'checked_in', actor: 'Mahesh Kumar', at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    announcements: [
      {
        id: 'announcement_demo_1',
        title: 'Water Tank Cleaning Tomorrow',
        body: 'Water supply will pause from 10 AM to 12 PM during scheduled tank cleaning.',
        audience: 'all',
        pinned: true,
        postedBy: { uid: adminId, name: 'Aarav Rao' },
        acknowledgements: [{ userId: residentTwoId, at: createdAt }],
        societyId,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'announcement_demo_2',
        title: 'Ugadi Community Potluck',
        body: 'Join us in the clubhouse at 7 PM this Saturday. Families can bring one dish each.',
        audience: 'all',
        pinned: false,
        postedBy: { uid: adminId, name: 'Aarav Rao' },
        acknowledgements: [],
        societyId,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    complaints: [
      {
        id: 'complaint_demo_1',
        residentId: residentOneId,
        residentName: 'Priya Nair',
        flat: 'A-101',
        societyId,
        category: 'plumbing',
        description: 'Kitchen sink is leaking under the cabinet.',
        status: 'open',
        aiPriority: 'medium',
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'complaint_demo_2',
        residentId: residentTwoId,
        residentName: 'Karan Shah',
        flat: 'A-102',
        societyId,
        category: 'security',
        description: 'Basement light near parking slot P12 is not working.',
        status: 'resolved',
        aiPriority: 'high',
        createdAt,
        updatedAt: createdAt,
        resolvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
    facilityBookings: [
      {
        id: 'booking_demo_1',
        residentId: residentOneId,
        residentName: 'Priya Nair',
        flat: 'A-101',
        societyId,
        amenity: 'Clubhouse',
        bookingDate: tomorrow.toISOString(),
        slot: '07:00 PM - 08:00 PM',
        bookingCode: 'BK-DEMO01',
        guestCount: 8,
        status: 'confirmed',
        notes: 'Family dinner',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    payments: [
      {
        id: 'payment_demo_1',
        userId: residentOneId,
        residentName: 'Priya Nair',
        flat: 'A-101',
        societyId,
        title: 'Monthly Maintenance',
        dueDate: dayAfter.toISOString(),
        amount: 3500,
        breakdown: { Security: 40, Housekeeping: 25, Utilities: 20, Other: 15 },
        status: 'pending',
        method: 'manual',
        createdAt,
        updatedAt: createdAt,
        month: currentMonth,
        year: currentYear,
      },
      {
        id: 'payment_demo_2',
        userId: residentTwoId,
        residentName: 'Karan Shah',
        flat: 'A-102',
        societyId,
        title: 'Amenity Charge',
        dueDate: today.toISOString(),
        amount: 1200,
        breakdown: { Clubhouse: 100 },
        status: 'paid',
        method: 'upi',
        paymentReference: 'SV-DEMO-PAID-1',
        receiptNumber: 'RCP-2026-DEMO1',
        receiptIssuedAt: createdAt,
        paidAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        month: currentMonth,
        year: currentYear,
      },
    ],
    staffAttendance: [
      {
        id: 'attendance_demo_1',
        userId: guardId,
        name: 'Mahesh Kumar',
        role: 'guard',
        shift: 'morning',
        societyId,
        status: 'clocked_in',
        clockInAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        clockOutAt: null,
        notes: 'Gate A shift',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    notifications: [
      {
        id: 'notification_demo_1',
        userId: residentOneId,
        title: 'Visitor waiting at the gate',
        message: 'Rohan Mehta is waiting for approval at Flat A-101.',
        type: 'visitor-awaiting-approval',
        read: false,
        flat: 'A-101',
        societyId,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'notification_demo_2',
        userId: residentTwoId,
        title: 'Payment received',
        message: 'Your clubhouse amenity charge receipt is ready.',
        type: 'payment-receipt',
        read: true,
        societyId,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
};

const readFromStorage = () => {
  if (typeof window === 'undefined') {
    return stateCache || createSeedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const seed = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
};

const writeToStorage = (state) => {
  stateCache = state;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const ensureStorageListener = () => {
  if (storageListenerAttached || typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      stateCache = JSON.parse(event.newValue);
      notifyListeners();
    } catch {
      // Ignore malformed storage updates.
    }
  });
  storageListenerAttached = true;
};

export const getDemoState = () => {
  if (!stateCache) {
    stateCache = readFromStorage();
  }
  return stateCache;
};

export const setDemoState = (nextState) => {
  writeToStorage(nextState);
  notifyListeners();
};

export const mutateDemoState = (updater) => {
  const draft = clone(getDemoState());
  const result = updater(draft) || draft;
  setDemoState(result);
  return clone(result);
};

export const subscribeDemoState = (selector, callback) => {
  ensureStorageListener();
  const listener = () => callback(clone(selector(getDemoState())));
  listener();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetDemoState = () => {
  const seed = createSeedState();
  setDemoState(seed);
  return clone(seed);
};

export const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

export const findDemoUserById = (userId) => getDemoState().users.find((user) => user.id === userId) || null;

export const findDemoUserByIdentifier = (identifier) => {
  const normalized = String(identifier || '').trim().toLowerCase();
  return getDemoState().users.find((user) => user.email?.toLowerCase() === normalized || user.mobile === normalized) || null;
};

export const addDemoUser = (user) => mutateDemoState((state) => {
  state.users.push({
    id: createId('user'),
    cityId: DEFAULT_CITY_ID,
    societyId: DEFAULT_SOCIETY_ID,
    language: 'en',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...user,
  });
  return state;
});

export const getDemoAccounts = () => getDemoState().users.map((user) => ({
  role: user.role,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  password: DEMO_PASSWORD,
}));

export { DEFAULT_CITY_ID, DEFAULT_SOCIETY_ID, DEMO_PASSWORD, createId, nowIso, normalizeFlatValue };

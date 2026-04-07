import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_SOCIETY_ID,
  getSocietyCollectionRef,
  getSocietyDocRef,
  getSocietyId,
} from '../config/firestore';

const usersCollection = collection(db, 'users');
const notificationsCollection = collection(db, 'notifications');

const getVisitorsCollection = (context) => getSocietyCollectionRef('visitors', getSocietyId(context));
const getPaymentsCollection = (context) => getSocietyCollectionRef('payments', getSocietyId(context));
const getAnnouncementsCollection = (context) => getSocietyCollectionRef('announcements', getSocietyId(context));
const getComplaintsCollection = (context) => getSocietyCollectionRef('complaints', getSocietyId(context));
const getFacilityBookingsCollection = (context) => getSocietyCollectionRef('facilityBookings', getSocietyId(context));
const getStaffAttendanceCollection = (context) => getSocietyCollectionRef('staffAttendance', getSocietyId(context));
const getVisitorDoc = (visitorId, context) => getSocietyDocRef('visitors', visitorId, getSocietyId(context));
const getPaymentDoc = (paymentId, context) => getSocietyDocRef('payments', paymentId, getSocietyId(context));
const getAnnouncementDoc = (announcementId, context) => getSocietyDocRef('announcements', announcementId, getSocietyId(context));
const getComplaintDoc = (complaintId, context) => getSocietyDocRef('complaints', complaintId, getSocietyId(context));
const getFacilityBookingDoc = (bookingId, context) => getSocietyDocRef('facilityBookings', bookingId, getSocietyId(context));
const getStaffAttendanceDoc = (attendanceId, context) => getSocietyDocRef('staffAttendance', attendanceId, getSocietyId(context));
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://commune.soulvest.ai').replace(/\/$/, '');
const PASS_EXPIRY_GRACE_MS = 2 * 60 * 60 * 1000;

export const normalizeFlat = (flat) => flat?.trim().toUpperCase() || '';

const mapSnapshot = (snapshot) => snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));
const getComparableTime = (value) => {
  if (!value) return 0;
  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value?.toDate) return value.toDate().getTime();
  return 0;
};

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

const toMonthYear = (value) => {
  const date = toDateValue(value) || new Date();
  return {
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: date.getFullYear(),
  };
};

const getDerivedPaymentStatus = (payment) => {
  if (payment.status === 'paid') return 'paid';
  const dueDate = toDateValue(payment.dueDate);
  if (dueDate && dueDate.getTime() < Date.now()) return 'overdue';
  return payment.status === 'due' ? 'pending' : (payment.status || 'pending');
};

const getComplaintPriority = (description = '', category = '') => {
  const text = `${category} ${description}`.toLowerCase();
  if (/(fire|gas|security|lift|elevator|flood|electric shock|sparking)/.test(text)) return 'high';
  if (/(water|plumbing|electrical|maintenance|leak)/.test(text)) return 'medium';
  return 'low';
};

const createReceiptNumber = () => `RCP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const createBookingCode = () => `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const buildBookingDateTime = (dateValue, slot = '') => {
  const date = toDateValue(dateValue);
  if (!date) return null;

  const [startLabel = '06:00 AM'] = slot.split(' - ');
  const [timePart = '06:00', meridiem = 'AM'] = startLabel.trim().split(' ');
  const [rawHours = '6', rawMinutes = '0'] = timePart.split(':');
  let hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return date;
  }

  if (meridiem.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
};

export async function getUserProfileByUid(uid) {
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export async function upsertUserProfile(uid, data) {
  await setDoc(
    doc(db, 'users', uid),
    {
      ...data,
      flat: normalizeFlat(data.flat),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToResidents(callback) {
  const residentsQuery = query(usersCollection);
  return onSnapshot(residentsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot)
        .filter((resident) => resident.role !== 'guard' && resident.role !== 'admin')
        .filter((resident) => (resident.societyId || DEFAULT_SOCIETY_ID) === DEFAULT_SOCIETY_ID)
        .map((resident) => ({
          ...resident,
          flat: normalizeFlat(resident.flat) || 'UNASSIGNED',
        }))
        .sort((left, right) => `${left.flat}-${left.name || ''}`.localeCompare(`${right.flat}-${right.name || ''}`)),
    );
  });
}

export function subscribeToVisitors(callback, context = DEFAULT_SOCIETY_ID) {
  const visitorsQuery = query(getVisitorsCollection(context));
  return onSnapshot(visitorsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot)
        .map((visitor) => ({
          ...visitor,
          flat: normalizeFlat(visitor.flat),
        }))
        .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    );
  });
}

export function subscribeToAnnouncements(callback, context = DEFAULT_SOCIETY_ID) {
  const announcementsQuery = query(getAnnouncementsCollection(context));
  return onSnapshot(announcementsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => {
        if (Boolean(left.pinned) !== Boolean(right.pinned)) {
          return left.pinned ? -1 : 1;
        }
        return getComparableTime(right.createdAt || right.date) - getComparableTime(left.createdAt || left.date);
      }),
    );
  });
}

export function subscribeToComplaints(callback, filters = {}) {
  const complaintsQuery = filters.residentId
    ? query(getComplaintsCollection(filters.context), where('residentId', '==', filters.residentId))
    : query(getComplaintsCollection(filters.context));

  return onSnapshot(complaintsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => {
        const leftResolved = left.status === 'resolved';
        const rightResolved = right.status === 'resolved';
        if (leftResolved !== rightResolved) return leftResolved ? 1 : -1;
        return getComparableTime(right.createdAt) - getComparableTime(left.createdAt);
      }),
    );
  });
}

export function subscribeToResidentComplaints(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  return subscribeToComplaints(callback, { residentId: userId, context });
}

export function subscribeToFacilityBookings(callback, context = DEFAULT_SOCIETY_ID) {
  const bookingsQuery = query(getFacilityBookingsCollection(context));
  return onSnapshot(bookingsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(left.bookingDate) - getComparableTime(right.bookingDate)),
    );
  });
}

export function subscribeToResidentFacilityBookings(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  const bookingsQuery = query(getFacilityBookingsCollection(context), where('residentId', '==', userId));
  return onSnapshot(bookingsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(left.bookingDate) - getComparableTime(right.bookingDate)),
    );
  });
}

export function subscribeToStaffAttendance(callback, context = DEFAULT_SOCIETY_ID) {
  const attendanceQuery = query(getStaffAttendanceCollection(context));
  return onSnapshot(attendanceQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(right.clockInAt || right.createdAt) - getComparableTime(left.clockInAt || left.createdAt)),
    );
  });
}

export function subscribeToMyAttendance(userId, callback, context = DEFAULT_SOCIETY_ID) {
  if (!userId) return () => {};
  const attendanceQuery = query(getStaffAttendanceCollection(context), where('userId', '==', userId));
  return onSnapshot(attendanceQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(right.clockInAt || right.createdAt) - getComparableTime(left.clockInAt || left.createdAt)),
    );
  });
}

const createOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const createPassToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `SV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `SV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
};
const buildQrPayload = (passToken, otp) => JSON.stringify({ type: 'soulvest-pass', passToken, otp });
const getPassExpiryDate = (visitorOrPass) => {
  const explicitExpiry = toDateValue(visitorOrPass?.passExpiresAt);
  if (explicitExpiry) return explicitExpiry;

  const expectedAt = toDateValue(visitorOrPass?.expectedAt);
  if (!expectedAt) return null;

  return new Date(expectedAt.getTime() + PASS_EXPIRY_GRACE_MS);
};
const isPassExpired = (visitorOrPass) => {
  const expiryDate = getPassExpiryDate(visitorOrPass);
  return Boolean(expiryDate && expiryDate.getTime() < Date.now());
};
const isPassConsumed = (visitor) => Boolean(
  visitor?.passState === 'used'
  || visitor?.passInvalidationReason === 'verified'
  || visitor?.passUsedAt,
);

async function createNotification(notification) {
  await addDoc(notificationsCollection, {
    ...notification,
    societyId: notification.societyId || DEFAULT_SOCIETY_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    read: false,
  });

  if (notification.userId) {
    void fetch(`${API_BASE_URL}/notifications/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: notification.userId,
        societyId: notification.societyId || DEFAULT_SOCIETY_ID,
        title: notification.title,
        message: notification.message,
        channels: notification.channels || {},
        meta: {
          type: notification.type,
          visitorId: notification.visitorId,
          complaintId: notification.complaintId,
        },
      }),
    }).catch(() => {});
  }
}

const sortByCreatedDesc = (items) => items.sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt));

async function getResidentByFlat(flat) {
  const normalizedFlat = normalizeFlat(flat);
  if (!normalizedFlat) return null;

  const residentSnapshot = await getDocs(query(usersCollection, where('flat', '==', normalizedFlat)));
  if (residentSnapshot.empty) return null;

  const residentDoc = residentSnapshot.docs.find((snapshotDoc) => {
    const data = snapshotDoc.data();
    return data.role !== 'guard' && data.role !== 'admin';
  }) || residentSnapshot.docs[0];

  return {
    id: residentDoc.id,
    ...residentDoc.data(),
  };
}

function parseVerificationCode(code) {
  const cleaned = code.trim();
  if (!cleaned) return { otp: '', passToken: '' };

  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      return {
        otp: parsed.otp || '',
        passToken: parsed.passToken || '',
      };
    } catch {
      return { otp: cleaned, passToken: cleaned };
    }
  }

  return { otp: cleaned, passToken: cleaned };
}

export async function createVisitor(visitor) {
  const societyId = getSocietyId(visitor);
  const normalizedFlat = normalizeFlat(visitor.flat);
  const resident = await getResidentByFlat(normalizedFlat);

  const docRef = await addDoc(getVisitorsCollection(societyId), {
    ...visitor,
    societyId,
    flat: normalizedFlat,
    residentId: resident?.id || visitor.residentId || '',
    residentName: resident?.name || visitor.residentName || '',
    status: 'pending',
    history: [
      {
        type: 'pending',
        actor: visitor.loggedByName || 'Guard',
        at: new Date().toISOString(),
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (resident?.id) {
    await createNotification({
      userId: resident.id,
      type: 'visitor-awaiting-approval',
      title: 'Visitor waiting at the gate',
      message: `${visitor.name} is waiting for approval at Flat ${normalizedFlat}.`,
      visitorId: docRef.id,
      visitorName: visitor.name,
      flat: normalizedFlat,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: false,
        sms: false,
      },
    });
  }
}

export async function createVisitorPass(pass) {
  const societyId = getSocietyId(pass);
  const expectedAt = toDateValue(pass.expectedAt);
  if (!expectedAt) {
    throw new Error('Expected arrival time is invalid.');
  }
  if (expectedAt.getTime() < Date.now()) {
    throw new Error('Expected arrival time must be in the future.');
  }

  const otp = createOtp();
  const passToken = createPassToken();
  const qrPayload = buildQrPayload(passToken, otp);
  const passExpiresAt = getPassExpiryDate({ expectedAt: expectedAt.toISOString() })?.toISOString();

  const docRef = await addDoc(getVisitorsCollection(societyId), {
    visitorName: pass.visitorName,
    name: pass.visitorName,
    purpose: pass.purpose,
    phone: pass.phone || '',
    notes: pass.notes || '',
    societyId,
    flat: normalizeFlat(pass.flat),
    residentId: pass.residentId,
    residentName: pass.residentName,
    expectedAt: expectedAt.toISOString(),
    passExpiresAt,
    otp,
    passToken,
    qrPayload,
    passState: 'active',
    status: 'preapproved',
    entryMethod: 'resident-pass',
    history: [
      {
        type: 'preapproved',
        actor: pass.residentName || 'Resident',
        at: new Date().toISOString(),
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    userId: pass.residentId,
    type: 'visitor-pass-created',
    title: 'Visitor pass created',
    message: `OTP ${otp} is ready for ${pass.visitorName}.`,
    visitorId: docRef.id,
    visitorName: pass.visitorName,
    flat: normalizeFlat(pass.flat),
    societyId,
  });

  return {
    id: docRef.id,
    otp,
    passToken,
    qrPayload,
    passExpiresAt,
  };
}

export async function verifyVisitorPass(code, guardUser) {
  const societyId = getSocietyId(guardUser);
  const { otp, passToken } = parseVerificationCode(code);

  let snapshot = otp
    ? await getDocs(query(getVisitorsCollection(societyId), where('otp', '==', otp)))
    : await getDocs(query(getVisitorsCollection(societyId), where('passToken', '==', passToken)));

  if (snapshot.empty && passToken && passToken !== otp) {
    snapshot = await getDocs(query(getVisitorsCollection(societyId), where('passToken', '==', passToken)));
  }

  if (snapshot.empty) {
    throw new Error('No pre-approved visitor pass found for this OTP or QR payload.');
  }

  const visitorDoc = snapshot.docs[0];
  const visitor = { id: visitorDoc.id, ...visitorDoc.data() };

  if (isPassConsumed(visitor) || ['checked_in', 'checked_out'].includes(visitor.status)) {
    throw new Error('This visitor pass has already been used. Ask the resident to create a new pass if re-entry is needed.');
  }
  if (isPassExpired(visitor)) {
    await updateDoc(getVisitorDoc(visitor.id, societyId), {
      status: 'expired',
      passState: 'expired',
      passInvalidatedAt: serverTimestamp(),
      passInvalidationReason: 'expired',
      updatedAt: serverTimestamp(),
      history: arrayUnion({
        type: 'expired',
        actor: guardUser?.name || 'Guard',
        at: new Date().toISOString(),
      }),
    });

    throw new Error('This visitor pass has expired. Ask the resident to create a new pass.');
  }

  if (visitor.status !== 'preapproved') {
    throw new Error(`This visitor pass is currently marked as ${visitor.status}.`);
  }

  await updateDoc(getVisitorDoc(visitor.id, societyId), {
    status: 'checked_in',
    passState: 'used',
    passUsedAt: serverTimestamp(),
    passInvalidatedAt: serverTimestamp(),
    passInvalidationReason: 'verified',
    checkedInAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verifiedBy: {
      uid: guardUser?.uid || '',
      name: guardUser?.name || 'Guard',
    },
    history: arrayUnion({
      type: 'checked_in',
      actor: guardUser?.name || 'Guard',
      at: new Date().toISOString(),
    }),
  });

  if (visitor.residentId) {
    await createNotification({
      userId: visitor.residentId,
      type: 'visitor-entered',
      title: 'Visitor entered',
      message: `${visitor.name || visitor.visitorName} has entered Soulvest Commune.`,
      visitorId: visitor.id,
      visitorName: visitor.name || visitor.visitorName,
      flat: visitor.flat,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: true,
        sms: true,
      },
    });
  }

  return visitor;
}

export async function updateVisitorStatus(id, status, actor = {}) {
  const societyId = getSocietyId(actor);
  const visitorRef = getVisitorDoc(id, societyId);
  const visitorSnapshot = await getDoc(visitorRef);
  if (!visitorSnapshot.exists()) {
    throw new Error('Visitor record not found.');
  }

  const visitor = { id: visitorSnapshot.id, ...visitorSnapshot.data() };

  await updateDoc(visitorRef, {
    status,
    updatedAt: serverTimestamp(),
    history: arrayUnion({
      type: status,
      actor: actor.name || 'Resident',
      at: new Date().toISOString(),
    }),
  });

  if (visitor.residentId) {
    const title = status === 'approved' ? 'Visitor approved' : 'Visitor denied';
    const message = status === 'approved'
      ? `${visitor.name || visitor.visitorName} is approved and ready for check-in at the gate.`
      : `${visitor.name || visitor.visitorName} was denied entry.`;

    await createNotification({
      userId: visitor.residentId,
      type: `visitor-${status}`,
      title,
      message,
      visitorId: visitor.id,
      visitorName: visitor.name || visitor.visitorName,
      flat: visitor.flat,
      societyId,
    });
  }
}

export async function checkInVisitor(visitorId, guardUser) {
  const societyId = getSocietyId(guardUser);
  const visitorRef = getVisitorDoc(visitorId, societyId);
  const visitorSnapshot = await getDoc(visitorRef);
  if (!visitorSnapshot.exists()) {
    throw new Error('Visitor record not found.');
  }

  const visitor = { id: visitorSnapshot.id, ...visitorSnapshot.data() };
  if (!['approved', 'preapproved'].includes(visitor.status)) {
    throw new Error(`Only approved visitors can be checked in. Current status: ${visitor.status}.`);
  }
  if (visitor.status === 'preapproved' && isPassConsumed(visitor)) {
    throw new Error('This visitor pass has already been used. Ask the resident to create a new pass if re-entry is needed.');
  }
  if (visitor.status === 'preapproved' && isPassExpired(visitor)) {
    await updateDoc(visitorRef, {
      status: 'expired',
      passState: 'expired',
      passInvalidatedAt: serverTimestamp(),
      passInvalidationReason: 'expired',
      updatedAt: serverTimestamp(),
      history: arrayUnion({
        type: 'expired',
        actor: guardUser?.name || 'Guard',
        at: new Date().toISOString(),
      }),
    });

    throw new Error('This visitor pass has expired. Ask the resident to create a new pass.');
  }

  await updateDoc(visitorRef, {
    status: 'checked_in',
    checkedInAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(visitor.status === 'preapproved' ? {
      passState: 'used',
      passUsedAt: serverTimestamp(),
      passInvalidatedAt: serverTimestamp(),
      passInvalidationReason: 'verified',
    } : {}),
    verifiedBy: {
      uid: guardUser?.uid || '',
      name: guardUser?.name || 'Guard',
    },
    history: arrayUnion({
      type: 'checked_in',
      actor: guardUser?.name || 'Guard',
      at: new Date().toISOString(),
    }),
  });

  if (visitor.residentId) {
    await createNotification({
      userId: visitor.residentId,
      type: 'visitor-entered',
      title: 'Visitor entered',
      message: `${visitor.name || visitor.visitorName} has entered Soulvest Commune.`,
      visitorId: visitor.id,
      visitorName: visitor.name || visitor.visitorName,
      flat: visitor.flat,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: true,
        sms: true,
      },
    });
  }
}

export async function checkOutVisitor(visitorId, guardUser) {
  const societyId = getSocietyId(guardUser);
  const visitorRef = getVisitorDoc(visitorId, societyId);
  const visitorSnapshot = await getDoc(visitorRef);
  if (!visitorSnapshot.exists()) {
    throw new Error('Visitor record not found.');
  }

  const visitor = { id: visitorSnapshot.id, ...visitorSnapshot.data() };
  if (visitor.status !== 'checked_in') {
    throw new Error(`Only checked-in visitors can be checked out. Current status: ${visitor.status}.`);
  }

  await updateDoc(visitorRef, {
    status: 'checked_out',
    exitTime: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: arrayUnion({
      type: 'checked_out',
      actor: guardUser?.name || 'Guard',
      at: new Date().toISOString(),
    }),
  });

  if (visitor.residentId) {
    await createNotification({
      userId: visitor.residentId,
      type: 'visitor-exited',
      title: 'Visitor exited',
      message: `${visitor.name || visitor.visitorName} has exited Soulvest Commune.`,
      visitorId: visitor.id,
      visitorName: visitor.name || visitor.visitorName,
      flat: visitor.flat,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: true,
        sms: true,
      },
    });
  }
}

export async function createPaymentRecord(payment) {
  const societyId = getSocietyId(payment);
  const billingCycle = toMonthYear(payment.dueDate);
  await addDoc(getPaymentsCollection(societyId), {
    ...payment,
    societyId,
    flat: normalizeFlat(payment.flat),
    amount: Number(payment.amount || 0),
    month: payment.month || billingCycle.month,
    year: payment.year || billingCycle.year,
    status: payment.status === 'paid' ? 'paid' : (payment.status || 'pending'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function clockInStaff(actor = {}, extra = {}) {
  const societyId = getSocietyId(actor);
  if (!actor.uid) {
    throw new Error('Only signed-in staff can clock in.');
  }

  const openShiftSnapshot = await getDocs(
    query(getStaffAttendanceCollection(societyId), where('userId', '==', actor.uid), where('status', '==', 'clocked_in')),
  );

  if (!openShiftSnapshot.empty) {
    return { id: openShiftSnapshot.docs[0].id, ...openShiftSnapshot.docs[0].data() };
  }

  const docRef = await addDoc(getStaffAttendanceCollection(societyId), {
    userId: actor.uid,
    name: actor.name || 'Staff',
    role: actor.role || 'guard',
    shift: extra.shift || 'general',
    notes: extra.notes || '',
    societyId,
    status: 'clocked_in',
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: docRef.id, status: 'clocked_in' };
}

export async function clockOutStaff(attendanceId, actor = {}, extra = {}) {
  const societyId = getSocietyId(actor);
  const targetAttendanceId = attendanceId || null;

  let attendanceRef;
  if (targetAttendanceId) {
    attendanceRef = getStaffAttendanceDoc(targetAttendanceId, societyId);
  } else {
    const openShiftSnapshot = await getDocs(
      query(getStaffAttendanceCollection(societyId), where('userId', '==', actor.uid), where('status', '==', 'clocked_in')),
    );
    if (openShiftSnapshot.empty) {
      throw new Error('No active shift found to clock out.');
    }
    attendanceRef = getStaffAttendanceDoc(openShiftSnapshot.docs[0].id, societyId);
  }

  await updateDoc(attendanceRef, {
    status: 'clocked_out',
    clockOutAt: serverTimestamp(),
    notes: extra.notes || '',
    updatedAt: serverTimestamp(),
  });
}

export async function markPaymentAsPaid(paymentId, extra = {}) {
  await updateDoc(getPaymentDoc(paymentId, extra.societyId || DEFAULT_SOCIETY_ID), {
    status: 'paid',
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    receiptNumber: extra.receiptNumber || createReceiptNumber(),
    receiptIssuedAt: extra.receiptIssuedAt || new Date().toISOString(),
    paidAmount: Number(extra.paidAmount || extra.amount || 0),
    ...extra,
  });
}

export function subscribeToPayments(callback, context = DEFAULT_SOCIETY_ID) {
  const paymentsQuery = query(getPaymentsCollection(context));
  return onSnapshot(paymentsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot)
        .map((payment) => ({ ...payment, derivedStatus: getDerivedPaymentStatus(payment) }))
        .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    );
  });
}

export function subscribeToResidentPayments(userId, callback, context = DEFAULT_SOCIETY_ID) {
  const residentPaymentsQuery = query(getPaymentsCollection(context), where('userId', '==', userId));
  return onSnapshot(residentPaymentsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot)
        .map((payment) => ({ ...payment, derivedStatus: getDerivedPaymentStatus(payment) }))
        .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    );
  });
}

export async function seedResidentPaymentIfMissing(user) {
  if (!user?.uid) return;
  const now = new Date();
  const starterId = `starter-${user.uid}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const starterRef = getPaymentDoc(starterId, getSocietyId(user));
  const starterSnapshot = await getDoc(starterRef);
  if (starterSnapshot.exists()) return;

  await setDoc(starterRef, {
    userId: user.uid,
    residentName: user.name || 'Resident',
    flat: user.flat,
    societyId: getSocietyId(user),
    title: 'Monthly Maintenance',
    dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(),
    amount: 3500,
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: now.getFullYear(),
    breakdown: {
      Security: 40,
      Housekeeping: 25,
      Utilities: 20,
      Other: 15,
    },
    status: 'pending',
    method: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createAnnouncement(announcement) {
  const societyId = getSocietyId(announcement);
  await addDoc(getAnnouncementsCollection(societyId), {
    title: announcement.title,
    body: announcement.body,
    societyId,
    language: announcement.language || 'en',
    pinned: Boolean(announcement.pinned),
    postedBy: announcement.postedBy || null,
    aiGenerated: Boolean(announcement.aiGenerated),
    audience: announcement.audience || 'all',
    acknowledgements: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function acknowledgeAnnouncement(announcementId, user) {
  const announcementRef = getAnnouncementDoc(announcementId, getSocietyId(user));
  const announcementSnapshot = await getDoc(announcementRef);
  if (!announcementSnapshot.exists()) {
    throw new Error('Announcement not found.');
  }

  const announcement = announcementSnapshot.data();
  const acknowledgements = announcement.acknowledgements || [];
  if (acknowledgements.some((entry) => entry.userId === user?.uid)) {
    return;
  }

  await updateDoc(announcementRef, {
    acknowledgements: arrayUnion({
      userId: user?.uid || '',
      name: user?.name || 'Resident',
      at: new Date().toISOString(),
    }),
    updatedAt: serverTimestamp(),
  });
}

export async function createComplaint(complaint) {
  const societyId = getSocietyId(complaint);
  await addDoc(getComplaintsCollection(societyId), {
    residentId: complaint.residentId,
    residentName: complaint.residentName || 'Resident',
    societyId,
    flat: normalizeFlat(complaint.flat),
    category: complaint.category,
    description: complaint.description,
    status: 'open',
    aiPriority: complaint.aiPriority || getComplaintPriority(complaint.description, complaint.category),
    createdAt: serverTimestamp(),
    resolvedAt: null,
    updatedAt: serverTimestamp(),
    history: [
      {
        type: 'open',
        actor: complaint.residentName || 'Resident',
        at: new Date().toISOString(),
      },
    ],
  });
}

export async function updateComplaintStatus(complaintId, status, actor = {}, extra = {}) {
  const societyId = getSocietyId(actor);
  const complaintRef = getComplaintDoc(complaintId, societyId);
  const complaintSnapshot = await getDoc(complaintRef);
  if (!complaintSnapshot.exists()) {
    throw new Error('Complaint not found.');
  }

  const complaint = { id: complaintSnapshot.id, ...complaintSnapshot.data() };
  await updateDoc(complaintRef, {
    status,
    aiPriority: extra.aiPriority || complaint.aiPriority,
    adminNotes: extra.adminNotes || complaint.adminNotes || '',
    updatedAt: serverTimestamp(),
    resolvedAt: status === 'resolved' ? serverTimestamp() : complaint.resolvedAt || null,
    history: arrayUnion({
      type: status,
      actor: actor.name || 'Admin',
      at: new Date().toISOString(),
    }),
  });

  if (complaint.residentId) {
    await createNotification({
      userId: complaint.residentId,
      type: 'complaint-status-updated',
      title: 'Complaint status updated',
      message: `${complaint.category} complaint is now ${status.replace('_', ' ')}.`,
      complaintId,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: false,
        sms: false,
      },
    });
  }
}

export async function createFacilityBooking(booking) {
  const societyId = getSocietyId(booking);
  const bookingDate = buildBookingDateTime(booking.bookingDate, booking.slot);

  if (!bookingDate) {
    throw new Error('Booking date is invalid.');
  }
  if (bookingDate.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new Error('Choose a future date and time for the booking.');
  }

  const conflictSnapshot = await getDocs(
    query(getFacilityBookingsCollection(societyId), where('bookingDate', '==', bookingDate.toISOString())),
  );

  const hasConflict = conflictSnapshot.docs.some((snapshotDoc) => {
    const data = snapshotDoc.data();
    return data.amenity === booking.amenity && data.slot === booking.slot && data.status !== 'cancelled';
  });

  if (hasConflict) {
    throw new Error('That slot is already booked. Choose another amenity slot.');
  }

  const bookingCode = createBookingCode();
  const docRef = await addDoc(getFacilityBookingsCollection(societyId), {
    residentId: booking.residentId,
    residentName: booking.residentName || 'Resident',
    flat: normalizeFlat(booking.flat),
    societyId,
    amenity: booking.amenity,
    slot: booking.slot,
    guestCount: Number(booking.guestCount || 1),
    bookingDate: bookingDate.toISOString(),
    notes: booking.notes || '',
    bookingCode,
    status: 'confirmed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [
      {
        type: 'confirmed',
        actor: booking.residentName || 'Resident',
        at: new Date().toISOString(),
      },
    ],
  });

  await createNotification({
    userId: booking.residentId,
    type: 'facility-booking-confirmed',
    title: 'Amenity booking confirmed',
    message: `${booking.amenity} is booked for ${booking.slot} on ${bookingDate.toLocaleDateString()}.`,
    societyId,
    channels: {
      inApp: true,
      push: true,
      email: false,
      sms: false,
    },
  });

  return {
    id: docRef.id,
    bookingCode,
    bookingDate: bookingDate.toISOString(),
  };
}

export async function cancelFacilityBooking(bookingId, actor = {}) {
  const societyId = getSocietyId(actor);
  const bookingRef = getFacilityBookingDoc(bookingId, societyId);
  const bookingSnapshot = await getDoc(bookingRef);
  if (!bookingSnapshot.exists()) {
    throw new Error('Booking not found.');
  }

  const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
  if (booking.status === 'cancelled') {
    return;
  }

  await updateDoc(bookingRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
    history: arrayUnion({
      type: 'cancelled',
      actor: actor.name || 'Resident',
      at: new Date().toISOString(),
    }),
  });

  if (booking.residentId) {
    await createNotification({
      userId: booking.residentId,
      type: 'facility-booking-cancelled',
      title: 'Amenity booking cancelled',
      message: `${booking.amenity} booking for ${booking.slot} has been cancelled.`,
      societyId,
      channels: {
        inApp: true,
        push: true,
        email: false,
        sms: false,
      },
    });
  }
}

export async function seedDemoDayData({ adminUser, residents = [] } = {}) {
  const primaryResident = residents[0];
  if (!primaryResident) {
    throw new Error('Add at least one resident before seeding demo data.');
  }

  const monthLabel = String(new Date().getMonth() + 1).padStart(2, '0');
  const societyId = getSocietyId(adminUser || primaryResident);
  const announcementRef = getAnnouncementDoc('demo-water-shutdown', societyId);
  const complaintRef = getComplaintDoc(`demo-complaint-${primaryResident.id}`, societyId);
  const paymentRef = getPaymentDoc(`demo-charge-${primaryResident.id}-${new Date().getFullYear()}-${monthLabel}`, societyId);
  const pendingVisitorRef = getVisitorDoc(`demo-pending-visitor-${primaryResident.id}`, societyId);
  const completedVisitorRef = getVisitorDoc(`demo-completed-visitor-${primaryResident.id}`, societyId);

  await setDoc(announcementRef, {
    title: 'Water shutdown from 6 PM to 8 PM',
    body: 'Tank cleaning is scheduled this evening. Please store enough water for two hours.',
    societyId,
    language: 'en',
    pinned: true,
    postedBy: {
      uid: adminUser?.uid || '',
      name: adminUser?.name || 'Admin',
    },
    aiGenerated: false,
    audience: 'all',
    acknowledgements: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(complaintRef, {
    residentId: primaryResident.id,
    residentName: primaryResident.name || 'Resident',
    societyId,
    flat: normalizeFlat(primaryResident.flat),
    category: 'lift',
    description: 'Lift B makes a loud noise and stops briefly on floor 7.',
    status: 'inprogress',
    aiPriority: 'high',
    adminNotes: 'Vendor visit scheduled for 5 PM.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
    history: [
      { type: 'open', actor: primaryResident.name || 'Resident', at: new Date().toISOString() },
      { type: 'inprogress', actor: adminUser?.name || 'Admin', at: new Date().toISOString() },
    ],
  }, { merge: true });

  await setDoc(paymentRef, {
    userId: primaryResident.id,
    residentName: primaryResident.name || 'Resident',
    societyId,
    flat: normalizeFlat(primaryResident.flat),
    title: 'Monthly Maintenance',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 28).toISOString(),
    amount: 4200,
    month: monthLabel,
    year: new Date().getFullYear(),
    breakdown: {
      Security: 38,
      Housekeeping: 24,
      Utilities: 21,
      Other: 17,
    },
    status: 'pending',
    method: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(pendingVisitorRef, {
    name: 'Arjun Rao',
    visitorName: 'Arjun Rao',
    purpose: 'Guest visit',
    phone: '9876500101',
    flat: normalizeFlat(primaryResident.flat),
    residentId: primaryResident.id,
    residentName: primaryResident.name || 'Resident',
    societyId,
    otp: '654321',
    passToken: 'SV-DEMO123',
    qrPayload: buildQrPayload('SV-DEMO123', '654321'),
    expectedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    passExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    passState: 'active',
    status: 'preapproved',
    entryMethod: 'resident-pass',
    history: [
      { type: 'preapproved', actor: primaryResident.name || 'Resident', at: new Date().toISOString() },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(completedVisitorRef, {
    name: 'Meera Shah',
    visitorName: 'Meera Shah',
    purpose: 'Delivery',
    phone: '9876500102',
    flat: normalizeFlat(primaryResident.flat),
    residentId: primaryResident.id,
    residentName: primaryResident.name || 'Resident',
    societyId,
    status: 'checked_out',
    entryMethod: 'walk-in',
    checkedInAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    exitTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    history: [
      { type: 'pending', actor: 'Guard', at: new Date(Date.now() - 110 * 60 * 1000).toISOString() },
      { type: 'approved', actor: primaryResident.name || 'Resident', at: new Date(Date.now() - 100 * 60 * 1000).toISOString() },
      { type: 'checked_in', actor: 'Guard', at: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
      { type: 'checked_out', actor: 'Guard', at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await createNotification({
    userId: primaryResident.id,
    type: 'announcement-posted',
    title: 'New announcement posted',
    message: 'Water shutdown from 6 PM to 8 PM has been posted for residents.',
    societyId,
    channels: {
      inApp: true,
      push: true,
      email: false,
      sms: false,
    },
  });
}

export function subscribeToNotifications(userId, callback) {
  if (!userId) return () => {};
  const notificationsQuery = query(notificationsCollection, where('userId', '==', userId));
  return onSnapshot(notificationsQuery, (snapshot) => {
    callback(sortByCreatedDesc(mapSnapshot(snapshot)));
  });
}

export async function markNotificationAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}
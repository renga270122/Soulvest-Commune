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

const usersCollection = collection(db, 'users');
const visitorsCollection = collection(db, 'visitors');
const paymentsCollection = collection(db, 'payments');
const notificationsCollection = collection(db, 'notifications');

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
        .map((resident) => ({
          ...resident,
          flat: normalizeFlat(resident.flat) || 'UNASSIGNED',
        }))
        .sort((left, right) => `${left.flat}-${left.name || ''}`.localeCompare(`${right.flat}-${right.name || ''}`)),
    );
  });
}

export function subscribeToVisitors(callback) {
  const visitorsQuery = query(visitorsCollection);
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

const createOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const createPassToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `SV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `SV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
};
const buildQrPayload = (passToken, otp) => JSON.stringify({ type: 'soulvest-pass', passToken, otp });

async function createNotification(notification) {
  await addDoc(notificationsCollection, {
    ...notification,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    read: false,
  });
}

const sortByCreatedDesc = (items) => items.sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt));

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
  await addDoc(visitorsCollection, {
    ...visitor,
    flat: normalizeFlat(visitor.flat),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createVisitorPass(pass) {
  const otp = createOtp();
  const passToken = createPassToken();
  const qrPayload = buildQrPayload(passToken, otp);

  const docRef = await addDoc(visitorsCollection, {
    visitorName: pass.visitorName,
    name: pass.visitorName,
    purpose: pass.purpose,
    phone: pass.phone || '',
    vehicleNumber: pass.vehicleNumber || '',
    notes: pass.notes || '',
    flat: normalizeFlat(pass.flat),
    residentId: pass.residentId,
    residentName: pass.residentName,
    expectedAt: pass.expectedAt,
    otp,
    passToken,
    qrPayload,
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
  });

  return {
    id: docRef.id,
    otp,
    passToken,
    qrPayload,
  };
}

export async function verifyVisitorPass(code, guardUser) {
  const { otp, passToken } = parseVerificationCode(code);

  let snapshot = otp
    ? await getDocs(query(visitorsCollection, where('otp', '==', otp)))
    : await getDocs(query(visitorsCollection, where('passToken', '==', passToken)));

  if (snapshot.empty && passToken && passToken !== otp) {
    snapshot = await getDocs(query(visitorsCollection, where('passToken', '==', passToken)));
  }

  if (snapshot.empty) {
    throw new Error('No pre-approved visitor pass found for this OTP or QR payload.');
  }

  const visitorDoc = snapshot.docs[0];
  const visitor = { id: visitorDoc.id, ...visitorDoc.data() };

  if (visitor.status === 'checked_in') {
    throw new Error('This visitor has already been checked in.');
  }
  if (visitor.status !== 'preapproved') {
    throw new Error(`This visitor pass is currently marked as ${visitor.status}.`);
  }

  await updateDoc(doc(db, 'visitors', visitor.id), {
    status: 'checked_in',
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
    });
  }

  return visitor;
}

export async function updateVisitorStatus(id, status) {
  await updateDoc(doc(db, 'visitors', id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function createPaymentRecord(payment) {
  await addDoc(paymentsCollection, {
    ...payment,
    flat: normalizeFlat(payment.flat),
    amount: Number(payment.amount || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markPaymentAsPaid(paymentId, extra = {}) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'paid',
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
}

export function subscribeToPayments(callback) {
  const paymentsQuery = query(paymentsCollection);
  return onSnapshot(paymentsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    );
  });
}

export function subscribeToResidentPayments(userId, callback) {
  const residentPaymentsQuery = query(paymentsCollection, where('userId', '==', userId));
  return onSnapshot(residentPaymentsQuery, (snapshot) => {
    callback(
      mapSnapshot(snapshot).sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt)),
    );
  });
}

export async function seedResidentPaymentIfMissing(user) {
  if (!user?.uid) return;
  const now = new Date();
  const starterId = `starter-${user.uid}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const starterRef = doc(db, 'payments', starterId);
  const starterSnapshot = await getDoc(starterRef);
  if (starterSnapshot.exists()) return;

  await setDoc(starterRef, {
    userId: user.uid,
    residentName: user.name || 'Resident',
    flat: user.flat,
    title: 'Monthly Maintenance',
    dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(),
    amount: 3500,
    breakdown: {
      Security: 40,
      Housekeeping: 25,
      Utilities: 20,
      Other: 15,
    },
    status: 'due',
    method: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
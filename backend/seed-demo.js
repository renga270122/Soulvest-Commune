require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function resolveServiceAccountPath() {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const localPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  throw new Error('Service account key not found. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in backend/.');
}

function bootstrapFirebase() {
  if (getApps().length > 0) {
    return {
      auth: getAuth(),
      db: getFirestore(),
    };
  }

  const serviceAccount = require(resolveServiceAccountPath());
  initializeApp({
    credential: cert(serviceAccount),
  });

  return {
    auth: getAuth(),
    db: getFirestore(),
  };
}

const demoUsers = [
  {
    uid: 'demo-resident-rahul',
    email: 'rahul@example.com',
    password: 'Soulvest@123',
    displayName: 'Rahul Mehra',
    profile: {
      name: 'Rahul Mehra',
      email: 'rahul@example.com',
      mobile: '9876543210',
      flat: 'A-101',
      role: 'resident',
      createdAt: '2026-04-07T10:00:00.000Z',
    },
  },
  {
    uid: 'demo-resident-priya',
    email: 'priya@example.com',
    password: 'Soulvest@123',
    displayName: 'Priya Singh',
    profile: {
      name: 'Priya Singh',
      email: 'priya@example.com',
      mobile: '9876501234',
      flat: 'A-102',
      role: 'resident',
      createdAt: '2026-04-07T10:00:00.000Z',
    },
  },
  {
    uid: 'demo-resident-vikram',
    email: 'vikram@example.com',
    password: 'Soulvest@123',
    displayName: 'Vikram Iyer',
    profile: {
      name: 'Vikram Iyer',
      email: 'vikram@example.com',
      mobile: '9876505678',
      flat: 'B-201',
      role: 'resident',
      createdAt: '2026-04-07T10:00:00.000Z',
    },
  },
  {
    uid: 'demo-guard-suresh',
    email: 'guard@example.com',
    password: 'Soulvest@123',
    displayName: 'Suresh Kumar',
    profile: {
      name: 'Suresh Kumar',
      email: 'guard@example.com',
      mobile: '9876500001',
      flat: '',
      role: 'guard',
      createdAt: '2026-04-07T10:00:00.000Z',
    },
  },
  {
    uid: 'demo-admin-anita',
    email: 'admin@example.com',
    password: 'Soulvest@123',
    displayName: 'Anita Rao',
    profile: {
      name: 'Anita Rao',
      email: 'admin@example.com',
      mobile: '9876500002',
      flat: '',
      role: 'admin',
      createdAt: '2026-04-07T10:00:00.000Z',
    },
  },
];

const demoVisitors = [
  {
    id: 'demo-pass-rahul-guest',
    visitorName: 'John Thomas',
    name: 'John Thomas',
    purpose: 'Family Guest',
    phone: '9888800011',
    vehicleNumber: 'KA01AB1234',
    notes: 'Evening dinner visit',
    flat: 'A-101',
    residentId: 'demo-resident-rahul',
    residentName: 'Rahul Mehra',
    expectedAt: '2026-04-07T19:15',
    otp: '246810',
    passToken: 'SV-DEMO01',
    qrPayload: JSON.stringify({ type: 'soulvest-pass', passToken: 'SV-DEMO01', otp: '246810' }),
    status: 'preapproved',
    entryMethod: 'resident-pass',
    history: [
      { type: 'preapproved', actor: 'Rahul Mehra', at: '2026-04-07T12:00:00.000Z' },
    ],
    createdAt: '2026-04-07T12:00:00.000Z',
    updatedAt: '2026-04-07T12:00:00.000Z',
  },
  {
    id: 'demo-checkedin-delivery',
    visitorName: 'Amazon Delivery',
    name: 'Amazon Delivery',
    purpose: 'Delivery',
    phone: '9888800022',
    vehicleNumber: '',
    notes: 'Parcel drop',
    flat: 'A-102',
    residentId: 'demo-resident-priya',
    residentName: 'Priya Singh',
    expectedAt: '2026-04-07T17:45',
    otp: '135790',
    passToken: 'SV-DEMO02',
    qrPayload: JSON.stringify({ type: 'soulvest-pass', passToken: 'SV-DEMO02', otp: '135790' }),
    status: 'checked_in',
    entryMethod: 'resident-pass',
    verifiedBy: { uid: 'demo-guard-suresh', name: 'Suresh Kumar' },
    checkedInAt: '2026-04-07T17:48:00.000Z',
    history: [
      { type: 'preapproved', actor: 'Priya Singh', at: '2026-04-07T16:30:00.000Z' },
      { type: 'checked_in', actor: 'Suresh Kumar', at: '2026-04-07T17:48:00.000Z' },
    ],
    createdAt: '2026-04-07T16:30:00.000Z',
    updatedAt: '2026-04-07T17:48:00.000Z',
  },
];

const demoPayments = [
  {
    id: 'starter-demo-resident-rahul-2026-04',
    userId: 'demo-resident-rahul',
    residentName: 'Rahul Mehra',
    flat: 'A-101',
    title: 'Monthly Maintenance',
    dueDate: '2026-04-28T00:00:00.000Z',
    amount: 3500,
    breakdown: {
      Security: 40,
      Housekeeping: 25,
      Utilities: 20,
      Other: 15,
    },
    status: 'due',
    method: 'manual',
    createdAt: '2026-04-07T12:00:00.000Z',
    updatedAt: '2026-04-07T12:00:00.000Z',
  },
  {
    id: 'starter-demo-resident-priya-2026-04',
    userId: 'demo-resident-priya',
    residentName: 'Priya Singh',
    flat: 'A-102',
    title: 'Monthly Maintenance',
    dueDate: '2026-04-28T00:00:00.000Z',
    amount: 3500,
    breakdown: {
      Security: 40,
      Housekeeping: 25,
      Utilities: 20,
      Other: 15,
    },
    status: 'paid',
    method: 'upi',
    paymentReference: 'SV-DEMO-PAY-001',
    paidAt: '2026-04-07T09:00:00.000Z',
    createdAt: '2026-04-07T08:00:00.000Z',
    updatedAt: '2026-04-07T09:00:00.000Z',
  },
];

const demoNotifications = [
  {
    id: 'demo-notification-pass-created',
    userId: 'demo-resident-rahul',
    type: 'visitor-pass-created',
    title: 'Visitor pass created',
    message: 'OTP 246810 is ready for John Thomas.',
    visitorId: 'demo-pass-rahul-guest',
    visitorName: 'John Thomas',
    flat: 'A-101',
    read: false,
    createdAt: '2026-04-07T12:01:00.000Z',
    updatedAt: '2026-04-07T12:01:00.000Z',
  },
  {
    id: 'demo-notification-visitor-entered',
    userId: 'demo-resident-priya',
    type: 'visitor-entered',
    title: 'Visitor entered',
    message: 'Amazon Delivery has entered Soulvest Commune.',
    visitorId: 'demo-checkedin-delivery',
    visitorName: 'Amazon Delivery',
    flat: 'A-102',
    read: false,
    createdAt: '2026-04-07T17:48:30.000Z',
    updatedAt: '2026-04-07T17:48:30.000Z',
  },
];

const demoAnnouncements = [
  {
    id: 'demo-announcement-1',
    title: 'Water Tank Cleaning Tomorrow',
    content: 'Please store water by 8 AM. Supply will be restored by 2 PM.',
    date: '2026-04-08T08:00:00.000Z',
  },
  {
    id: 'demo-announcement-2',
    title: 'Committee Demo Evening',
    content: 'Join the product walkthrough in the clubhouse at 7 PM.',
    date: '2026-04-09T19:00:00.000Z',
  },
];

async function upsertAuthUser(auth, user) {
  try {
    await auth.getUser(user.uid);
    await auth.updateUser(user.uid, {
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });
    console.log(`Updated auth user: ${user.email}`);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }

    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });
    console.log(`Created auth user: ${user.email}`);
  }
}

async function upsertDocs(db, collectionName, docs) {
  for (const entry of docs) {
    const { id, ...data } = entry;
    await db.collection(collectionName).doc(id).set(data, { merge: true });
  }
  console.log(`Seeded ${docs.length} document(s) in ${collectionName}`);
}

async function seed() {
  const { auth, db } = bootstrapFirebase();

  for (const user of demoUsers) {
    await upsertAuthUser(auth, user);
    await db.collection('users').doc(user.uid).set({
      ...user.profile,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  console.log(`Seeded ${demoUsers.length} user profile document(s)`);

  await upsertDocs(db, 'visitors', demoVisitors);
  await upsertDocs(db, 'payments', demoPayments);
  await upsertDocs(db, 'notifications', demoNotifications);
  await upsertDocs(db, 'announcements', demoAnnouncements);

  console.log('\nDemo data is ready.');
  console.log('Resident login: rahul@example.com / Soulvest@123');
  console.log('Guard login: guard@example.com / Soulvest@123');
  console.log('Admin login: admin@example.com / Soulvest@123');
  console.log('Resident OTP for pass verification: 246810');
}

seed().catch((error) => {
  console.error('Failed to seed demo data.');
  console.error(error);
  process.exit(1);
});

// backend/firebase.js

// Load environment variables from .env file
require('dotenv').config();

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let cachedDb = null;
let firebaseStatus = {
  configured: false,
  source: null,
  message: 'Firebase Admin SDK is not configured.',
};

function normalizeServiceAccount(serviceAccount) {
  if (!serviceAccount || typeof serviceAccount !== 'object') {
    return serviceAccount;
  }

  if (typeof serviceAccount.private_key === 'string') {
    return {
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, '\n'),
    };
  }

  return serviceAccount;
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return {
        serviceAccount: normalizeServiceAccount(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
        source: 'FIREBASE_SERVICE_ACCOUNT_JSON',
      };
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS before starting the backend.');
  }

  return {
    serviceAccount: normalizeServiceAccount(require(serviceAccountPath)),
    source: 'GOOGLE_APPLICATION_CREDENTIALS',
  };
}

function initializeFirebase() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const { serviceAccount, source } = loadServiceAccount();

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    cachedDb = getFirestore();
    firebaseStatus = {
      configured: true,
      source,
      message: `Firebase Admin SDK initialized using ${source}.`,
    };

    return cachedDb;
  } catch (error) {
    firebaseStatus = {
      configured: false,
      source: null,
      message: error.message,
    };

    return null;
  }
}

function getDb() {
  const db = initializeFirebase();

  if (!db) {
    throw new Error(firebaseStatus.message);
  }

  return db;
}

function getFirebaseStatus() {
  initializeFirebase();
  return { ...firebaseStatus };
}

function getAdminAuth() {
  initializeFirebase();
  if (!firebaseStatus.configured || getApps().length === 0) {
    return null;
  }

  return getAuth();
}

initializeFirebase();

module.exports = {
  getAdminAuth,
  getDb,
  getFirebaseStatus,
};

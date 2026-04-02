// backend/firebase.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK with service account
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

module.exports = db;

// backend/firebase.js

// Load environment variables from .env file
require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin SDK with service account
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

module.exports = db;

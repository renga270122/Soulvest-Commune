import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBenvU6DwDorFD_sNsHLZy-aSF61J__-5g',
  authDomain: 'commune.soulvest.ai',
  projectId: 'soulvest-commune',
  storageBucket: 'soulvest-commune.firebasestorage.app',
  messagingSenderId: '144429501800',
  appId: '1:144429501800:web:58ad289db0ccc7d2135add',
  measurementId: 'G-C5R9PLLE9B',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
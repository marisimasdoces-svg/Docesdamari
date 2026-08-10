import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc, runTransaction } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyB12fYf5owS9E-WfC73Uqm5-LMRBag2IDc",
  authDomain: "docesdamari-e34b7.firebaseapp.com",
  databaseURL: "https://docesdamari-e34b7-default-rtdb.firebaseio.com",
  projectId: "docesdamari-e34b7",
  storageBucket: "docesdamari-e34b7.firebasestorage.app",
  messagingSenderId: "1047725000335",
  appId: "1:1047725000335:web:f12af0a0fa97f3d00592fa",
  measurementId: "G-LFX1YR8LSM"
};

// Initialize Firebase App
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Firestore document reference for storing the full application state
export const APP_STATE_DOC_REF = doc(db, 'app_data', 'main');

export { doc, onSnapshot, setDoc, getDoc, runTransaction };

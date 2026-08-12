import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  runTransaction,
  deleteField,
  waitForPendingWrites,
} from 'firebase/firestore';

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

// Firebase Authentication is the gate used by the permanent Firestore rules.
// Passwords are never stored in the application bundle.
export const auth = getAuth(app);

export async function signInToFirebase(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(auth);
}

export async function waitForFirebaseAuth() {
  await auth.authStateReady();
  return auth.currentUser;
}

// Initialize Firestore Database with persistent multi-tab offline cache and ignoreUndefinedProperties
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

// Firestore document reference for the legacy single-document backup.
// A document path must always contain collection/document pairs.
export const APP_STATE_DOC_REF = doc(db, 'app_data', 'main');

export {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  runTransaction,
  deleteField,
  waitForPendingWrites,
};

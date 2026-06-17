import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let _app:  FirebaseApp | null = null;
let _auth: Auth        | null = null;

export async function initFirebase(): Promise<Auth | null> {
  if (_auth) return _auth;
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
    const data = (await res.json()) as { firebase: FirebaseConfig };
    _app  = initializeApp(data.firebase);
    _auth = getAuth(_app);
    return _auth;
  } catch (e) {
    console.error('[Firebase] Init failed:', e);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  return _auth;
}

const _provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const auth = await initFirebase();
  if (!auth) throw new Error('Firebase non disponibile');
  const result = await signInWithPopup(auth, _provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (!_auth) return;
  await firebaseSignOut(_auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): Unsubscribe | (() => void) {
  if (!_auth) return () => {};
  return firebaseOnAuthStateChanged(_auth, callback);
}

export type { User };

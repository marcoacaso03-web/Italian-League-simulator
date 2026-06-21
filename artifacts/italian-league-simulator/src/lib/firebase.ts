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
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '',
};

let _app:  FirebaseApp | null = null;
let _auth: Auth        | null = null;
let _db:   Firestore   | null = null;

function getApp(): FirebaseApp {
  if (!_app) _app = initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

const _provider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const result = await signInWithPopup(auth, _provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): Unsubscribe {
  return firebaseOnAuthStateChanged(getFirebaseAuth(), callback);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const db = getDb();
  const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((doc, i) => ({ id: i + 1, ...doc.data() } as LeaderboardEntry));
}

export async function addLeaderboardEntry(data: {
  nickname: string;
  uid?: string | null;
  score: number;
  overall: number;
  points: number;
  position: number;
  formation: string;
  difficulty: string;
  show_ratings: string;
  era_from: number;
  era_to: number;
}): Promise<void> {
  const db = getDb();
  await addDoc(collection(db, 'leaderboard'), data);
}

export type { User };

export interface LeaderboardEntry {
  id: number;
  nickname: string;
  score: number;
  overall: number;
  points: number;
  position: number;
  formation: string;
  difficulty: string;
  show_ratings: string;
  era_from: number;
  era_to: number;
  uid?: string | null;
  created_at?: string;
}

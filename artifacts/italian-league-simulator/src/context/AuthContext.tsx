import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithGoogle, signOut, type User } from '../lib/firebase';

interface AuthContextValue {
  user:          User | null;
  loading:       boolean;
  firebaseReady: boolean;
  signIn:        () => Promise<void>;
  logOut:        () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:          null,
  loading:       true,
  firebaseReady: false,
  signIn:        async () => {},
  logOut:        async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,          setUser]          = useState<User | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    // Check if Firebase is configured before subscribing
    const apiKey = import.meta.env.FIREBASE_API_KEY ?? import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn('[Auth] VITE_FIREBASE_API_KEY not set — auth disabled');
      setLoading(false);
      setFirebaseReady(false);
      return;
    }

    setFirebaseReady(true);
    const unsub = onAuthStateChanged((u: User | null) => {
      setUser(u);
      setLoading(false);
    });

    return () => { unsub(); };
  }, []);

  async function signIn() {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('[Auth] signIn failed:', e);
    }
  }

  async function logOut() {
    await signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, firebaseReady, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initFirebase, onAuthStateChanged, signInWithGoogle, signOut, type User } from '../lib/firebase';

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
    let unsubscribe: (() => void) | undefined;

    initFirebase().then((auth) => {
      if (!auth) {
        setFirebaseReady(false);
        setLoading(false);
        return;
      }
      setFirebaseReady(true);
      const unsub = onAuthStateChanged((u) => {
        setUser(u);
        setLoading(false);
      });
      unsubscribe = typeof unsub === 'function' ? unsub : () => {};
    });

    return () => { unsubscribe?.(); };
  }, []);

  async function signIn() {
    try { await signInWithGoogle(); } catch (e) { console.error(e); }
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

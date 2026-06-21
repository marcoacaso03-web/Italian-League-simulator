import React, { createContext, useContext } from 'react';

interface AuthContextValue {
  user:    null;
  loading: boolean;
  signIn:  () => Promise<void>;
  logOut:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:    null,
  loading: false,
  signIn:  async () => {},
  logOut:  async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{
      user: null,
      loading: false,
      signIn: async () => {},
      logOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

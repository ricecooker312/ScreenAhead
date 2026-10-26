import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, restoreSession, tokenStore } from '../api/client';
import { User } from '../api/types';

interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    tokenStore.onExpired(() => void clear());
    (async () => {
      try {
        if (await restoreSession()) setUser(await api.get<User>('/api/users/me'));
      } catch {
        await clear();
      } finally {
        setLoading(false);
      }
    })();
  }, [clear]);

  const startSession = async (s: Session) => {
    tokenStore.setAccess(s.accessToken);
    await tokenStore.setRefresh(s.refreshToken);
    setUser(s.user);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => startSession(await api.publicPost<Session>('/api/auth/login', { email, password })),
      register: async (payload) => startSession(await api.publicPost<Session>('/api/auth/register', payload)),
      signOut: async () => {
        const refreshToken = await tokenStore.getRefresh();
        await api.post('/api/auth/logout', refreshToken ? { refreshToken } : {}).catch(() => undefined);
        await clear();
      },
      refreshUser: async () => setUser(await api.get<User>('/api/users/me')),
      setUser,
    }),
    [user, loading, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

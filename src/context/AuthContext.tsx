import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { User } from '../types';
import { apiService } from '../services/api';

interface AuthContextValue {
  initialized: boolean;
  isAuthenticated: boolean;
  user: User | null;
  login: (nextUser: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const readStoredUser = (): User | null => {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    clearStoredSession();
    return null;
  }
};

const cleanupInjectedWalletConflicts = () => {
  if (typeof window === 'undefined') return;

  const hasPhantomConflict =
    window.location.href.includes('evmPhantom') ||
    document.querySelector('script[src*="evmPhantom"]') ||
    window.console?.error?.toString().includes('evmPhantom');

  if (!hasPhantomConflict) return;

  try {
    delete (window as Window & { ethereum?: unknown }).ethereum;
    delete (window as Window & { phantom?: unknown }).phantom;
  } catch {
    // ignore cleanup errors
  }
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    cleanupInjectedWalletConflicts();

    const token = localStorage.getItem('token');
    const storedUser = readStoredUser();

    if (token && storedUser) {
      setUser(storedUser);
    } else if (!token) {
      clearStoredSession();
    }

    setInitialized(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      isAuthenticated: Boolean(user),
      user,
      login: (nextUser) => {
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
      },
      logout: () => {
        apiService.logout();
        setUser(null);
      },
    }),
    [initialized, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  googleId?: string;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: UserSession = {
  id: 'usr_demo_reachinbox_001',
  name: 'Oliver Brown',
  email: 'oliver.brown@domain.io',
  avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
  googleId: 'google_demo_123456',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Check if user credentials exist in the URL query parameter (from Google OAuth callback redirect)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUser = urlParams.get('user');
      if (urlUser) {
        try {
          const loggedInUser = JSON.parse(atob(urlUser));
          setUser(loggedInUser);
          sessionStorage.setItem('outbox_user_session', JSON.stringify(loggedInUser));
          // Clean the URL query params so they aren't bookmarked
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsLoading(false);
          router.push('/dashboard');
          return;
        } catch (err) {
          console.error('[Auth] Failed to decode user from query params:', err);
        }
      }
    }

    // 2. Check if user session exists in sessionStorage
    const savedUser = sessionStorage.getItem('outbox_user_session');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
        router.push('/login');
      }
    } else {
      // Force redirect to login page (no dummy user fallback!)
      setUser(null);
      // Only redirect if not already on the login page to avoid redirect loops
      if (window.location.pathname !== '/login') {
        router.push('/login');
      }
    }
    setIsLoading(false);
  }, [router]);

  const loginWithGoogle = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    // Redirect browser to backend Google login route which initiates the real flow
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('outbox_user_session');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

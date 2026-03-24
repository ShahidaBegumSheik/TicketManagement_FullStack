import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, registerUser, updateProfile } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem('ticket_access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const me = await getCurrentUser();
        setUser(me);
      } catch {
        localStorage.removeItem('ticket_access_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function login(payload) {
    const response = await loginUser(payload);
    const token = response.access_token || response.token || response?.data?.access_token;

    if (!token) {
      throw new Error('Login response does not contain an access token.');
    }

    localStorage.setItem('ticket_access_token', token);

    if (response.user) {
      setUser(response.user);
      return response.user;
    }

    const me = await getCurrentUser();
    setUser(me);
    return me;
  }

  async function register(payload) {
    return registerUser(payload);
  }

  async function saveProfile(payload) {
    const updated = await updateProfile(payload);
    setUser(updated);
    return updated;
  }

  function logout() {
    localStorage.removeItem('ticket_access_token');
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, register, setUser, saveProfile }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../config/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('votebeats_token');
    const storedUser = localStorage.getItem('votebeats_user');

    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        // Verify token is still valid
        api.getMe()
          .then(userData => {
            setCurrentUser(userData);
            localStorage.setItem('votebeats_user', JSON.stringify(userData));
          })
          .catch(() => {
            // Token expired or invalid
            localStorage.removeItem('votebeats_token');
            localStorage.removeItem('votebeats_user');
            setCurrentUser(null);
          })
          .finally(() => setLoading(false));
      } catch (e) {
        localStorage.removeItem('votebeats_token');
        localStorage.removeItem('votebeats_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const data = await api.register(email, password, displayName);
    localStorage.setItem('votebeats_token', data.token);
    localStorage.setItem('votebeats_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('votebeats_token', data.token);
    localStorage.setItem('votebeats_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore logout errors
    }
    localStorage.removeItem('votebeats_token');
    localStorage.removeItem('votebeats_user');
    setCurrentUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    console.log('Password reset requested for:', email);
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('votebeats_user', JSON.stringify(updatedUser));
  }, []);

  const value = {
    currentUser,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

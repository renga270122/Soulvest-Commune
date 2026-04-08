import React, { useEffect, useState } from 'react';
import i18n, { resolveSupportedLanguage } from '../i18n';
import { AuthContext } from './auth-context';

const STORAGE_KEY = 'soulvest_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    const nextLanguage = resolveSupportedLanguage(user?.language) || resolveSupportedLanguage(localStorage.getItem('soulvest_language')) || 'en';
    if (i18n.language !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [user?.language]);

  const login = (nextUser) => setUser(nextUser);
  const updateUser = (updates) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...updates } : currentUser));
  };
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

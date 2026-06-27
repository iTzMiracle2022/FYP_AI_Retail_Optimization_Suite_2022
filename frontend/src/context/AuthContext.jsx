import React, { createContext, useState, useContext, useEffect } from 'react';
import { useApp } from './AppContext';
import API from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const appState = useApp();

  useEffect(() => {
    // Check for saved session in sessionStorage on load (cleared when browser closes)
    const savedUser = sessionStorage.getItem('retail_ai_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem('retail_ai_user', JSON.stringify(userData));
  };

  const logout = () => {
    // Capture user details first for logging
    const currentUser = user || JSON.parse(sessionStorage.getItem('retail_ai_user') || '{}');

    setUser(null);
    sessionStorage.removeItem('retail_ai_user');
    
    // Call backend API to clear the secure HTTP-Only cookie, passing headers if available
    const headers = {};
    if (currentUser.email) headers['X-User-Email'] = currentUser.email;
    if (currentUser.role) headers['X-User-Role'] = currentUser.role;

    API.post('/users/logout', {}, { headers }).catch(() => {});
    
    // Clear all AI module states to prevent cross-account leakage
    if (appState) {
      appState.setMarketingState({ results: null, selected: '', clusters: 'auto' });
      appState.setChurnState({ results: null, selectedDataset: '' });
      appState.setInventoryState({ results: null, selected: '', forecastDays: 7 });
      appState.setSalesState({ results: null, selectedDs: '', timePeriod: 'all', category: 'all', categories: [] });
    }
  };

  // Automatic Inactivity Timeout (Idle Logout after 15 minutes)
  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('Session expired due to user inactivity.');
        logout();
      }, 15 * 60 * 1000); // 15 minutes
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Initialize timer on mount or user change
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

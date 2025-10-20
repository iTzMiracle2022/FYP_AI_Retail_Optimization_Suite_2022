import React, { createContext, useState, useContext, useEffect } from 'react';
import { useApp } from './AppContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const appState = useApp();

  useEffect(() => {
    // Check for saved session on load
    const savedUser = localStorage.getItem('retail_ai_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('retail_ai_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('retail_ai_user');
    
    // Clear all AI module states to prevent cross-account leakage
    if (appState) {
      appState.setMarketingState({ results: null, selected: '', clusters: 'auto' });
      appState.setChurnState({ results: null, selectedDataset: '' });
      appState.setInventoryState({ results: null, selected: '', forecastDays: 7 });
      appState.setSalesState({ results: null, selectedDs: '', timePeriod: 'all', category: 'all', categories: [] });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

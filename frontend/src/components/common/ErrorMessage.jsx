import React from 'react';
import { AlertCircle } from 'lucide-react';

const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return (
    <div style={{
      backgroundColor: '#fee2e2',
      borderLeft: '4px solid #ef4444',
      padding: '1rem 1.5rem',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#991b1b',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      marginBottom: '1.5rem'
    }}>
      <AlertCircle size={20} />
      <span style={{ fontWeight: 500 }}>{message}</span>
    </div>
  );
};

export default ErrorMessage;

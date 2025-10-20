import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
      minHeight: '50vh', padding: '2rem', flex: 1, width: '100%'
    }}>
      <div style={{
        width: '40px', height: '40px', border: '3px solid #E5E7EB',
        borderTop: '3px solid #2563EB', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ marginTop: '1rem', color: '#64748B', fontWeight: 500, fontSize: '0.875rem' }}>{message}</p>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;

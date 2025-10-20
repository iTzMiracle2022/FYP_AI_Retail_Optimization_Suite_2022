import React from 'react';
import { UploadCloud, Database, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EmptyState = ({ moduleName }) => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      textAlign: 'center', padding: '4rem 2rem', display: 'flex', 
      flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
      marginTop: '1rem', background: 'white', borderRadius: '24px',
      border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(15, 23, 42, 0.04)'
    }}>
      <div style={{ 
        width: 72, height: 72, borderRadius: '20px', 
        background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#2563EB'
      }}>
        <Database size={32} />
      </div>
      
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>
          No Data Available for {moduleName}
        </h2>
        <p style={{ color: '#64748B', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6, fontSize: '0.875rem' }}>
          Upload a CSV dataset or connect your database to start using the AI analytics suite.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => navigate('/upload')} className="cta-button" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={18} /> Upload Dataset
        </button>
        {/* <button onClick={() => navigate('/admin/connectors')} className="secondary-button">
          Admin Connectors
        </button> */}
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '0.75rem' }}>
        <AlertCircle size={13} />
        <span>Connected data sources will appear automatically.</span>
      </div>
    </div>
  );
};

export default EmptyState;

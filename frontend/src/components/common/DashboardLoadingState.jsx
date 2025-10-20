import React from 'react';

const DashboardLoadingState = ({ 
  title = "Analyzing Data", 
  subtitle = "Please wait while we process your data.",
  statusText = "Calculating..."
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div className="premium-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '16px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #BFDBFE', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'dashboardSpin 1s linear infinite' }} />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{subtitle}</p>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{statusText}</p>
      </div>
      <style>{`
        @keyframes dashboardSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DashboardLoadingState;

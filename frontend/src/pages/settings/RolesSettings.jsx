import React from 'react';
import Navbar from '../../components/common/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const RolesSettings = () => {
  const { user } = useAuth();
  const role = user?.role || 'ANALYST';

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Role & Permissions" subtitle="View your current role and access level." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#2563EB" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Current Role</h4>
              <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Your active authorization level on the platform.</p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ 
                background: 'var(--primary-bg)', color: 'var(--primary)', 
                padding: '6px 12px', borderRadius: '6px', 
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.5px' 
              }}>
                {role.toUpperCase()}
              </span>
              <p style={{ marginTop: '12px', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                You have {role === 'System Admin' ? 'full administrative access' : 'standard analyst access'} to the platform features and AI modules.
              </p>
            </div>
            <CheckCircle size={32} color="#10B981" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesSettings;

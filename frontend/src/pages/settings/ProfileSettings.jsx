import React from 'react';
import Navbar from '../../components/common/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ProfileSettings = () => {
  const { user } = useAuth();
  const fullName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Profile Settings" subtitle="Manage your name, email, and contact info." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>
              {initial}
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Personal Info</h3>
              <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Update your photo and personal details here.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Full Name</label>
              <input type="text" defaultValue={fullName} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Email Address</label>
              <input type="email" defaultValue={user?.email || ''} disabled style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', cursor: 'not-allowed' }} />
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="cta-button" style={{ padding: '0.7rem 1.5rem', fontSize: '0.85rem' }}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;

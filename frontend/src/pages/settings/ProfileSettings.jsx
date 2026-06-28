import React, { useState } from 'react';
import Navbar from '../../components/common/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import API from '../../api';

const ProfileSettings = () => {
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.name || (user?.email ? user.email.split('@')[0] : ''));
  const [statusMsg, setStatusMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  const handleSave = async () => {
    if (!name.trim()) {
      setStatusMsg({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await API.post('/users/profile', { email: user.email, name: name.trim() });
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Profile name updated successfully!' });
        login({ ...user, name: name.trim() });
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'An error occurred while updating profile.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Profile Settings" subtitle="Manage your name, email, and contact info." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>

        {statusMsg && (
          <div style={{ 
            padding: '0.75rem', 
            borderRadius: '8px', 
            background: statusMsg.type === 'success' ? 'rgba(10, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: statusMsg.type === 'success' ? '#10b981' : '#f87171',
            marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'
          }}>
            {statusMsg.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
            {statusMsg.text}
          </div>
        )}

        <div style={{
          padding: '1.75rem', borderRadius: '24px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
          transition: 'border-color 0.2s'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#000000';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
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
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Email Address</label>
              <input type="email" value={user?.email || ''} disabled style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-light)', cursor: 'not-allowed' }} />
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={loading} className="cta-button" style={{ padding: '0.7rem 1.5rem', fontSize: '0.85rem' }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;

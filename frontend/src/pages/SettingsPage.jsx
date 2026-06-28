import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { User, Shield, Users, Activity, Palette, ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();
  
  // Extract name or fallback to the prefix of their email
  const fullName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const initial = fullName.charAt(0).toUpperCase();
  const role = user?.role || 'ANALYST';

  const settingsCards = [
    {
      icon: User,
      title: 'Profile',
      desc: 'Manage your name, email, and contact info.',
      route: '/settings/profile'
    },
    {
      icon: Shield,
      title: 'Role & Permissions',
      desc: 'View your current role and what you can access.',
      route: '/settings/roles'
    },
    {
      icon: Users,
      title: 'Team Members',
      desc: 'Invite teammates and manage roles.',
      route: '/settings/team',
      roles: ['System Admin', 'Manager']
    },
    {
      icon: Clock,
      title: 'Audit Logs',
      desc: 'Track team activity and system events.',
      route: '/settings/audit-logs',
      roles: ['System Admin', 'Manager']
    },
    {
      icon: Activity,
      title: 'System Health',
      desc: 'Live status of API, models, and connectors.',
      route: '/settings/health',
      roles: ['System Admin', 'Manager']
    },
    {
      icon: Palette,
      title: 'Appearance',
      desc: 'Theme and display preferences.',
      route: '/settings/appearance'
    }
  ].filter(card => !card.roles || card.roles.includes(user?.role));

  const navigate = useNavigate();

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Settings" subtitle="Account, access, and platform configuration." />

      <div style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
           <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
        
        {/* Top Profile Card */}
        <div style={{ 
          marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '2rem',
          borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)', transition: 'border-color 0.2s'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#000000';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        >
          <div style={{ 
            width: 72, height: 72, borderRadius: '50%', 
            background: '#E0E7FF', color: '#4F46E5', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '1.75rem', fontWeight: 700 
          }}>
            {initial}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Inter', sans-serif", margin: 0 }}>
              {fullName}
            </h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0, marginBottom: '6px' }}>
              {user?.email || 'user@example.com'}
            </p>
            <div>
              <span style={{ 
                background: 'var(--primary-bg)', color: 'var(--primary)', 
                padding: '4px 10px', borderRadius: '4px', 
                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' 
              }}>
                {role.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Grid of Settings Options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {settingsCards.map((card, idx) => (
            <div key={idx} style={{ 
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', 
              padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
             onMouseEnter={e => {
               e.currentTarget.style.borderColor = '#000000';
             }}
             onMouseLeave={e => {
               e.currentTarget.style.borderColor = 'var(--border)';
             }}
            onClick={() => navigate(card.route)}
            >
              <div style={{ color: '#4F46E5' }}>
                <card.icon size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {card.title}
                </h4>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', lineHeight: '1.4', margin: 0 }}>
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;

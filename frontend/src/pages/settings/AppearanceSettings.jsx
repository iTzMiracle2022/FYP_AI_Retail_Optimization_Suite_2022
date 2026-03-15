import React from 'react';
import Navbar from '../../components/common/Navbar';
import { Palette, Moon, Sun, Monitor, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const AppearanceSettings = () => {
  const { themeMode, setThemeMode } = useTheme();

  const getStyle = (mode) => ({
    border: themeMode === mode ? '2px solid #4F46E5' : '1px solid var(--border)',
    borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', 
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', 
    background: themeMode === mode ? 'var(--bg-main)' : 'var(--bg-main)',
    transition: 'all 0.2s ease',
    opacity: themeMode === mode ? 1 : 0.7
  });

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Appearance" subtitle="Theme and display preferences." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={20} color="#2563EB" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Theme Mode</h4>
              <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Choose how Retail AI looks to you.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            
            {/* Light Mode */}
            <div style={getStyle('light')} onClick={() => setThemeMode('light')}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sun size={24} color="#F59E0B" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Light</span>
            </div>

            {/* Dark Mode */}
            <div style={getStyle('dark')} onClick={() => setThemeMode('dark')}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Moon size={24} color="#818CF8" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Dark</span>
            </div>

            {/* System Mode */}
            <div style={getStyle('system')} onClick={() => setThemeMode('system')}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Monitor size={24} color="var(--text-muted)" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>System</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;

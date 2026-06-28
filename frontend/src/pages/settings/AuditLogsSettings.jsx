import React, { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import API from '../../api';

const AuditLogsSettings = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.email) return;

    const fetchLogs = async () => {
      try {
        const res = await API.get('/audit-logs', {
          headers: { 'X-User-Email': user.email, 'X-User-Role': user.role }
        });
        if (res.success) {
          setLogs(res.logs || []);
        } else {
          setError(res.message || 'Failed to load audit logs.');
        }
      } catch (err) {
        setError(err || 'Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user?.email, user?.role]);

  const thStyle = { padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em', fontWeight: 800, opacity: 0.6 };
  const tdStyle = { padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-main)' };
  const trStyle = { transition: 'background-color 0.3s' };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Audit Logs" subtitle="Track user actions and operational status." />

      <div style={{ maxWidth: '1000px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>

        {error ? (
          <div style={{ padding: '2rem', border: '1px solid #fee2e2', background: '#fef2f2', color: '#b91c1c', borderRadius: '12px', marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>Access Denied</h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : (
          <div 
            style={{ 
              padding: '0', 
              overflow: 'hidden', 
              borderRadius: '24px', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)', 
              boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)', 
              transition: 'border-color 0.2s' 
            }} 
            onMouseEnter={e => e.currentTarget.style.borderColor = '#000000'} 
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                System Audit Logs
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)', opacity: 0.5 }}>
                        Syncing records...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)', opacity: 0.5 }}>
                        No audit log entries available.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, i) => (
                      <tr key={i} className="hover-row" style={trStyle}>
                        <td style={tdStyle}>{log.user_email}</td>
                        <td style={tdStyle}>
                          <span style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                            {log.user_role}
                          </span>
                        </td>
                        <td style={tdStyle}>{log.action}</td>
                        <td style={tdStyle}>
                          <span style={{ color: log.status === 'SUCCESS' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsSettings;

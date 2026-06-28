import React from 'react';
import Navbar from '../../components/common/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Shield, Check, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const RolesSettings = () => {
  const { user } = useAuth();
  const role = user?.role || 'Viewer';

  const matrix = {
    'System Admin': { upload: 'Yes', run: 'Yes', view: 'Yes', deleteDs: 'Yes', team: 'Yes', approvals: 'Yes', audit: 'Yes', connectors: 'Coming soon' },
    'Manager': { upload: 'Yes', run: 'Yes', view: 'Yes', deleteDs: 'Yes', team: 'Yes', approvals: 'Yes', audit: 'Yes', connectors: 'Coming soon' },
    'Analyst': { upload: 'Yes', run: 'Yes', view: 'Yes', deleteDs: 'Requires approval', team: 'No', approvals: 'No', audit: 'No', connectors: 'Coming soon' },
    'Viewer': { upload: 'No', run: 'No', view: 'Yes', deleteDs: 'No', team: 'No', approvals: 'No', audit: 'No', connectors: 'Coming soon' }
  };

  const userPerms = matrix[role] || matrix['Viewer'];

  const rows = [
    { label: 'Upload new datasets', val: userPerms.upload },
    { label: 'Run predictions/model execution', val: userPerms.run },
    { label: 'View analytics dashboards', val: userPerms.view },
    { label: 'Delete datasets', val: userPerms.deleteDs },
    { label: 'Manage team invites/roles', val: userPerms.team },
    { label: 'Approve pending operations', val: userPerms.approvals },
    { label: 'Access system audit logs', val: userPerms.audit },
    { label: 'External DB sync (connectors)', val: userPerms.connectors }
  ];

  const getStatusIcon = (val) => {
    if (val === 'Yes') return <Check size={16} color="#10b981" />;
    if (val === 'No') return <X size={16} color="#ef4444" />;
    return null;
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Role & Permissions" subtitle="View your current role and access level." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#4F46E5" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Current Role</h4>
              <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Your active authorization level on the platform.</p>
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '2rem' }}>
            <span style={{ 
              background: 'var(--primary-bg)', color: 'var(--primary)', 
              padding: '6px 12px', borderRadius: '6px', 
              fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.5px' 
            }}>
              {role.toUpperCase()}
            </span>
            <p style={{ marginTop: '12px', color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>
              You are logged in with the <strong>{role}</strong> identity role. Below is your active permission matrix.
            </p>
          </div>

          <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>Access Capabilities</h5>
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--border)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-main)' }}>{r.label}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        color: r.val === 'Yes' ? '#10b981' : r.val === 'No' ? '#ef4444' : r.val === 'Requires approval' ? '#f59e0b' : 'var(--text-light)', 
                        fontWeight: r.val === 'Coming soon' ? 600 : 700 
                      }}>{r.val}</span>
                      {getStatusIcon(r.val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesSettings;

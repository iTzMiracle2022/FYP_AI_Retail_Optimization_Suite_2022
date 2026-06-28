import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import { Settings as SettingsIcon, Database, Cpu, Shield, User, CheckCircle, AlertCircle, Zap, X, ShieldAlert, MoreVertical, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const [systemStatus, setSystemStatus] = useState({
    db: 'checking...',
    gpu: 'checking...',
    version: '1.2.0-beta',
    environment: 'WSL2 (Ubuntu)'
  });

  // Permissions Management State
  const [showPermissions, setShowPermissions] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Analyst' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setStatusMsg(null);
    try {
      const res = await API.get('/users', { params: { _t: Date.now() } }); 
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
      setStatusMsg({ type: 'error', text: "Connection failed. Backend might be offline." });
    }
    setLoadingUsers(false);
  };

  const handleUpdateRole = async (email, newRole) => {
    try {
      const res = await API.post('/users/update-role', { email, role: newRole });
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Role updated for ${email}` });
        fetchUsers();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: "Failed to update role." });
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      setStatusMsg({ type: 'error', text: "Both name and email are required." });
      return;
    }
    try {
      const res = await API.post('/users/add', newUser);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Added ${newUser.name} to the team!` });
        setNewUser({ name: '', email: '', role: 'Analyst' });
        setIsAdding(false);
        fetchUsers();
      } else {
        setStatusMsg({ type: 'error', text: res.message || "Failed to add user." });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err || "Failed to add user. Email may already exist." });
    }
  };

  const handleDeleteUser = async (email) => {
    if (email === user?.email) {
      setStatusMsg({ type: 'error', text: "You cannot remove yourself!" });
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      const res = await API.delete(`/users/${email}`);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Removed ${email} from the team.` });
        fetchUsers();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: "Failed to remove user." });
    }
  };

  useEffect(() => {
    // Check system status (logic will go here)
    setTimeout(() => {
      setSystemStatus(prev => ({
        ...prev,
        db: 'Connected (retail_db)',
        gpu: 'Hardware Graphics Optimized'
      }));
    }, 1500);
  }, []);

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Settings" />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Profile Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="premium-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.75rem' }}>
              <div style={{ padding: '0.85rem', borderRadius: '16px', backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <User size={26} />
              </div>
              <div>
                <h3 className="glow-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Account Details</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', opacity: 0.7 }}>Manage your personal profile information</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Admin Name</span>
                <span style={valueStyle}>{user?.name || 'Retail Admin'}</span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Login Email</span>
                <span style={valueStyle}>{user?.email || 'N/A'}</span>
              </div>
              <div style={infoRowStyle}>
                <span style={labelStyle}>Access Level</span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 800, 
                  backgroundColor: 'rgba(168, 85, 247, 0.1)', 
                  color: '#a855f7', 
                  padding: '0.35rem 0.75rem', 
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  textTransform: 'uppercase'
                }}>
                  {user?.role || 'Guest Access'}
                </span>
              </div>
            </div>
          </div>

          {user?.role === 'System Admin' && (
            <div className="premium-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.75rem' }}>
                <div style={{ padding: '0.85rem', borderRadius: '16px', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <Shield size={26} />
                </div>
                <div>
                  <h3 className="glow-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Security & Access</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', opacity: 0.7 }}>Manage your team and API permissions</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Team Members</span>
                  <span style={valueStyle}>{users.length} Active</span>
                </div>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Auth Protocol</span>
                  <span style={valueStyle}>JWT + MongoDB</span>
                </div>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Data Encryption</span>
                  <span style={valueStyle}>AES-256 Enabled</span>
                </div>
              </div>

              <button 
                onClick={() => setShowPermissions(true)}
                className="cta-button" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Manage Permissions
              </button>
            </div>
          )}
        </div>

        {/* 🔐 Permissions Modal Overlay */}
        {showPermissions && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '800px',
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
               {/* Modal Header */}
               <div style={{ padding: '1.5rem', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldAlert color="#8b5cf6" size={24} />
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Team Access Control</h2>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Manage your team and permissions</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPermissions(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={24} />
                  </button>
               </div>

               <div style={{ padding: '2rem' }}>
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

                  <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Team Member</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Access Level</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Last Login</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingUsers ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading team members...</td></tr>
                        ) : users.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No other team members found.</td></tr>
                        ) : users.map((userItem, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{userItem.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{userItem.email}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                               <select 
                                 value={userItem.role} 
                                 onChange={(e) => handleUpdateRole(userItem.email, e.target.value)}
                                 style={{ 
                                   background: 'rgba(139, 92, 246, 0.1)', 
                                   border: '1px solid rgba(139, 92, 246, 0.2)', 
                                   color: '#a78bfa', 
                                   borderRadius: '4px', 
                                   padding: '0.25rem 0.5rem',
                                   fontSize: '0.8rem'
                                 }}
                               >
                                 <option value="System Admin">System Admin</option>
                                 <option value="Manager">Manager</option>
                                 <option value="Analyst">Analyst</option>
                                 <option value="Viewer">Viewer</option>
                               </select>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                               {userItem.last_login ? (
                                 (() => {
                                   const dStr = userItem.last_login;
                                   const date = new Date(dStr.includes('Z') || dStr.includes('+') ? dStr : dStr + 'Z');
                                   return date.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                                 })()
                               ) : 'N/A'}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <button 
                                onClick={() => handleDeleteUser(userItem.email)}
                                title="Remove User Access"
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', hover: { color: '#ef4444' } }}
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ➕ Add User Form (Conditional) */}
                  {isAdding ? (
                    <div className="premium-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', marginBottom: '1rem' }}>
                       <h4 className="glow-text" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Add New Team Member</h4>
                       <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>Full Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Ali Ahmed" 
                              className="glass-container"
                              value={newUser.name}
                              onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid #1e293b', borderRadius: '12px', padding: '0.85rem 1rem', color: '#fff' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>Email Address</label>
                            <input 
                              type="email" 
                              placeholder="ali@retail.ai" 
                              className="glass-container"
                              value={newUser.email}
                              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid #1e293b', borderRadius: '12px', padding: '0.85rem 1rem', color: '#fff' }}
                            />
                          </div>
                          <div style={{ width: '140px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>Access Level</label>
                            <select 
                              className="glass-container"
                              value={newUser.role}
                              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                              style={{ width: '100%', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '12px', padding: '0.85rem 1rem', color: '#a855f7', cursor: 'pointer' }}
                            >
                              <option value="Manager" style={{ background: '#111' }}>Manager</option>
                              <option value="Analyst" style={{ background: '#111' }}>Analyst</option>
                              <option value="Viewer" style={{ background: '#111' }}>Viewer</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={handleAddUser} className="cta-button" style={{ padding: '0.85rem 1.5rem' }}>Add</button>
                            <button onClick={() => setIsAdding(false)} className="secondary-button" style={{ padding: '0.85rem 1.5rem' }}>Cancel</button>
                          </div>
                        </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <button onClick={() => setIsAdding(true)} className="secondary-button" style={{ borderStyle: 'dashed' }}>+ Add Team Member</button>
                      <button onClick={() => setShowPermissions(false)} className="cta-button">Done</button>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* System Status Section */}
        {(user?.role === 'System Admin' || user?.role === 'Manager') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="premium-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.75rem' }}>
                <div style={{ padding: '0.85rem', borderRadius: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <Zap size={26} />
                </div>
                <div>
                  <h3 className="glow-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>System Optimization</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', opacity: 0.7 }}>Hardware & Database status</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>DB Connection</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ height: 8, width: 8, borderRadius: '50%', background: '#10b981' }}></span>
                    <span style={valueStyle}>{systemStatus.db}</span>
                  </div>
                </div>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Compute Engine</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ height: 8, width: 8, borderRadius: '50%', background: '#10b981' }}></span>
                    <span style={valueStyle}>{systemStatus.gpu}</span>
                  </div>
                </div>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Platform Version</span>
                  <span style={valueStyle}>{systemStatus.version}</span>
                </div>
                <div style={infoRowStyle}>
                  <span style={labelStyle}>Host Environment</span>
                  <span style={valueStyle}>{systemStatus.environment}</span>
                </div>
              </div>

              <Link to="/settings/audit-logs" style={{ textDecoration: 'none' }}>
                <button className="secondary-button" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
                  View System Audit Logs
                </button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const StatusCard = ({ icon: Icon, label, value, status, sub }) => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
    <div style={{ color: status === 'online' ? '#10b981' : '#f59e0b' }}>
      <Icon size={20} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#10b981', fontWeight: 700 }}>
          ● {status}
        </span>
      </div>
      <p style={{ fontSize: '0.875rem' }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>{sub}</p>}
    </div>
  </div>
);

const infoRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 0',
  borderBottom: '1px solid var(--border)'
};

const labelStyle = {
  fontSize: '0.875rem',
  color: 'var(--text-light)',
  fontWeight: 500
};

const valueStyle = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text)'
};

export default Settings;

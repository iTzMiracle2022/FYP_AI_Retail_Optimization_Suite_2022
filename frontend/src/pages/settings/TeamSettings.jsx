import React, { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { Users, Mail, ArrowLeft, CheckCircle, AlertCircle, X, Check, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const TeamSettings = () => {
  const { user } = useAuth();
  
  const [usersList, setUsersList] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Analyst' });
  const [activeTab, setActiveTab] = useState('members'); // 'members' or 'approvals'

  useEffect(() => {
    fetchUsers();
    if (user?.role === 'Manager') {
      fetchApprovals();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setStatusMsg(null);
    try {
      const res = await axios.get('/api/users', { params: { _t: Date.now() } }); 
      if (res.data.success) {
        setUsersList(res.data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
      setStatusMsg({ type: 'error', text: "Connection failed. Backend might be offline." });
    }
    setLoadingUsers(false);
  };

  const fetchApprovals = async () => {
    setLoadingApprovals(true);
    try {
      const res = await axios.get('/api/users/approvals', {
        headers: { 'X-User-Email': user?.email, 'X-User-Role': user?.role }
      });
      if (res.data.success) {
        setApprovals(res.data.approvals);
      }
    } catch (err) {
      console.error("Failed to fetch approvals", err);
    }
    setLoadingApprovals(false);
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      setStatusMsg({ type: 'error', text: "Both name and email are required." });
      return;
    }
    try {
      const res = await axios.post('/api/users/add', newUser, {
        headers: { 'X-User-Email': user?.email, 'X-User-Role': user?.role }
      });
      if (res.data.success) {
        if (res.data.pending) {
            setStatusMsg({ type: 'success', text: res.data.message });
        } else {
            setStatusMsg({ type: 'success', text: `Added ${newUser.name} to the team!` });
        }
        setNewUser({ name: '', email: '', role: 'Analyst' });
        setIsAdding(false);
        fetchUsers();
      } else {
        setStatusMsg({ type: 'error', text: res.data.message || "Failed to add user." });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || "Failed to add user. Email may already exist." });
    }
  };

  const handleDeleteUser = async (email) => {
    if (email === user?.email) {
      setStatusMsg({ type: 'error', text: "You cannot remove yourself!" });
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      const res = await axios.delete(`/api/users/${email}`, {
        headers: { 'X-User-Email': user?.email, 'X-User-Role': user?.role }
      });
      if (res.data.success) {
        if (res.data.pending) {
            setStatusMsg({ type: 'success', text: res.data.message });
        } else {
            setStatusMsg({ type: 'success', text: `Removed ${email} from the team.` });
        }
        fetchUsers();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: "Failed to remove user." });
    }
  };

  const handleApprove = async (request_id) => {
    try {
      const res = await axios.post('/api/users/approve', { request_id }, {
        headers: { 'X-User-Email': user?.email, 'X-User-Role': user?.role }
      });
      if (res.data.success) {
        setStatusMsg({ type: 'success', text: "Request approved." });
        fetchApprovals();
        fetchUsers();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: "Failed to approve request." });
    }
  };

  const handleReject = async (request_id) => {
    try {
      const res = await axios.post('/api/users/reject', { request_id }, {
        headers: { 'X-User-Email': user?.email, 'X-User-Role': user?.role }
      });
      if (res.data.success) {
        setStatusMsg({ type: 'success', text: "Request rejected." });
        fetchApprovals();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: "Failed to reject request." });
    }
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Team Members" subtitle="Invite teammates and manage roles." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>

          {user?.role === 'Manager' && (
              <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button onClick={() => setActiveTab('members')} style={{ padding: '6px 12px', background: activeTab === 'members' ? 'var(--primary)' : 'transparent', color: activeTab === 'members' ? '#fff' : 'var(--text-light)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Members</button>
                  <button onClick={() => setActiveTab('approvals')} style={{ padding: '6px 12px', background: activeTab === 'approvals' ? 'var(--primary)' : 'transparent', color: activeTab === 'approvals' ? '#fff' : 'var(--text-light)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Approvals {approvals.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', padding: '0 6px', fontSize: '0.7rem' }}>{approvals.length}</span>}
                  </button>
              </div>
          )}
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

        {activeTab === 'members' ? (
        <div className="premium-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="#2563EB" />
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Active Members</h4>
                <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Manage users in your workspace.</p>
              </div>
            </div>
            {!isAdding && (
              <button onClick={() => setIsAdding(true)} className="cta-button" style={{ flexShrink: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                <Mail size={16} /> Invite Member
              </button>
            )}
          </div>

          {isAdding && (
            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
               <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Add New Team Member</h4>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Ali Ahmed" 
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Email Address</label>
                    <input 
                      type="email" 
                      placeholder="ali@retail.ai" 
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ width: '140px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Access Level</label>
                    <select 
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      style={{ width: '100%', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '10px', padding: '0.75rem 1rem', color: '#a855f7', cursor: 'pointer' }}
                    >
                      <option value="System Admin">System Admin</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handleAddUser} className="cta-button" style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}>Add</button>
                    <button onClick={() => setIsAdding(false)} className="secondary-button" style={{ padding: '0.75rem 1.5rem', fontSize: '0.85rem' }}>Cancel</button>
                  </div>
                </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <th style={{ paddingBottom: '12px' }}>USER</th>
                <th style={{ paddingBottom: '12px' }}>ROLE</th>
                <th style={{ paddingBottom: '12px' }}>STATUS</th>
                <th style={{ paddingBottom: '12px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr><td colSpan="4" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-light)' }}>Loading team members...</td></tr>
              ) : usersList.length > 0 ? (
                usersList.map((u, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 0', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      {u.name} <br/>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 400 }}>{u.email}</span>
                    </td>
                    <td style={{ padding: '16px 0' }}>
                      <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>{u.role.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '16px 0' }}>
                      <span style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 600 }}>{u.is_verified ? 'Active' : 'Invited'}</span>
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'right' }}>
                       {u.email !== user?.email && (
                         <button 
                           onClick={() => handleDeleteUser(u.email)}
                           title="Remove User"
                           style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                         >
                           <X size={16} />
                         </button>
                       )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: '16px 0', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>{user?.email || 'user@example.com'}</td>
                  <td style={{ padding: '16px 0' }}>
                    <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>{user?.role?.toUpperCase() || 'ANALYST'}</span>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    <span style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 600 }}>Active</span>
                  </td>
                  <td style={{ padding: '16px 0' }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        ) : (
            <div className="premium-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={20} color="#f59e0b" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Pending Approvals</h4>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>Review requests from System Admins.</p>
                </div>
              </div>

              {loadingApprovals ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem 0' }}>Loading approvals...</p>
              ) : approvals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <CheckCircle size={32} color="#10b981" style={{ marginBottom: '1rem' }} />
                      <h5 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>All Caught Up</h5>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>There are no pending approval requests at the moment.</p>
                  </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {approvals.map(app => (
                        <div key={app.request_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-main)' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>{app.type.replace('_', ' ')}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requested by {app.requested_by}</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                    {app.type === 'ADD_USER' && `Add ${app.payload.name} (${app.payload.email}) as ${app.payload.role}`}
                                    {app.type === 'DELETE_USER' && `Remove user ${app.payload.email} from the system`}
                                    {app.type === 'DELETE_DATASET' && `Delete dataset ${app.payload.dataset_id}`}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleApprove(app.request_id)} style={{ width: 32, height: 32, borderRadius: '8px', border: 'none', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Check size={16} /></button>
                                <button onClick={() => handleReject(app.request_id)} style={{ width: 32, height: 32, borderRadius: '8px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
              )}
            </div>
        )}
      </div>
    </div>
  );
};

export default TeamSettings;

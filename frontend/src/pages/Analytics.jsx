import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import { BarChart, Clock, AlertTriangle, RefreshCcw, Cpu } from 'lucide-react';
import { useAuth } from "../context/AuthContext";
import API from '../api/index';

const Analytics = () => {
  const { user } = useAuth();
  const isDev = import.meta.env.DEV;
  
  const defaultTab = isDev ? (new URLSearchParams(window.location.search).get('tab') || 'models') : 'audit';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    models: [],
    errors: [],
    preprocessing: [],
    auditLogs: []
  });

  useEffect(() => {
    if (!user?.email) return;
    
    const fetchStats = async () => {
      try {
        let statsRes = { success: true, models: [], errors: [], preprocessing: [] };
        if (isDev) {
          const res = await API.get(`/analytics/stats?email=${user.email}`).catch(() => ({ success: false }));
          if (res.success) statsRes = res;
        }
        
        const auditRes = await API.get(`/audit-logs`, {
          headers: { 'X-User-Email': user.email, 'X-User-Role': user.role }
        }).catch(() => ({ success: false, logs: [] }));

        setStats({
          models: statsRes.models || [],
          errors: statsRes.errors || [],
          preprocessing: statsRes.preprocessing || [],
          auditLogs: auditRes.success ? auditRes.logs : []
        });
      } catch (err) {
        console.error("Analytics fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.email]);

  const displayMetric = (m) => {
    if (m.metric_name) {
      return `${m.metric_name}: ${m.metric_display || 'N/A'}`;
    }
    
    if (m.accuracy === undefined || m.accuracy === null) {
      return 'Metric: N/A';
    }
    
    const val = parseFloat(m.accuracy);
    if (isNaN(val)) {
      if (typeof m.accuracy === 'string' && m.accuracy.endsWith('%')) {
        const label = m.model_type === 'ARIMA (Hybrid)' ? 'MAPE' : 'Accuracy';
        return `${label}: ${m.accuracy}`;
      }
      return 'Metric: N/A';
    }
    
    if (m.model_type === 'RandomForestClassifier') {
      return `Accuracy: ${(val * 100).toFixed(1)}%`;
    } else if (m.model_type === 'KMeans') {
      return `Silhouette Score: ${val.toFixed(4)}`;
    } else if (m.model_type === 'ARIMA (Hybrid)') {
      return `MAPE: ${(val * 100).toFixed(1)}%`;
    } else if (m.model_type === 'Q-Learning Engine') {
      return 'Cost Improvement: N/A';
    }
    
    return `Accuracy: ${(val * 100).toFixed(1)}%`;
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="History & Logs" />

      {/* Modern Tabs */}
      {isDev && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '2rem', 
          background: 'rgba(255,255,255,0.02)', 
          padding: '0.5rem', 
          borderRadius: '18px', 
          border: '1px solid rgba(255,255,255,0.05)', 
          width: 'fit-content' 
        }}>
          <TabButton id="models" label="Model History" active={activeTab} onClick={setActiveTab} icon={BarChart} />
          <TabButton id="errors" label="System Alerts" active={activeTab} onClick={setActiveTab} icon={AlertTriangle} />
          <TabButton id="data"   label="Data Audit" active={activeTab} onClick={setActiveTab} icon={RefreshCcw} />
          <TabButton id="audit"  label="Audit Logs" active={activeTab} onClick={setActiveTab} icon={Clock} />
        </div>
      )}

      <div style={{ padding: '0', overflow: 'hidden', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)', transition: 'border-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#000000'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {activeTab === 'models' ? 'Past ML Predictions' : activeTab === 'errors' ? 'System Health Logs' : activeTab === 'data' ? 'Data Processing Audit' : 'System Audit Logs'}
          </h3>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {activeTab === 'models' && (
                  <>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Analysis</th>
                    <th style={thStyle}>Model Metric</th>
                    <th style={thStyle}>Hardware</th>
                    <th style={thStyle}>Date</th>
                  </>
                )}
                {activeTab === 'errors' && (
                  <>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Details</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Time</th>
                  </>
                )}
                {activeTab === 'data' && (
                  <>
                    <th style={thStyle}>Record</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Volume Change</th>
                    <th style={thStyle}>Executed At</th>
                  </>
                )}
                {activeTab === 'audit' && (
                  <>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Time</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)', opacity: 0.5 }}>Syncing records...</td></tr>
              ) : (
                <>
                  {activeTab === 'models' && stats.models.map((m, i) => (
                    <tr key={i} className="hover-row" style={trStyle}>
                      <td style={tdStyle}>{m.model_type}</td>
                      <td style={tdStyle}>{m.analysis_type}</td>
                      <td style={tdStyle}><span style={{ color: '#10b981', fontWeight: 800 }}>{displayMetric(m)}</span></td>
                      <td style={tdStyle}>
                         <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                           <Cpu size={12} color="#10b981" />
                           <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.75rem' }}>{m.device}</span>
                         </div>
                      </td>
                      <td style={tdStyle}>{new Date(m.trained_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {activeTab === 'errors' && stats.errors.map((e, i) => (
                    <tr key={i} className="hover-row" style={trStyle}>
                      <td style={{ ...tdStyle, color: '#ef4444', fontWeight: 700 }}>{e.error_code}</td>
                      <td style={tdStyle}>{e.error_message}</td>
                      <td style={tdStyle}><span style={{ color: 'var(--text-light)', opacity: 0.6 }}>{e.dataset_id || 'Global'}</span></td>
                      <td style={tdStyle}>{new Date(e.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeTab === 'data' && stats.preprocessing.map((p, i) => (
                    <tr key={i} className="hover-row" style={trStyle}>
                      <td style={tdStyle}>{p.dataset_id}</td>
                      <td style={tdStyle}>{p.normalization_method}</td>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.rows_before} → {p.rows_after}</span></td>
                      <td style={tdStyle}>{new Date(p.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeTab === 'audit' && stats.auditLogs.map((log, i) => (
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
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ id, label, active, onClick, icon: Icon }) => (
  <button 
    onClick={() => onClick(id)}
    style={{
      padding: '0.75rem 1.25rem',
      backgroundColor: active === id ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      fontSize: '0.85rem',
      fontWeight: 700,
      color: active === id ? '#a855f7' : '#94a3b8',
      borderRadius: '12px',
      transition: 'all 0.3s var(--ease-premium)',
    }}
  >
    <Icon size={16} /> {label}
  </button>
);

const thStyle = { padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em', fontWeight: 800, opacity: 0.6 };
const tdStyle = { padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-main)' };
const trStyle = { transition: 'background-color 0.3s' };

export default Analytics;

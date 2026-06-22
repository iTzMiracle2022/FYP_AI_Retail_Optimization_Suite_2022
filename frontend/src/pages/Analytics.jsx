import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import { BarChart, Clock, AlertTriangle, RefreshCcw, Cpu } from 'lucide-react';
import { useAuth } from "../context/AuthContext";
import API from '../api/index';

const Analytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('models');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    models: [],
    errors: [],
    preprocessing: []
  });

  useEffect(() => {
    if (!user?.email) return;
    
    const fetchStats = async () => {
      try {
        const res = await API.get(`/analytics/stats?email=${user.email}`);
        if (res.success) {
          setStats({
            models: res.models || [],
            errors: res.errors || [],
            preprocessing: res.preprocessing || []
          });
        }
      } catch (err) {
        console.error("Analytics fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user?.email]);

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="History & Logs" />

      {/* Modern Tabs */}
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
      </div>

      <div className="premium-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {activeTab === 'models' ? 'Past ML Predictions' : activeTab === 'errors' ? 'System Health Logs' : 'Data Processing Audit'}
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
                    <th style={thStyle}>Accuracy</th>
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
                      <td style={tdStyle}><span style={{ color: '#10b981', fontWeight: 800 }}>{(m.accuracy * 100).toFixed(1)}%</span></td>
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
const tdStyle = { padding: '1.25rem 2rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem', color: '#f1f5f9' };
const trStyle = { transition: 'background-color 0.3s' };

export default Analytics;

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { Link } from 'react-router-dom';
import { Activity, Server, Database, Cpu, ArrowLeft } from 'lucide-react';
import API from '../../api';

const HealthSettings = () => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    API.get('/health')
      .then(res => setHealth(res))
      .catch(err => console.error(err));
  }, []);

  const data = health || {
    api: { status: 'Loading...', details: 'Fetching metrics...' },
    models: { status: 'Loading...', details: 'Fetching metrics...' },
    database: { status: 'Loading...', details: 'Fetching metrics...' },
    queue: { status: 'Loading...', details: 'Fetching metrics...' }
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="System Health" subtitle="Live status of API, models, and connectors." />

      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Server size={20} color="#2563EB" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>API Gateway</span>
              </div>
              <span style={{ color: data.api.status === 'Operational' ? '#10B981' : '#F59E0B', fontSize: '0.8rem', fontWeight: 700 }}>{data.api.status}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{data.api.details}</p>
          </div>

          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Cpu size={20} color="#7C3AED" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>AI Models</span>
              </div>
              <span style={{ color: data.models.status === 'Operational' ? '#10B981' : '#F59E0B', fontSize: '0.8rem', fontWeight: 700 }}>{data.models.status}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{data.models.details}</p>
          </div>

          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Database size={20} color="#F59E0B" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Storage</span>
              </div>
              <span style={{ color: data.database.status === 'Operational' ? '#10B981' : '#EF4444', fontSize: '0.8rem', fontWeight: 700 }}>{data.database.status}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{data.database.details}</p>
          </div>

          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Activity size={20} color="#EC4899" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Task Queue</span>
              </div>
              <span style={{ color: data.queue.status === 'Operational' ? '#10B981' : '#F59E0B', fontSize: '0.8rem', fontWeight: 700 }}>{data.queue.status}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{data.queue.details}</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HealthSettings;

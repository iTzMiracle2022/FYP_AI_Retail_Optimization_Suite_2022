import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Globe, 
  Clock, 
  ShieldCheck, 
  RefreshCcw, 
  Server, 
  Key, 
  Play,
  CheckCircle2,
  AlertCircle,
  Package
} from 'lucide-react';
import API from '../api/index';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('sql');
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  
  // SQL Form State
  const [sqlConfig, setSqlConfig] = useState({
    db_type: 'sqlite',
    host: 'erp_sample.db',
    port: '',
    user: '',
    password: '',
    database: ''
  });

  // Scheduling State
  const [schedules, setSchedules] = useState({
    sales: { frequency: 'Daily', time: '00:00' },
    inventory: { frequency: 'Every 12 Hours', time: '02:00' }
  });

  // API Configuration State
  const [apiConfig, setApiConfig] = useState({
    shopify: { domain: '', apiKey: '', secret: '' },
    woocommerce: { domain: '', consumerKey: '', consumerSecret: '' }
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await API.get('/connectors/history');
      if (res.success) setSyncLogs(res.history);
    } catch (err) {
      console.error("Failed to fetch sync history.");
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await API.post('/connectors/test', sqlConfig);
      setStatus({ type: res.success ? 'success' : 'error', message: res.message });
    } catch (err) {
      setStatus({ type: 'error', message: "Connection failed. Check server logs." });
    }
    setLoading(false);
  };

  const handleSetupSample = async () => {
    setSetupLoading(true);
    try {
      const res = await API.post('/connectors/setup-sample');
      setStatus({ type: 'success', message: "Sample ERP Database (erp_sample.db) created! Try testing the connection now." });
      setSqlConfig({ ...sqlConfig, host: 'erp_sample.db', db_type: 'sqlite' });
    } catch (err) {
      setStatus({ type: 'error', message: "Failed to create sample database." });
    }
    setSetupLoading(false);
  };

  const handleSyncData = async (table) => {
    setLoading(true);
    try {
      const res = await API.post('/connectors/sync', {
        ...sqlConfig,
        table_name: table,
        dataset_name: `erp_${table}`
      });
      setStatus({ type: 'success', message: res.message });
      fetchHistory(); // 🔄 Refresh history after manual sync
    } catch (err) {
      setStatus({ type: 'error', message: "Sync failed. Ensure table exists." });
    }
    setLoading(false);
  };

  const handleSimulateWebhook = async (source) => {
    setLoading(true);
    try {
      const payloads = {
        shopify: { id: Date.now(), total_price: 154.99, customer: 'John Doe', gateway: 'shopify_payments' },
        woocommerce: { id: Date.now(), total: 89.00, billing: { first_name: 'Alice' }, status: 'processing' }
      };
      const res = await API.post(`/connectors/webhook?source=${source}`, payloads[source]);
      setStatus({ type: 'success', message: res.message });
      fetchHistory(); // 🔄 Show the new order in history instantly
    } catch (err) {
      setStatus({ type: 'error', message: "Simulation failed. Check API connection." });
    }
    setLoading(false);
  };

  const handleUpdateSchedule = async (type) => {
    setLoading(true);
    try {
      const config = type === 'sales' ? schedules.sales : schedules.inventory;
      const res = await API.post('/connectors/schedule', {
        ...config,
        connector_id: `erp_${type}`,
        target: type === 'sales' ? 'Sales Ledger' : 'Warehouse Stock'
      });
      setStatus({ type: 'success', message: res.message });
    } catch (err) {
      setStatus({ type: 'error', message: "Failed to update schedule in database." });
    }
    setLoading(false);
  };

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={32} color="#8b5cf6" /> Admin Integration Hub
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Securely manage external data sources and automation hooks.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
        {/* Sidebar Tabs */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 'sql', label: 'Database Connector', icon: Database },
            { id: 'api', label: 'API Bridge', icon: Globe },
            { id: 'sync', label: 'Automation & Sync', icon: Clock }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: activeTab === tab.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: activeTab === tab.id ? '#a78bfa' : '#94a3b8',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Tab Content */}
        <main className="glass-panel" style={{ padding: '2rem' }}>
          {status && (
            <div style={{ 
              background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${status.type === 'success' ? '#10b981' : '#ef4444'}`,
              padding: '1rem',
              borderRadius: '0.5rem',
              color: status.type === 'success' ? '#10b981' : '#ef4444',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              {status.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
              <span style={{ fontSize: '0.875rem' }}>{status.message}</span>
            </div>
          )}

          {activeTab === 'sql' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>External SQL Source</h3>
                <button 
                  onClick={handleSetupSample}
                  disabled={setupLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid #3b82f6',
                    color: '#60a5fa',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {setupLoading ? 'Setting up...' : 'Setup Sample ERP'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>Database Type</label>
                  <select 
                    value={sqlConfig.db_type}
                    onChange={(e) => setSqlConfig({...sqlConfig, db_type: e.target.value})}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '0.5rem', color: '#f1f5f9' }}
                  >
                    <option value="sqlite">SQLite (File-based)</option>
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                  </select>
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>Host / Path</label>
                  <input 
                    type="text"
                    value={sqlConfig.host}
                    onChange={(e) => setSqlConfig({...sqlConfig, host: e.target.value})}
                    placeholder="e.g. 127.0.0.1 or /path/to/db"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '0.5rem', color: '#f1f5f9' }}
                  />
                </div>

                {sqlConfig.db_type !== 'sqlite' && (
                  <>
                    <div className="input-group">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>User</label>
                      <input 
                        type="text"
                        value={sqlConfig.user}
                        onChange={(e) => setSqlConfig({...sqlConfig, user: e.target.value})}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '0.5rem', color: '#f1f5f9' }}
                      />
                    </div>
                    <div className="input-group">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>Password</label>
                      <input 
                        type="password"
                        value={sqlConfig.password}
                        onChange={(e) => setSqlConfig({...sqlConfig, password: e.target.value})}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '0.5rem', color: '#f1f5f9' }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handleTestConnection}
                  disabled={loading}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Play size={16} /> {loading ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCcw size={18}/> Sync Data Manually</h4>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => handleSyncData('sales_ledger')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Sync Sales Data</button>
                  <button onClick={() => handleSyncData('warehouse_stock')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Sync Inventory Data</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Shopify Integration Form */}
                <div className="glass-panel" style={{ background: 'rgba(149, 191, 71, 0.03)', border: '1px solid rgba(149, 191, 71, 0.1)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#95bf47', marginBottom: '1.25rem' }}>
                    <Package size={18} /> Shopify API Settings
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Store Domain</label>
                      <input 
                        type="text" placeholder="mystore.myshopify.com" 
                        value={apiConfig.shopify.domain}
                        onChange={e => setApiConfig({...apiConfig, shopify: {...apiConfig.shopify, domain: e.target.value}})}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '0.5rem' }}
                      />
                    </div>
                    <div className="input-group">
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Admin API Access Token</label>
                      <input 
                        type="password" placeholder="shpat_xxxxxxxxxxxx" 
                        value={apiConfig.shopify.apiKey}
                        onChange={e => setApiConfig({...apiConfig, shopify: {...apiConfig.shopify, apiKey: e.target.value}})}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '0.5rem' }}
                      />
                    </div>
                    <button className="btn-secondary" style={{ background: '#95bf47', color: '#fff', border: 'none', padding: '0.5rem' }}>Update Shopify Link</button>
                  </div>
                </div>

                {/* WooCommerce Integration Form */}
                <div className="glass-panel" style={{ background: 'rgba(111, 44, 172, 0.03)', border: '1px solid rgba(111, 44, 172, 0.1)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#96588a', marginBottom: '1.25rem' }}>
                    <Globe size={18} /> WooCommerce API Settings
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Store URL</label>
                      <input 
                        type="text" placeholder="https://example.com" 
                        value={apiConfig.woocommerce.domain}
                        onChange={e => setApiConfig({...apiConfig, woocommerce: {...apiConfig.woocommerce, domain: e.target.value}})}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '0.5rem' }}
                      />
                    </div>
                    <div className="input-group">
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Consumer Key (ck_...)</label>
                      <input 
                        type="password" placeholder="ck_xxxxxxxxxxxx" 
                        value={apiConfig.woocommerce.consumerKey}
                        onChange={e => setApiConfig({...apiConfig, woocommerce: {...apiConfig.woocommerce, consumerKey: e.target.value}})}
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '0.5rem' }}
                      />
                    </div>
                    <button className="btn-secondary" style={{ background: '#96588a', color: '#fff', border: 'none', padding: '0.5rem' }}>Update WooCommerce Link</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Webhooks & Live Traffic Simulator</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Verify your API bridges by simulating real store events.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => handleSimulateWebhook('shopify')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(149, 191, 71, 0.1)', border: '1px solid #95bf47', color: '#95bf47' }}>
                    <Play size={14} /> Simulate Shopify Payload 🛍️
                  </button>
                  <button onClick={() => handleSimulateWebhook('woocommerce')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(111, 44, 172, 0.1)', border: '1px solid #6f2cac', color: '#96588a' }}>
                    <Play size={14} /> Simulate Woo Payload 📦
                  </button>
                </div>
              </div>

              <div style={{ background: '#0f172a', borderRadius: '1rem', border: '1px solid #1e293b', overflow: 'hidden' }}>
                 <div style={{ padding: '0.75rem 1.5rem', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <Server size={14} /> Webhook Traffic Monitor (Active)
                   </span>
                   <div style={{ display: 'flex', gap: '0.4rem' }}>
                     <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></div>
                     <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></div>
                     <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div>
                   </div>
                 </div>
                 <div style={{ padding: '1.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', minHeight: '160px' }}>
                    <p style={{ color: '#64748b' }}>// Listening for shopify/orders/create...</p>
                    <p style={{ color: '#64748b' }}>// Listening for woocommerce/order_created...</p>
                    {status && status.message.includes('Webhook') ? (
                       <div style={{ marginTop: '1rem' }}>
                         <p style={{ color: '#a78bfa' }}>[ {new Date().toLocaleTimeString()} ] Incoming POST /api/connectors/webhook</p>
                         <pre style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', color: '#f1f5f9', marginTop: '0.5rem' }}>
                            {`{
  "source": "${status.message.split(' ').pop()}",
  "store": "${status.message.includes('Shopify') ? apiConfig.shopify.domain || 'demo-store.myshopify.com' : apiConfig.woocommerce.domain || 'example.com'}",
  "event": "order_create",
  "status": "success",
  "ml_ready": true
}`}
                         </pre>
                       </div>
                    ) : (
                       <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Waiting for incoming store traffic...</p>
                    )}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                 <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Automation & Synchronization</h3>
                 {/* No logic for "Update All" yet, user does it per channel */}
               </div>

               {/* 📅 Sync Configuration */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <RefreshCcw size={20} color="#8b5cf6" />
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Main Sales Sync</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Frequency</label>
                        <select 
                          value={schedules.sales.frequency}
                          onChange={(e) => setSchedules({ ...schedules, sales: { ...schedules.sales, frequency: e.target.value } })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: '#fff' }}
                        >
                          <option>Daily</option>
                          <option>Every 6 Hours</option>
                          <option>Weekly</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Sync Time</label>
                          <input 
                            type="time" 
                            value={schedules.sales.time}
                            onChange={(e) => setSchedules({ ...schedules, sales: { ...schedules.sales, time: e.target.value } })}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: '#fff' }} 
                          />
                        </div>
                        <button onClick={() => handleUpdateSchedule('sales')} className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.7rem' }}>Save</button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <Package size={20} color="#10b981" />
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Inventory Re-index</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Frequency</label>
                        <select 
                          value={schedules.inventory.frequency}
                          onChange={(e) => setSchedules({ ...schedules, inventory: { ...schedules.inventory, frequency: e.target.value } })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: '#fff' }}
                        >
                          <option>Every 12 Hours</option>
                          <option>Daily</option>
                          <option>Real-time (API)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Sync Time</label>
                          <input 
                            type="time" 
                            value={schedules.inventory.time}
                            onChange={(e) => setSchedules({ ...schedules, inventory: { ...schedules.inventory, time: e.target.value } })}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', color: '#fff' }} 
                          />
                        </div>
                        <button onClick={() => handleUpdateSchedule('inventory')} className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.7rem' }}>Save</button>
                      </div>
                    </div>
                  </div>
               </div>

               {/* 📊 Sync History (Real Database Logs) */}
               <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Clock size={18} color="#94a3b8" /> Execution Event History (Live Logs)
               </h4>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {syncLogs.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#4b5563', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                       No synchronization logs found. Perform a sync to see updates.
                    </div>
                  ) : syncLogs.map((log, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.75rem 1.25rem', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '8px',
                      borderLeft: `4px solid ${log.status === 'Success' ? '#10b981' : '#ef4444'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 600 }}>
                           {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                           {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 500 }}>
                           {log.table}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: log.status === 'Success' ? '#10b981' : '#f87171' }}>
                          {log.status} {log.error && `(${log.error})`}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{log.rows_synced} rows</span>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminSettings;

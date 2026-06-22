import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/common/Navbar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { listDatasets } from '../api/datasetAPI';
import { exportReport } from '../api/reportAPI';
import API from '../api/index';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Tag, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

const TIME_PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: '7d',  label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '180d',label: 'Last 6 Months' },
  { value: '365d', label: 'Last Year' },
];

const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
      <p style={{ color: '#94a3b8', marginBottom: '0.4rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
    <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</p>
      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>{value}</p>
    </div>
  </div>
);

const SalesTrend = () => {
  const { user } = useAuth();
  const { salesState, setSalesState } = useApp();
  const [datasets, setDatasets]           = useState([]);
  const [selectedDs, setSelectedDs]       = useState(salesState.selectedDs);
  const [timePeriod, setTimePeriod]       = useState(salesState.timePeriod);
  const [category, setCategory]           = useState(salesState.category);
  const [categories, setCategories]       = useState(salesState.categories);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [results, setResults]             = useState(salesState.results);
  const [exporting, setExporting]         = useState(false);

  useEffect(() => {
    setSalesState({ selectedDs, timePeriod, category, categories, results });
  }, [selectedDs, timePeriod, category, categories, results]);

  useEffect(() => {
    if (!user?.email) return;
    listDatasets(user.email).then(r => setDatasets(r.datasets || []));
  }, [user?.email]);

  useEffect(() => {
    if (!selectedDs || !user?.email) return;
    API.get(`/sales/categories/${selectedDs}?email=${user.email}`)
      .then(r => setCategories(r.categories || []))
      .catch(() => setCategories([]));
  }, [selectedDs, user?.email]);

  const runAnalysis = useCallback(async () => {
    if (!selectedDs) return setError('Please select a dataset.');
    if (!user?.email) return setError("User identity not confirmed.");
    
    setError(null); setLoading(true); setResults(null);
    try {
      const res = await API.post('/sales/trends', {
        dataset_id: selectedDs,
        email: user.email,
        category: category !== 'all' ? category : null,
        time_period: timePeriod
      });
      setResults(res);
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [selectedDs, category, timePeriod, user?.email]);

  const handleExport = async (fmt) => {
    if (!results) return;
    setExporting(true);
    try {
      await exportReport('sales', fmt, results.daily_trends, selectedDs, {
        'Total Revenue': `$${results.kpis?.total_revenue?.toLocaleString() || 0}`,
        'Transactions': results.kpis?.total_transactions,
        'Period': timePeriod,
        'Category': category
      });
    } catch (err) { setError(err); }
    finally { setExporting(false); }
  };

  const kpis = results?.kpis || {};

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Sales Trends" />

      {/* ── Controls */}
      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 className="glow-text" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
             Analyze Your Performance
          </h3>
          {selectedDs && (selectedDs.startsWith('erp_') || selectedDs.startsWith('webhook_')) && (
            <span className="pulse-slow" style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, background: 'rgba(16, 185, 129, 0.1)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              ⚡ LIVE ENTERPRISE DATA ACTIVE
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '1.75rem', opacity: 0.8 }}>
          Track your revenue, orders, and popular products over time.
        </p>
        
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.65rem', fontWeight: 700, letterSpacing: '0.05em' }}>SELECT RECORD</label>
            <select 
              className="glass-container"
              style={{ padding: '0.85rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', color: '#fff', width: '100%' }}
              value={selectedDs} 
              onChange={e => setSelectedDs(e.target.value)}
            >
              <option value="" style={{ background: '#111' }}>-- Select Record --</option>
              {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id} style={{ background: '#111' }}>{d.file_name}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.65rem', fontWeight: 700, letterSpacing: '0.05em' }}>TIME PERIOD</label>
            <select 
              className="glass-container"
              style={{ padding: '0.85rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', color: '#fff', width: '100%' }}
              value={timePeriod} 
              onChange={e => setTimePeriod(e.target.value)}
            >
              {TIME_PERIODS.map(t => <option key={t.value} value={t.value} style={{ background: '#111' }}>{t.label}</option>)}
            </select>
          </div>

          {categories.length > 0 && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.65rem', fontWeight: 700, letterSpacing: '0.05em' }}>ITEM CATEGORY</label>
              <select 
                className="glass-container"
                style={{ padding: '0.85rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', color: '#fff', width: '100%' }}
                value={category} 
                onChange={e => setCategory(e.target.value)}
              >
                <option value="all" style={{ background: '#111' }}>All Categories</option>
                {categories.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
              </select>
            </div>
          )}

          <button 
            onClick={runAnalysis} 
            disabled={loading || !selectedDs} 
            className="cta-button"
            style={{ padding: '0.85rem 2rem' }}
          >
            {loading ? '🔍 Analyzing...' : 'Analyze Sales'}
          </button>
        </div>
      </div>

      <ErrorMessage message={error} />
      {loading && <LoadingSpinner message="Analyzing sales trends..." />}

      {results && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard icon={DollarSign} label="Total Revenue" value={`$${kpis.total_revenue?.toLocaleString() || 0}`} color="#10b981" />
            <KpiCard icon={ShoppingCart} label="Transactions" value={kpis.total_transactions?.toLocaleString() || 0} color="#3b82f6" />
            <KpiCard icon={TrendingUp} label="Avg Order Value" value={`$${kpis.avg_order_value?.toLocaleString() || 0}`} color="#8b5cf6" />
            <KpiCard icon={Tag} label="Categories" value={kpis.unique_categories || 0} color="#f59e0b" />
          </div>

          {/* Daily Revenue Line Chart */}
          {results.daily_trends?.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>Daily Revenue Trend</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revenue over time with 7-day rolling average</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleExport('csv')} disabled={exporting} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Download size={14} /> CSV
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={exporting} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                    <Download size={14} /> PDF
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={results.daily_trends.slice(-90)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="revenue_7d_avg" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="7-Day Average" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Category Breakdown */}
            {results.category_breakdown?.length > 0 && (
              <div className="glass-panel">
                <h3 style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>Revenue by Category</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Total revenue per product category
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={results.category_breakdown.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="category" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
                    <Tooltip content={<CustomTooltip prefix="$" />} />
                    <Bar dataKey="total_revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                      {results.category_breakdown.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Products */}
            {results.top_products?.length > 0 && (
              <div className="glass-panel">
                <h3 style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '0.25rem' }}>Top Products by Revenue</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Highest revenue-generating products</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {results.top_products.slice(0, 8).map((p, i) => {
                    const maxRev = results.top_products[0]?.revenue || 1;
                    const pct = ((p.revenue / maxRev) * 100).toFixed(0);
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                          <span style={{ color: '#f1f5f9' }}>{p.product}</span>
                          <span style={{ color: COLORS[i % COLORS.length], fontWeight: 600 }}>${p.revenue?.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 999 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 999 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SalesTrend;

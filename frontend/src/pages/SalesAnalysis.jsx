import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import SalesTrendChart from '../components/charts/SalesTrendChart';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DashboardLoadingState from '../components/common/DashboardLoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { listDatasets } from '../api/datasetAPI';
import { exportReport } from '../api/reportAPI';
import API from '../api/index';
import { LineChart as LucideLineChart, DollarSign, Package, Calendar, Download, TrendingUp, Receipt, ShoppingCart, Play, ArrowLeft, Users, RefreshCw, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, PieChart, Pie, Legend, Brush } from 'recharts';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';

const getCompactFormatter = (value, isCurrency = false) => {
  if (value === null || value === undefined) return '-';
  if (value >= 1e9) return `${isCurrency ? '$' : ''}${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${isCurrency ? '$' : ''}${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${isCurrency ? '$' : ''}${(value / 1e3).toFixed(1)}K`;
  if (isCurrency) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value.toLocaleString();
};

const CustomTooltip = ({ active, payload, label, isCurrency = true, valuePrefix = '', suffix = '', extraFields = [], titlePrefix = '', top_items = [], dynamicPosition = false, coordinate, viewBox, width = 270 }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const displayLabel = data.label || label;
    const finalTitle = titlePrefix ? `${titlePrefix}: ${displayLabel}` : displayLabel;

    let style = {
      background: '#ffffff',
      border: '1px solid #E2E8F0',
      padding: '12px 16px 8px 16px',
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
      width: `${width}px`,
      height: 'max-content',
      minHeight: 'auto',
      boxSizing: 'border-box',
      zIndex: 1000,
      fontFamily: "'Inter', sans-serif"
    };

    if (dynamicPosition && coordinate && viewBox) {
      const tooltipWidth = width;
      const padding = 20; // 20px safe distance to guarantee active bar visibility
      let leftPos = coordinate.x + padding;

      // If tooltip overflows the right edge of the chart
      if (leftPos + tooltipWidth > viewBox.width) {
        // Flip to the left side of the hovered bar
        leftPos = coordinate.x - tooltipWidth - padding;
      }

      // Allow tooltip to spill outside the SVG to the left (over neighboring card) 
      // instead of clamping it to 0, which would force it back over the hovered bar.
      // Safety clamp: Prevent it from going completely off the viewport if on a small screen.
      const maxLeftSpill = -viewBox.width + 10;
      if (leftPos < maxLeftSpill) {
        leftPos = maxLeftSpill;
      }

      style = {
        ...style,
        position: 'absolute',
        left: `${leftPos}px`,
        top: 0,
        transition: 'left 0.15s ease-out'
      };
    }

    return (
      <div style={style}>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
          {finalTitle}
        </p>

        {payload.map((entry, index) => {
          const exactValue = isCurrency
            ? `$${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : entry.value.toLocaleString();

          return (
            <div key={index} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: entry.color || '#3B82F6', marginRight: '6px' }}></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{entry.name}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>
                  {valuePrefix}{exactValue}{suffix}
                </span>
              </div>

              {data.prev_value !== undefined && data.prev_value !== null && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 0 0' }}>
                  <span style={{ fontSize: '0.75rem', color: data.delta > 0 ? '#10B981' : data.delta < 0 ? '#EF4444' : '#64748B', fontWeight: 500 }}>
                    {data.delta > 0 ? '↑' : data.delta < 0 ? '↓' : ''} Change: {data.delta > 0 ? '+' : ''}{isCurrency ? `$${data.delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : data.delta.toLocaleString()} ({data.delta_pct > 0 ? '+' : ''}{data.delta_pct.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {extraFields.filter(f => !f.isNote).map((field, idx) => {
          if (data[field.key] === undefined) return null;
          let valStr = field.isCurrency
            ? `$${data[field.key].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : (typeof data[field.key] === 'number' ? data[field.key].toLocaleString() : data[field.key]);

          if (field.key === 'date_window' && typeof data[field.key] === 'string' && data[field.key].includes(' to ')) {
            const parts = data[field.key].split(' to ');
            if (parts.length === 2) {
              const formatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
              try {
                const d1 = new Date(parts[0] + 'T00:00:00Z').toLocaleDateString('en-US', formatOptions);
                const d2 = new Date(parts[1] + 'T00:00:00Z').toLocaleDateString('en-US', formatOptions);
                if (d1 !== 'Invalid Date' && d2 !== 'Invalid Date') {
                  valStr = `${d1} – ${d2}`;
                }
              } catch (e) { }
            }
          }

          return (
            <div key={`extra-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '3px 0', gap: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{field.label}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', textAlign: 'right', wordBreak: 'break-word' }}>
                {field.valuePrefix || ''}{valStr}{field.suffix || ''}
              </span>
            </div>
          );
        })}

        {extraFields.filter(f => f.isNote).map((field, idx) => {
          if (!data[field.key]) return null;
          return (
            <div key={`note-${idx}`} style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', fontWeight: 500, lineHeight: 1.4, textAlign: 'left' }}>
                {data[field.key]}
              </p>
            </div>
          );
        })}

        {data.top_items && data.top_items.length > 0 && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>{data.top_items_label || 'Top Items'}</p>
            {data.top_items.slice(0, 4).map((item, idx, arr) => (
              <div key={`item-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', marginBottom: idx === arr.length - 1 ? 0 : '2px' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{item.name}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginLeft: '8px', flexShrink: 0 }}>
                  {getCompactFormatter(item.revenue, isCurrency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

const MetricCard = ({ icon: Icon, label, value, color }) => (
  <PremiumCard color={color} padding="1.25rem" delay={0.05}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <p style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, margin: 0 }}>{label}</p>
      <PremiumIconBox icon={Icon} color={color} size={16} style={{ width: 32, height: 32, borderRadius: '8px', marginBottom: 0 }} />
    </div>
    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", lineHeight: 1, margin: 0 }}>{value}</p>
  </PremiumCard>
);

const EmptyChartState = ({ message = "No data available" }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
    <p style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>{message}</p>
  </div>
);

const getAllowedAggregations = (rangeStr) => {
  if (rangeStr === 'all') return ['weekly', 'monthly'];
  if (rangeStr === '90d') return ['daily', 'weekly'];
  return ['daily'];
};

const getDefaultAggregation = (rangeStr) => {
  if (rangeStr === 'all') return 'monthly';
  if (rangeStr === '90d') return 'weekly';
  return 'daily';
};

const SalesAnalysis = () => {
  const { user } = useAuth();
  const { salesState, setSalesState } = useApp();
  const [datasets, setDatasets] = useState([]);

  const [selected, setSelected] = useState(salesState.selectedDs);
  const [revenueRange, setRevenueRange] = useState('30d');
  const [revenueAggregation, setRevenueAggregation] = useState('daily');
  const [transactionRange, setTransactionRange] = useState('30d');
  const [transactionAggregation, setTransactionAggregation] = useState('daily');
  const [weekdayRange, setWeekdayRange] = useState('3m');
  const [monthlySeasonalityRange, setMonthlySeasonalityRange] = useState('all');

  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(salesState.results);
  const [exporting, setExporting] = useState(false);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  useEffect(() => {
    setSalesState({ selectedDs: selected, timePeriod: 'all', results, category: salesState.category, categories: salesState.categories });
  }, [selected, results]);

  useEffect(() => {
    if (!user?.email) return;
    setIsFetching(true);
    listDatasets(user.email).then(res => {
      const list = res.datasets || [];
      setDatasets(list);
      if (!selected && list.length > 0) {
        const first = list.find(d => d.dataset_id.startsWith('erp_') || d.dataset_id.startsWith('webhook_')) || list[0];
        setSelected(first.dataset_id);
      }
    }).catch(err => setError(err))
      .finally(() => setIsFetching(false));
  }, [user?.email]);

  const handleRevenueRangeChange = (e) => {
    const val = e.target.value;
    setRevenueRange(val);
    setRevenueAggregation(getDefaultAggregation(val));
  };

  const handleTransactionRangeChange = (e) => {
    const val = e.target.value;
    setTransactionRange(val);
    setTransactionAggregation(getDefaultAggregation(val));
  };

  const handleAnalyze = async () => {
    if (!selected) return setError('Please select a dataset.');
    if (!user?.email) return setError("User identity not confirmed.");
    setLoading(true); setError(null);
    try {
      const res = await API.post('/sales/trends', { dataset_id: selected, time_period: 'all', email: user.email });
      setResults(res);
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  };

  const handleWeekdayRangeChange = (e) => {
    setWeekdayRange(e.target.value);
  };

  const handleMonthlySeasonalityRangeChange = (e) => {
    setMonthlySeasonalityRange(e.target.value);
  };

  const handleExport = async (fmt) => {
    if (!results?.charts?.revenue_trend) return;
    setExporting(true);
    try {
      await exportReport('sales', fmt, results.charts.revenue_trend, selected, {
        'Timeframe': revenueRange.toUpperCase(),
        'Total Revenue': `$${results.kpis?.total_revenue?.toLocaleString()}`,
        'Avg Order Value': `$${results.kpis?.avg_order_value?.toFixed(2)}`,
        'Total Orders': results.kpis?.total_transactions?.toLocaleString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    finally { setExporting(false); }
  };

  const revenueControlsJsx = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
        <Calendar size={12} color="#64748B" />
        <select value={revenueRange} onChange={handleRevenueRangeChange} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          <option value="7d">Last 7 days</option>
          <option value="14d">Last 14 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All Time</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
        <BarChart2 size={12} color="#64748B" />
        <select value={revenueAggregation} onChange={e => setRevenueAggregation(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          {getAllowedAggregations(revenueRange).map(agg => (
            <option key={agg} value={agg}>{agg.charAt(0).toUpperCase() + agg.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const transactionControlsJsx = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
        <Calendar size={12} color="#64748B" />
        <select value={transactionRange} onChange={handleTransactionRangeChange} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          <option value="7d">Last 7 days</option>
          <option value="14d">Last 14 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All Time</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
        <BarChart2 size={12} color="#64748B" />
        <select value={transactionAggregation} onChange={e => setTransactionAggregation(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          {getAllowedAggregations(transactionRange).map(agg => (
            <option key={agg} value={agg}>{agg.charAt(0).toUpperCase() + agg.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const kpis = results?.kpis || {};
  const charts = results?.charts || {};
  const tables = results?.tables || {};

  const revPrefix = revenueRange === 'all' ? '' : `${revenueRange}_`;
  const currentRevenueTrend = charts[`${revPrefix}${revenueAggregation}_revenue_trend`] || [];

  const transPrefix = transactionRange === 'all' ? '' : `${transactionRange}_`;
  const currentTransactionsTrend = charts[`${transPrefix}${transactionAggregation}_transactions_trend`] || [];

  return (
    <div className="dashboard-content-fade-in">
      <Navbar
        title="Sales Analytics Dashboard"
        subtitle="Deep dive into revenue, volume, and customer patterns."
        actions={results ? (
          <>
            <select
              style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 500, minWidth: '150px' }}
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              <option value="">Dataset ID</option>
              {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
            </select>

            <button onClick={handleAnalyze} disabled={loading || !selected} style={{ padding: '0.55rem 1.25rem', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? '⏳...' : <><Play size={14} fill="currentColor" /> Run</>}
            </button>

            {results && (
              <>
                <button onClick={() => handleExport('csv')} disabled={exporting} style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => handleExport('pdf')} disabled={exporting} style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <Download size={14} /> PDF
                </button>
              </>
            )}
          </>
        ) : null}
      />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {datasets.length === 0 && !isFetching && !loading && (
        <EmptyState moduleName="Sales Analysis" />
      )}

      {!results && datasets.length > 0 && !isFetching && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="premium-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <TrendingUp size={32} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Start Sales Analysis</h3>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Select your transaction data to uncover revenue trends.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Sales Dataset</label>
                <select
                  style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, width: '100%' }}
                  value={selected}
                  onChange={e => setSelected(e.target.value)}
                >
                  <option value="">-- Select Dataset --</option>
                  {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
                </select>
              </div>



              <button onClick={handleAnalyze} disabled={!selected} style={{ padding: '0.85rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem', width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
                <Play size={16} fill="currentColor" /> Run Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {error && typeof error === 'object' && error.message ? (
        <div className="premium-card" style={{ padding: '2rem', borderLeft: '4px solid #EF4444', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626', marginBottom: '1rem' }}>Incompatible Dataset</h4>
          <p style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>{error.message}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '1rem' }}>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>Required Columns:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#64748B' }}>
                {error.required_columns?.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontSize: '0.9rem' }}>Detected Columns:</strong>
              <ul style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', listStyleType: 'none', paddingLeft: 0 }}>
                {Object.entries(error.detected_matching_columns || {}).map(([k, v]) => (
                  <li key={k} style={{ marginBottom: '2px' }}><b style={{ display: 'inline-block', width: '80px' }}>{k}:</b> <span style={{ color: v.includes('not found') ? '#EF4444' : '#10B981', fontWeight: 500 }}>{v}</span></li>
                ))}
              </ul>
            </div>
          </div>

          {error.missing_columns?.length > 0 && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#B91C1C', fontSize: '0.9rem' }}>Missing Fields:</strong>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#991B1B' }}>
                {error.missing_columns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          <p style={{ fontSize: '0.85rem', color: '#2563EB', fontWeight: 600 }}>{error.suggested_action}</p>
        </div>
      ) : (
        <ErrorMessage message={typeof error === 'string' ? error : null} />
      )}
      {loading && (
        <DashboardLoadingState 
          title="Analyzing Sales Trends"
          subtitle="Aggregating sales data and calculating trends..."
          statusText="Processing transactions..."
        />
      )}

      {results && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <MetricCard icon={DollarSign} label="Total Revenue" value={getCompactFormatter(kpis.total_revenue, true)} color="#22C55E" />
            <MetricCard icon={Receipt} label="Transactions" value={getCompactFormatter(kpis.total_transactions)} color="#3B82F6" />
            <MetricCard icon={ShoppingCart} label="Avg Order Value" value={getCompactFormatter(kpis.avg_order_value, true)} color="#A855F7" />
            <MetricCard icon={Package} label="Units Sold" value={getCompactFormatter(kpis.units_sold ?? kpis.total_quantity_sold)} color="#F59E0B" />
            <MetricCard icon={Users} label="Customers" value={getCompactFormatter(kpis.unique_customers)} color="#EC4899" />
            <MetricCard icon={RefreshCw} label="Return Rate" value={`${kpis.return_rate ?? 0}%`} color="#EF4444" />
          </div>

          {results?.metadata?.min_date && (
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.5rem', fontWeight: 500 }}>
              <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />
              Dataset Date Range: {results.metadata.min_date} to {results.metadata.max_date}
            </p>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            {/* Revenue Trend */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>Revenue Trend</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>{revenueAggregation.charAt(0).toUpperCase() + revenueAggregation.slice(1)} revenue · {revenueRange === 'all' ? 'All time' : `Last ${revenueRange.replace('d', '')} days`}</p>
                </div>
                {revenueControlsJsx}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {currentRevenueTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentRevenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} domain={[(dataMin) => Math.max(0, dataMin * 0.9), (dataMax) => dataMax * 1.05]} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                      <Line type="linear" dataKey="revenue" name="Revenue" stroke="#3B82F6" strokeWidth={3} dot={true} activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} />
                      <Brush dataKey="date" height={30} stroke="#3B82F6" tickFormatter={() => ''} style={{ fill: '#F8FAFC' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            {/* Transactions Trend */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>Transactions Trend</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>{transactionAggregation.charAt(0).toUpperCase() + transactionAggregation.slice(1)} transactions · {transactionRange === 'all' ? 'All time' : `Last ${transactionRange.replace('d', '')} days`}</p>
                </div>
                {transactionControlsJsx}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {currentTransactionsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={currentTransactionsTrend} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val)} domain={[(dataMin) => Math.max(0, dataMin * 0.9), (dataMax) => dataMax * 1.05]} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={false} />} />
                      <Line type="linear" dataKey="transactions" name="Transactions" stroke="#10B981" strokeWidth={3} dot={true} activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />
                      <Brush dataKey="date" height={30} stroke="#10B981" tickFormatter={() => ''} style={{ fill: '#F8FAFC' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Revenue by Category */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem', fontFamily: "'Manrope', sans-serif" }}>Revenue by Category</h4>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.revenue_by_category?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.revenue_by_category} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={80} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={24}>
                        {charts.revenue_by_category.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>

            {/* Units by Category */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem', fontFamily: "'Manrope', sans-serif" }}>Units Sold by Category</h4>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.units_by_category?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.units_by_category} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val)} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={80} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={false} suffix=" units" />} />
                      <Bar dataKey="units" name="Units" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24}>
                        {charts.units_by_category.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState message="No quantity data available" />}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* AOV by Category */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>AOV by Category</h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem', fontWeight: 500 }}>Average order value by category</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.aov_by_category?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.aov_by_category} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={true} extraFields={[{ key: 'revenue', label: 'Revenue', isCurrency: true }, { key: 'transactions', label: 'Transactions', isCurrency: false }]} />} />
                      <Bar dataKey="aov" name="AOV" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>

            {/* Price Band Revenue */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px', overflow: 'visible' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>Price Band Performance</h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1.25rem', fontWeight: 500 }}>Revenue by fixed Product Price intervals</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.price_band_revenue?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.price_band_revenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} />
                      <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} wrapperStyle={{ zIndex: 1000, outline: 'none' }} position={{ y: -60, x: 0 }} allowEscapeViewBox={{ x: true, y: true }} content={<CustomTooltip isCurrency={true} titlePrefix="Product Price Band" dynamicPosition={true} extraFields={[
                        { key: 'price_range', label: 'Price Range', isCurrency: false },
                        { key: 'transactions', label: 'Transactions', isCurrency: false },
                        { key: 'units', label: 'Units Sold', isCurrency: false },
                        { key: 'aov', label: 'AOV', isCurrency: true },
                        { key: 'avg_price', label: 'Avg Product Price', isCurrency: true },
                        { key: 'revenue_share', label: 'Revenue Share', isCurrency: false, suffix: '%' }
                      ]} />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40}>
                        {charts.price_band_revenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState message="No product price data available" />}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Payment Method */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem', fontFamily: "'Manrope', sans-serif" }}>Payment Method Breakdown</h4>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {charts.payment_method_breakdown?.length > 0 ? (
                  <>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={charts.payment_method_breakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {charts.payment_method_breakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {charts.payment_method_breakdown.map((entry, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span style={{ color: '#334155', fontWeight: 500, fontSize: '0.85rem' }}>{entry.name}: {getCompactFormatter(entry.revenue, true)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <EmptyChartState message="No payment method data available" />}
              </div>
            </div>

            {/* Return Rate by Category */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem', fontFamily: "'Manrope', sans-serif" }}>Return Rate by Category</h4>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.returns_by_category?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.returns_by_category} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip content={<CustomTooltip isCurrency={false} suffix="%" extraFields={[{ key: 'returned_orders', label: 'Returned Orders', isCurrency: false }, { key: 'total_orders', label: 'Known Return Records', isCurrency: false }, { key: 'unknown_returns', label: 'Unknown Returns', isCurrency: false }]} />} />
                      <Bar dataKey="return_rate" name="Return Rate" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState message="No returned orders found for the selected filters" />}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Revenue by Weekday */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>Revenue by Weekday</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
                    Combined revenue by weekday · {charts.revenue_by_weekday_ranges?.[weekdayRange]?.label || 'Last 3 Months'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <Calendar size={12} color="#64748B" />
                  <select value={weekdayRange} onChange={handleWeekdayRangeChange} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    <option value="1m">Last 1 Month</option>
                    <option value="3m">Last 3 Months</option>
                    <option value="6m">Last 6 Months</option>
                    <option value="12m">Last 12 Months</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.revenue_by_weekday_ranges?.[weekdayRange]?.data?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.revenue_by_weekday_ranges[weekdayRange].data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} tickFormatter={(val) => val.substring(0, 3)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} />
                      <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} wrapperStyle={{ zIndex: 1000, outline: 'none' }} position={{ y: -30, x: 0 }} allowEscapeViewBox={{ x: true, y: true }} content={<CustomTooltip isCurrency={true} titlePrefix="Weekday" dynamicPosition={true} extraFields={[
                        { key: 'transactions', label: 'Transactions', isCurrency: false },
                        { key: 'aov', label: 'AOV', isCurrency: true },
                        { key: 'range', label: 'Range', isCurrency: false },
                        { key: 'date_window', label: 'Date Window', isCurrency: false },
                        { key: 'context', label: 'Context', isCurrency: false }
                      ]} />} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>

            {/* Monthly Seasonality */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem', fontFamily: "'Manrope', sans-serif" }}>Monthly Revenue Seasonality</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
                    Combined revenue by calendar month · {(charts.monthly_revenue_seasonality_ranges?.[monthlySeasonalityRange]?.label || 'All Years').toLowerCase()}
                  </p>
                </div>
                {charts.monthly_revenue_seasonality_options && charts.monthly_revenue_seasonality_options.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <Calendar size={12} color="#64748B" />
                    <select value={monthlySeasonalityRange} onChange={handleMonthlySeasonalityRangeChange} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                      {charts.monthly_revenue_seasonality_options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {charts.monthly_revenue_seasonality_ranges?.[monthlySeasonalityRange]?.data?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.monthly_revenue_seasonality_ranges[monthlySeasonalityRange].data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} tickFormatter={(val) => val.substring(0, 3)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => getCompactFormatter(val, true)} />
                      <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} wrapperStyle={{ zIndex: 1000, outline: 'none' }} position={{ y: -30, x: 0 }} allowEscapeViewBox={{ x: true, y: true }} content={<CustomTooltip width={340} isCurrency={true} titlePrefix="Month" dynamicPosition={true} extraFields={[
                        { key: 'transactions', label: 'Transactions', isCurrency: false },
                        { key: 'aov', label: 'AOV', isCurrency: true },
                        { key: 'range', label: 'Range', isCurrency: false },
                        { key: 'date_window', label: 'Date Window', isCurrency: false },
                        { key: 'month_occurrences', label: 'Month Occurrences', isCurrency: false },
                        { key: 'years_included', label: 'Years Included', isCurrency: false },
                        { key: 'context', label: 'Context', isCurrency: false, isNote: true }
                      ]} />} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#0EA5E9" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: tables.top_customers?.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Top Categories Table */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>Top Categories</h4>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Revenue</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Transactions</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.top_categories?.length > 0 ? (
                      tables.top_categories.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{c.name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>{getCompactFormatter(c.revenue, true)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'right' }}>{getCompactFormatter(c.transactions)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'right' }}>{getCompactFormatter(c.aov, true)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>No categories found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Customers Table */}
            {tables.top_customers?.length > 0 && (
              <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem', fontFamily: "'Manrope', sans-serif" }}>Top Customers</h4>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Customer</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Revenue</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Transactions</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #E5E7EB', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.top_customers.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{c.name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' }}>{getCompactFormatter(c.revenue, true)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'right' }}>{getCompactFormatter(c.transactions)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748B', textAlign: 'right' }}>{getCompactFormatter(c.aov, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SalesAnalysis;

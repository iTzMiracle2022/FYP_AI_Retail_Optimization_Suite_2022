import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Box, Database,
  ArrowUpRight, ArrowRight, DollarSign, AlertTriangle,
  FileText, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from "../context/AuthContext";
import API from "../api/index";
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';

/* ─── Animated Count Up ─── */
const useCountUp = (target, duration = 1500) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (target === null || target === undefined) return;
    const num = typeof target === 'string' ? parseFloat(target.replace(/[^0-9.-]/g, '')) : target;
    if (isNaN(num)) { setCount(target); return; }
    let start = 0;
    const startTime = performance.now();
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * num));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return count;
};

/* ─── KPI Card ─── */
const KPICard = ({ title, value, icon: Icon, color, subText, subTextColor = 'var(--text-muted)' }) => {
  const displayVal = useCountUp(typeof value === 'number' ? value : null);
  
  return (
    <PremiumCard color={color} padding="1.25rem" delay={0.05}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>{title}</p>
        <PremiumIconBox icon={Icon} color={color} size={18} style={{ width: 36, height: 36, borderRadius: '10px', marginBottom: 0 }} />
      </div>
      <p 
        style={{ 
          fontSize: 'clamp(1.1rem, 2vw, 1.6rem)', 
          fontWeight: 800, color: 'var(--text-main)', 
          fontFamily: "'Manrope', sans-serif", lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
        {typeof value === 'number' 
          ? (title.includes('Revenue') 
              ? `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(displayVal)}` 
              : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(displayVal)) 
          : (value || '—')}
      </p>
      {subText && <p style={{ fontSize: '0.75rem', color: subTextColor, marginTop: '8px', fontWeight: 600 }}>{subText}</p>}
    </PremiumCard>
  );
};

const ModuleCardBottom = ({ title, desc, lastRun, link }) => (
  <Link to={link || "#"} style={{ textDecoration: 'none', minWidth: 0, display: 'block', height: '100%' }}>
    <PremiumCard color="#3B82F6" padding="1.5rem" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>{desc}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>Last run: {lastRun}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.3rem 0.6rem', background: '#EFF6FF', borderRadius: '6px' }}>
          Open <ArrowRight size={14} />
        </span>
      </div>
    </PremiumCard>
  </Link>
);

const SNAPSHOT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const CustomLegend = ({ payload }) => {
  if (!payload || !Array.isArray(payload)) return null;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {payload.map((entry, index) => {
        const val = entry?.payload?.value;
        const formattedVal = val != null && !isNaN(val) 
          ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val) 
          : '0';
        return (
          <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry?.color || '#ccc', marginRight: 8 }}></span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{entry?.value || 'Unknown'}</span>
            <span style={{ color: 'var(--text-main)', marginLeft: 'auto', fontWeight: 800 }}>
              {formattedVal}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const CustomSnapshotTooltip = ({ active, payload, title }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = payload[0].color || payload[0].payload?.fill;
    let formattedVal = data.value != null ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(data.value) : '0';
    if (title && title.includes('Sales') && data.value != null) {
      formattedVal = '$' + formattedVal;
    }
    return (
      <div style={{ background: '#fff', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color || '#ccc', marginRight: 8 }}></span>
        <span style={{ fontWeight: 600, color: '#334155' }}>{data.fullName || data.name}</span>
        <span style={{ margin: '0 4px', color: '#94A3B8' }}>:</span>
        <span style={{ color: '#0F172A', fontWeight: 700 }}>{formattedVal}</span>
      </div>
    );
  }
  return null;
};

function getShortLabel(title, name) {
  if (!name) return "Unknown";
  let shortName = name;
  if (title.includes("Churn") || title.includes("Retention")) {
    if (name.includes("Safe")) shortName = "Safe";
    if (name.includes("At Risk") || name.includes("At-Risk")) shortName = "At Risk";
  }
  if (title.includes("Marketing") || title.includes("Audience")) {
    if (name.includes("At Risk") || name.includes("At-Risk")) shortName = "Needs Attention";
    if (name.includes("Lost")) shortName = "Lost";
    if (name.includes("Champions")) shortName = "Champions";
    if (name.includes("Loyal")) shortName = "Loyal";
  }
  if (title.includes("Inventory")) {
    if (name.includes("Critical")) shortName = "Critical";
    if (name.includes("High")) shortName = "High";
    if (name.includes("Medium")) shortName = "Medium";
    if (name.includes("Low")) shortName = "Low";
  }
  return shortName;
}

function getSnapshotColor(title, name) {
  const normalized = String(name || "").toLowerCase();
  
  if (title.includes("Churn") || title.includes("Retention")) {
    if (normalized.includes("safe")) return "#10B981";
    if (normalized.includes("risk")) return "#EF4444";
  }
  
  if (title.includes("Inventory")) {
    if (normalized.includes("critical")) return "#EF4444";
    if (normalized.includes("high")) return "#F97316";
    if (normalized.includes("medium")) return "#F59E0B";
    if (normalized.includes("low")) return "#10B981";
  }
  
  if (title.includes("Marketing") || title.includes("Audience")) {
    if (normalized.includes("champion")) return "#10B981";
    if (normalized.includes("loyal")) return "#3B82F6";
    if (normalized.includes("lost")) return "#EF4444";
    if (normalized.includes("attention") || normalized.includes("engagement") || normalized.includes("risk")) return "#F59E0B";
    return "#94A3B8";
  }

  if (title.includes("Sales")) {
    if (normalized.includes("book")) return "#3B82F6";
    if (normalized.includes("cloth")) return "#10B981";
    if (normalized.includes("electronic")) return "#F59E0B";
    if (normalized.includes("home")) return "#EF4444";
  }

  const SNAPSHOT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  return SNAPSHOT_COLORS[Math.abs(hash) % SNAPSHOT_COLORS.length];
}

/* ─── Snapshot Error Boundary ─── */
class SnapshotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Snapshot Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600 }}>Unable to render this insight</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MiniSnapshotCard = ({ insight, emptyMsg, lastRun = null }) => {
  if (!insight) return null;
  const { title, subtitle, chart_type, data: rawData } = insight;
  
  const rawArray = Array.isArray(rawData) ? rawData : [];
  const safeData = rawArray.map(item => {
    const originalName = String(item?.name || item?.label || "Unnamed");
    return {
      name: getShortLabel(title, originalName),
      fullName: originalName,
      value: Number(item?.value ?? item?.count ?? 0)
    };
  }).filter(item => item.name && !isNaN(item.value) && item.value >= 0);

  const isEmpty = safeData.length === 0;

  let displayEmptyMsg = emptyMsg;
  const hasRun = Boolean(lastRun);
  if (isEmpty && hasRun) {
    if (title.includes("Inventory")) displayEmptyMsg = "No low-stock alerts";
    if (title.includes("Marketing") || title.includes("Audience")) displayEmptyMsg = "No segment insight available";
  }

  return (
    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', height: '100%' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px', fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
        <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>{subtitle}</p>
      </div>
      <div style={{ flex: 1, minHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isEmpty ? (
          <p style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, textAlign: 'center' }}>{displayEmptyMsg}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chart_type === 'bar' ? (
              <BarChart data={safeData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} width={80} tickFormatter={(v) => v.length > 12 ? v.substring(0, 12)+'...' : v} />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomSnapshotTooltip title={title} />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {safeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSnapshotColor(title, entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie data={safeData} innerRadius={35} outerRadius={55} paddingAngle={4} minAngle={15} dataKey="value" cx="40%">
                  {safeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSnapshotColor(title, entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={<CustomSnapshotTooltip title={title} />} />
                <Legend content={<CustomLegend />} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ width: '50%', right: 0 }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const isActivity = ['Sales', 'Churn', 'Inventory', 'Marketing'].includes(payload[0].payload.name);
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <p style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
          {isActivity 
            ? `${payload[0].payload.name}: ${payload[0].value} runs`
            : `${payload[0].payload.name}: $${payload[0].value.toLocaleString()}`}
        </p>
      </div>
    );
  }
  return null;
};

const timeAgo = (dateStr) => {
  if (!dateStr || dateStr === "-") return "Not run yet";
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

/* ═══════════════════════════════════════════
   DASHBOARD SKELETON
   ═══════════════════════════════════════════ */
const DashboardSkeleton = () => (
  <div style={{ paddingBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
    <header style={{ marginBottom: '1.5rem' }}>
      <div style={{ width: '300px', height: '32px', background: 'var(--border)', borderRadius: '6px', marginBottom: '8px' }} className="skeleton-pulse"></div>
      <div style={{ width: '400px', height: '16px', background: 'var(--border)', borderRadius: '4px' }} className="skeleton-pulse"></div>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {[...Array(6)].map((_, i) => <div key={i} style={{ height: '100px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} className="skeleton-pulse"></div>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ height: '380px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} className="skeleton-pulse"></div>
      <div style={{ height: '380px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} className="skeleton-pulse"></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
      {[...Array(4)].map((_, i) => <div key={i} style={{ height: '180px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }} className="skeleton-pulse"></div>)}
    </div>
    <style>{`
      .skeleton-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    `}</style>
  </div>
);

import { useApp } from '../context/AppContext';

/* ═══════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════ */
const Dashboard = () => {
  const { user } = useAuth();
  const { dashboardState, setDashboardState } = useApp();
  
  const stats = dashboardState.stats;
  const revenueTimeframe = dashboardState.revenueTimeframe;
  const activityTimeframe = dashboardState.activityTimeframe;
  
  const setRevenueTimeframe = (val) => setDashboardState(prev => ({ ...prev, revenueTimeframe: val }));
  const setActivityTimeframe = (val) => setDashboardState(prev => ({ ...prev, activityTimeframe: val }));

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const fetchStats = async () => {
    if (!user?.email) return;
    
    // Only show full skeleton on first ever load when stats is null
    const isFirstLoad = !stats;
    if (isFirstLoad) setIsInitialLoading(true);
    else setIsRefreshing(true);
    
    try {
      const res = await API.get(`/dashboard/summary?email=${user.email}&rev_days=${revenueTimeframe}&act_days=${activityTimeframe}`);
      if (res.success) setDashboardState(prev => ({ ...prev, stats: res }));
    } catch (err) {
      console.error("Dashboard API Error:", err);
    }
    
    if (isFirstLoad) setIsInitialLoading(false);
    else setIsRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
    
    // Refetch on window focus to ensure fresh data if returning from another tab
    const handleFocus = () => fetchStats();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.email, revenueTimeframe, activityTimeframe]);
  
  if (isInitialLoading && !stats) {
    return <DashboardSkeleton />;
  }
  
  const revenueData = stats?.revenue_trend || [];

  const activityData = stats?.module_activity || [];

  // Dynamic Y-axis tick calculations
  const maxRevenue = Math.max(...revenueData.map(d => d.value), 1);
  const revenueTickStep = Math.ceil(maxRevenue / 4 / 1000) * 1000;
  const revenueTicks = [0, revenueTickStep, revenueTickStep * 2, revenueTickStep * 3, revenueTickStep * 4];

  const maxActivity = Math.max(...activityData.map(d => d.value), 1);
  const activityTickStep = Math.ceil(maxActivity / 4 / 2) * 2;
  const activityTicks = [0, activityTickStep, activityTickStep * 2, activityTickStep * 3, activityTickStep * 4];

  return (
    <div style={{ paddingBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* ─── Top Header Actions ─── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Retail Performance Overview
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500, margin: 0 }}>
            A live snapshot of your retail operations across every connected dataset.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '4px' }}>
          <button 
            onClick={fetchStats}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', opacity: isRefreshing ? 0.7 : 1 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#2563EB'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            disabled={isRefreshing}
          >
             <Activity size={16} className={isRefreshing ? 'spin-anim' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
             <style>{`
               .spin-anim { animation: spin 1s linear infinite; }
               @keyframes spin { 100% { transform: rotate(360deg); } }
             `}</style>
          </button>
          <button 
            onClick={() => window.print()}
            style={{ background: '#3B82F6', border: 'none', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2563EB'}
            onMouseLeave={e => e.currentTarget.style.background = '#3B82F6'}
          >
             <ArrowUpRight size={16} /> Export
          </button>
        </div>
      </header>

      {/* ─── KPI Row (6 items) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard title="Total Revenue" value={stats?.kpis?.total_revenue || 0} icon={DollarSign} color="#10B981" subText="+12.4% vs last 30d" subTextColor="#10B981" />
        <KPICard title="Total Customers" value={stats?.kpis?.total_customers || 0} icon={Users} color="#3B82F6" />
        <KPICard title="Active Datasets" value={stats?.kpis?.active_datasets || 0} icon={Database} color="#8B5CF6" />
        <KPICard title="At-Risk Customers" value={stats?.kpis?.at_risk_raw || 0} icon={AlertTriangle} color="#EF4444" />
        <KPICard title="Low Stock Alerts" value={stats?.kpis?.low_stock || 0} icon={Box} color="#F59E0B" />
        <KPICard title="Reports Generated" value={stats?.kpis?.reports_generated || 0} icon={FileText} color="#3B82F6" />
      </div>

      {/* ─── Middle Charts ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Revenue Trend */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px', fontFamily: "'Manrope', sans-serif" }}>Revenue Trend</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Performance over time</p>
            </div>
            <select 
              value={revenueTimeframe} 
              onChange={(e) => setRevenueTimeframe(e.target.value)}
              style={{
                background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', 
                padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-main)', 
                fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div style={{ flex: 1, minHeight: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} ticks={revenueTicks} domain={[0, revenueTicks[4]]} tickFormatter={(val) => val >= 1000 ? `${val / 1000}k` : val} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module Activity */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Module Activity</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>Analysis runs in selected timeframe</p>
            </div>
            <select 
              value={activityTimeframe} 
              onChange={(e) => setActivityTimeframe(e.target.value)}
              style={{
                background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', 
                padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--text-main)', 
                fontWeight: 600, outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div style={{ flex: 1, minHeight: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} ticks={activityTicks} domain={[0, activityTicks[4]]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
      
      {/* ─── Middle Charts Row 2: Snapshots ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SnapshotErrorBoundary>
          <MiniSnapshotCard insight={stats?.module_insights?.sales} emptyMsg="Run Sales module to view insights" lastRun={stats?.module_last_runs?.sales} />
        </SnapshotErrorBoundary>
        <SnapshotErrorBoundary>
          <MiniSnapshotCard insight={stats?.module_insights?.churn} emptyMsg="Run Churn module to view insights" lastRun={stats?.module_last_runs?.churn} />
        </SnapshotErrorBoundary>
        <SnapshotErrorBoundary>
          <MiniSnapshotCard insight={stats?.module_insights?.inventory} emptyMsg="Run Inventory module to view insights" lastRun={stats?.module_last_runs?.inventory} />
        </SnapshotErrorBoundary>
        <SnapshotErrorBoundary>
          <MiniSnapshotCard insight={stats?.module_insights?.marketing} emptyMsg="Run Marketing module to view insights" lastRun={stats?.module_last_runs?.marketing} />
        </SnapshotErrorBoundary>
      </div>

      {/* ─── Bottom Module Cards (4 items) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <ModuleCardBottom 
          title="Sales Trends" 
          desc="Revenue, top products, categories." 
          lastRun={timeAgo(stats?.module_last_runs?.sales)} link="/sales" 
        />
        <ModuleCardBottom 
          title="Customer Churn" 
          desc="Identify at-risk customers." 
          lastRun={timeAgo(stats?.module_last_runs?.churn)} link="/churn" 
        />
        <ModuleCardBottom 
          title="Inventory Forecast" 
          desc="Demand and low-stock alerts." 
          lastRun={timeAgo(stats?.module_last_runs?.inventory)} link="/inventory" 
        />
        <ModuleCardBottom 
          title="Marketing Segmentation" 
          desc="RFM + sentiment clusters." 
          lastRun={timeAgo(stats?.module_last_runs?.marketing)} link="/marketing" 
        />
      </div>
    </div>
  );
};

export default Dashboard;

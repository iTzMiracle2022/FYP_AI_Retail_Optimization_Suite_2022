import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from '../components/common/Navbar';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import API from '../api/index';
import { Users, AlertTriangle, Activity, Play, ShieldCheck, TrendingUp, DollarSign, Search, Filter, Download, ChevronLeft, ChevronRight, Bookmark, SlidersHorizontal, Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './CustomerListCRM.css';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line, ComposedChart } from 'recharts';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DashboardLoadingState from '../components/common/DashboardLoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import { listDatasets } from '../api/datasetAPI';
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';


const parseDDMMYYYY = (str) => {
  if (!str || str.length !== 10) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null;
  const iso = `${y}-${m}-${d}`;
  const time = new Date(`${iso}T00:00:00`).getTime();
  if (isNaN(time)) return null;
  return iso;
};

const formatDDMMYYYY = (iso) => {
  if (!iso || !iso.includes('-')) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const MetricCard = ({ icon: Icon, label, value, color, subtitle }) => (
  <PremiumCard color={color} padding="1.25rem" delay={0.05}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
      <p style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, margin: 0 }}>{label}</p>
      <PremiumIconBox icon={Icon} color={color} size={18} style={{ width: 36, height: 36, borderRadius: '10px', marginBottom: 0 }} />
    </div>
    <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Manrope', sans-serif", lineHeight: 1.2, margin: 0 }}>{value}</p>
    {subtitle && <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.5rem', marginBottom: 0 }}>{subtitle}</p>}
  </PremiumCard>
);

const CustomTooltip = ({ active, payload, label, isCurrency = false }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const displayLabel = data.label || label || data.name;
    return (
      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '12px 16px 8px 16px', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 1000, fontFamily: "'Inter', sans-serif" }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>{displayLabel}</p>
        {payload.map((entry, index) => {
          let exactValue = entry.value;
          if (isCurrency) exactValue = `$${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          else exactValue = entry.value.toLocaleString();
          return (
            <div key={index} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: entry.color || '#3B82F6', marginRight: '6px' }}></span>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{entry.name}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginLeft: '12px' }}>{exactValue}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};


const ChartInsight = ({ children }) => {
  if (!children) return null;
  return (
    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
      <div style={{ padding: '0.75rem', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#1E3A8A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', minWidth: '16px', height: '16px', borderRadius: '50%', background: '#3B82F6', color: 'white', textAlign: 'center', lineHeight: '16px', fontSize: '10px' }}>i</span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{children}</span>
        </p>
      </div>
    </div>
  );
};

const AovTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: 'white', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#0F172A', fontSize: '0.9rem' }}>AOV Band: {data.band}</p>
        <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#64748B' }}>Range: {data.range_label}</p>
        <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#EF4444', fontSize: '0.9rem' }}>Churn Risk: {data.churn_risk}%</p>
        <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#64748B' }}>Customers: {data.customers?.toLocaleString()}</p>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#EF4444' }}>At-Risk: {data.at_risk_customers?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const ValueRiskTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const ordersItem = payload.find(p => p.dataKey === 'avg_orders');
    const aovItem = payload.find(p => p.dataKey === 'avg_aov');
    const isAtRisk = label === 'At Risk';
    
    return (
      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 1000, fontFamily: "'Inter', sans-serif", maxWidth: '300px' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
          {label === 'Safe' ? 'Safe Customers' : 'At-Risk Customers'}
        </p>
        {ordersItem && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Average Orders:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginLeft: '12px' }}>{ordersItem.value}</span>
          </div>
        )}
        {aovItem && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Average Order Value:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', marginLeft: '12px' }}>${Number(aovItem.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        {isAtRisk && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', lineHeight: 1.4 }}>
              Note: High value does not mean low risk. These customers show churn signals despite strong purchase history.
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
};

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
};

const getLabel = (item, fallback = "This segment") =>
  item?.name ||
  item?.label ||
  item?.category ||
  item?.segment ||
  item?.payment_method ||
  item?.paymentMethod ||
  item?.method ||
  item?.band ||
  item?.bucket ||
  item?.day ||
  item?.weekday ||
  fallback;

const getValue = (item, keys = []) => {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

const getTopItem = (items = [], valueKeys = []) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return [...items].sort(
    (a, b) => getValue(b, valueKeys) - getValue(a, valueKeys)
  )[0];
};

const AIBehaviorTooltip = ({ active, payload, label, type }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload || {};
  const rawLabel = data.label || data.category || data.payment_method || data.bucket || data.band || label;
  const rowLabel = type === 'riskZone' ? normalizeRiskZoneLabel(rawLabel) : (rawLabel || 'Unknown');
  const riskMeaning = {
    'Low Risk': 'Customers with comparatively stable behavior',
    Watchlist: 'Customers showing moderate behavioral risk signals',
    'High Risk': 'Highest-risk customer segment compared with the current customer base'
  };
  const rowsByType = {
    riskZone: [
      ['Risk Zone', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Avg Risk Score', data.avg_model_risk_score != null ? formatPct(data.avg_model_risk_score) : '—'],
      ['Meaning', riskMeaning[rowLabel] || 'Risk zones are based on customer behavior score bands.']
    ],
    scoreBand: [
      ['Risk Score Band', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Share', formatPct(data.percentage)]
    ],
    category: [
      ['Category', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Avg Risk Score', formatPct(data.avg_model_risk_score)],
      ['Priority Customers', formatNumber(data.high_risk_customers)],
      ['Priority Rate', formatPct(data.high_risk_rate)]
    ],
    revenue: [
      ['Category', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Revenue Exposure', formatCurrency(data.probability_weighted_revenue_exposure)],
      ['Avg Risk Score', formatPct(data.avg_model_risk_score)],
      ['Priority Customers', formatNumber(data.high_risk_customers)],
      ['Priority Rate', formatPct(data.high_risk_rate)]
    ],
    payment: [
      ['Payment Method', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Avg Risk Score', formatPct(data.avg_model_risk_score)],
      ['Priority Customers', formatNumber(data.high_risk_customers)],
      ['Priority Rate', formatPct(data.high_risk_rate)]
    ],
    recency: [
      ['Recency Bucket', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Avg Risk Score', formatPct(data.avg_model_risk_score)],
      ['Priority Customers', formatNumber(data.high_risk_customers)],
      ['Priority Rate', formatPct(data.high_risk_rate)]
    ],
    aov: [
      ['AOV Band', rowLabel],
      ['Customers', formatNumber(data.customer_count)],
      ['Avg Risk Score', formatPct(data.avg_model_risk_score)],
      ['Priority Customers', formatNumber(data.high_risk_customers)],
      ['Priority Rate', formatPct(data.high_risk_rate)]
    ],
    signal: [
      ['Signal', rowLabel],
      ['Influence', Number(data.value || 0).toFixed(4)]
    ]
  };
  const rows = rowsByType[type] || [];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '14px 16px', borderRadius: '12px', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)', zIndex: 1000, maxWidth: '320px', fontFamily: "'Inter', sans-serif" }}>
      {rows.map(([key, value], index) => (
        <div key={key} style={{ display: index === 0 ? 'block' : 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: index === rows.length - 1 ? 0 : (index === 0 ? '10px' : '6px'), paddingBottom: index === 0 ? '8px' : 0, borderBottom: index === 0 ? '1px solid #F1F5F9' : 'none' }}>
          <p style={{ margin: 0, fontSize: index === 0 ? '0.88rem' : '0.78rem', color: index === 0 ? '#0F172A' : '#64748B', fontWeight: index === 0 ? 800 : 700, lineHeight: 1.35 }}>
            {index === 0 ? value : key}
          </p>
          {index !== 0 && <p style={{ margin: 0, fontSize: '0.78rem', color: '#0F172A', fontWeight: 800, lineHeight: 1.35, textAlign: 'right' }}>{value}</p>}
        </div>
      ))}
    </div>
  );
};

const normalizeRiskZoneLabel = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '0' || normalized === 'low' || normalized === 'low risk') return 'Low Risk';
  if (normalized === '1' || normalized === 'medium' || normalized === 'medium risk' || normalized === 'watchlist') return 'Watchlist';
  if (normalized === '2' || normalized === 'high' || normalized === 'high risk') return 'High Risk';
  return value || 'Unknown';
};

const AOV_BAND_ORDER = ['Low AOV', 'Mid AOV', 'High AOV', 'Premium AOV'];

const normalizeAovBandLabel = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'low' || normalized === 'low aov' || normalized === 'low value') return 'Low AOV';
  if (normalized === 'mid' || normalized === 'medium' || normalized === 'mid aov' || normalized === 'medium aov') return 'Mid AOV';
  if (normalized === 'high' || normalized === 'high aov' || normalized === 'high value') return 'High AOV';
  if (normalized === 'premium' || normalized === 'premium aov' || normalized === 'top aov') return 'Premium AOV';
  return value || 'Unknown';
};

const getAovBandOrderIndex = (label) => {
  const index = AOV_BAND_ORDER.indexOf(normalizeAovBandLabel(label));
  return index === -1 ? AOV_BAND_ORDER.length : index;
};

const normalizeAovBandChartRows = (rows = []) => {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const label = normalizeAovBandLabel(row.label || row.band || row.name);
      return { ...row, label, name: label, band: label };
    })
    .sort((a, b) => getAovBandOrderIndex(a.label) - getAovBandOrderIndex(b.label));
};

const getAiRecommendedAction = (riskZone) => {
  const zone = normalizeRiskZoneLabel(riskZone);
  if (zone === 'High Risk') return 'Priority Outreach';
  if (zone === 'Watchlist') return 'Monitor Customer';
  if (zone === 'Low Risk') return 'Retain Customer';
  return '-';
};

const getRiskZoneClass = (riskZone) => {
  const zone = normalizeRiskZoneLabel(riskZone);
  if (zone === 'High Risk') return 'at-risk';
  if (zone === 'Watchlist') return 'medium';
  if (zone === 'Low Risk') return 'safe';
  return 'muted';
};

const getActionClass = (action) => {
  if (action === 'Priority Outreach') return 'outreach';
  if (action === 'Monitor Customer') return 'review';
  return 'monitor';
};

const buildAiBehaviorCharts = (snapshot = [], topSignals = []) => {
  const rows = Array.isArray(snapshot) ? snapshot : [];
  const total = rows.length;
  const pct = (count, base = total) => base > 0 ? Number(((count / base) * 100).toFixed(1)) : 0;
  const avg = (items, key) => {
    if (!items.length) return 0;
    return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / items.length;
  };

  const riskOrder = ['Low Risk', 'Watchlist', 'High Risk'];
  const ai_predicted_risk_distribution = riskOrder.map(zone => {
    const customerCount = rows.filter(row => normalizeRiskZoneLabel(row.risk_zone) === zone).length;
    return {
      label: zone,
      name: zone,
      risk_zone: zone,
      customer_count: customerCount,
      percentage: pct(customerCount),
      avg_model_risk_score: Number(avg(rows.filter(row => normalizeRiskZoneLabel(row.risk_zone) === zone), 'risk_score_percent').toFixed(1))
    };
  });

  const bandLabels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
  const bandCounts = Object.fromEntries(bandLabels.map(band => [band, 0]));
  rows.forEach(row => {
    const score = Math.max(0, Math.min(100, Number(row.risk_score_percent) || 0));
    const index = Math.min(Math.floor(score / 20), 4);
    const band = bandLabels[index];
    bandCounts[band] = (bandCounts[band] || 0) + 1;
  });
  const risk_score_bands = bandLabels.map(band => ({
    label: band,
    name: band,
    customer_count: bandCounts[band] || 0,
    percentage: pct(bandCounts[band] || 0)
  }));

  const groupedRisk = (groupKey, outputKey) => {
    const groups = new Map();
    rows.forEach(row => {
      const key = outputKey === 'aov' ? normalizeAovBandLabel(row[groupKey]) : (row[groupKey] || 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries())
      .map(([key, items]) => {
        const highRisk = items.filter(row => normalizeRiskZoneLabel(row.risk_zone) === 'High Risk').length;
        const displayLabel = String(key || 'Unknown');
        const base = {
          label: displayLabel,
          name: displayLabel,
          customer_count: items.length,
          avg_model_risk_score: Number(avg(items, 'risk_score_percent').toFixed(1)),
          high_risk_customers: highRisk,
          high_risk_rate: pct(highRisk, items.length)
        };
        if (outputKey === 'category') return { category: displayLabel, ...base };
        if (outputKey === 'payment') return { payment_method: displayLabel, ...base };
        if (outputKey === 'recency') return { bucket: displayLabel, ...base };
        return { band: displayLabel, ...base };
      })
      .sort((a, b) => (
        outputKey === 'aov'
          ? getAovBandOrderIndex(a.label) - getAovBandOrderIndex(b.label)
          : b.avg_model_risk_score - a.avg_model_risk_score
      ));
  };

  const categoryGroups = new Map();
  rows.forEach(row => {
    const key = row.primary_product_category || 'Unknown';
    if (!categoryGroups.has(key)) categoryGroups.set(key, []);
    categoryGroups.get(key).push(row);
  });
  const ai_revenue_at_risk_by_category = Array.from(categoryGroups.entries())
    .map(([category, items]) => {
      const exposure = items.reduce((sum, item) => sum + ((Number(item.total_revenue) || 0) * (Number(item.model_churn_probability) || 0)), 0);
      return {
        category,
        label: category,
        name: category,
        customer_count: items.length,
        probability_weighted_revenue_exposure: Number(exposure.toFixed(2)),
        avg_model_risk_score: Number(avg(items, 'risk_score_percent').toFixed(1)),
        high_risk_customers: items.filter(row => normalizeRiskZoneLabel(row.risk_zone) === 'High Risk').length,
        high_risk_rate: pct(items.filter(row => normalizeRiskZoneLabel(row.risk_zone) === 'High Risk').length, items.length)
      };
    })
    .sort((a, b) => b.probability_weighted_revenue_exposure - a.probability_weighted_revenue_exposure)
    ;

  return {
    filtered_total_customers: total,
    ai_predicted_risk_distribution,
    risk_score_bands,
    ai_risk_by_category: groupedRisk('primary_product_category', 'category'),
    ai_revenue_at_risk_by_category,
    ai_risk_by_payment_method: groupedRisk('primary_payment_method', 'payment'),
    ai_risk_by_recency_bucket: groupedRisk('recency_bucket', 'recency'),
    ai_risk_by_aov_band: groupedRisk('aov_band', 'aov'),
    top_ai_churn_signals: topSignals
  };
};

const ChurnPrediction = () => {
  const { user } = useAuth();
  const { churnState, setChurnState } = useApp();
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState(churnState.selectedDataset);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(churnState.results);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('All');
  const [aiRiskZoneFilter, setAiRiskZoneFilter] = useState('All');
  const [timeRangeFilter, setTimeRangeFilter] = useState('All Time');
  const [atRiskTrendTimeframe, setAtRiskTrendTimeframe] = useState('all_time');
  const [churnRiskTrendTimeframe, setChurnRiskTrendTimeframe] = useState('all_time');
  const [weekdayTimeframe, setWeekdayTimeframe] = useState('all_time');
  const [seasonalityYear, setSeasonalityYear] = useState('all_years');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [aiBehaviorFilters, setAiBehaviorFilters] = useState({
    riskZone: 'All',
    category: 'All',
    paymentMethod: 'All',
    recencyBucket: 'All',
    aovBand: 'All'
  });
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const defaultAdvancedFilters = {
    category: 'All Categories',
    paymentMethod: 'All Payment Methods',
    gender: 'All Genders',
    returns: 'All',
    minOrders: '', maxOrders: '',
    minRevenue: '', maxRevenue: '',
    minAOV: '', maxAOV: '',
    minAge: '', maxAge: ''
  };
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState(defaultAdvancedFilters);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState(defaultAdvancedFilters);
  
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const defaultDateRange = { start: '', end: '' };
  const [draftDateRange, setDraftDateRange] = useState(defaultDateRange);
  const [appliedDateRange, setAppliedDateRange] = useState(defaultDateRange);
  const ITEMS_PER_PAGE = 10;

  const getAdvancedFilterCount = (filters) => {
    let count = 0;
    if (filters.category && filters.category !== 'All Categories') count++;
    if (filters.paymentMethod && filters.paymentMethod !== 'All Payment Methods') count++;
    if (filters.gender && filters.gender !== 'All Genders') count++;
    if (filters.returns && filters.returns !== 'All') count++;
    if (filters.minOrders || filters.maxOrders) count++;
    if (filters.minRevenue || filters.maxRevenue) count++;
    if (filters.minAOV || filters.maxAOV) count++;
    if (filters.minAge || filters.maxAge) count++;
    return count;
  };

  const dateRangeRef = useRef(null);
  const advancedFiltersRef = useRef(null);

  const handleToggleDateRange = () => {
    setIsAdvancedFiltersOpen(false);
    if (!isDateRangeOpen) {
      setDraftDateRange(appliedDateRange);
    }
    setIsDateRangeOpen((prev) => !prev);
  };

  const handleToggleAdvancedFilters = () => {
    setIsDateRangeOpen(false);
    if (!isAdvancedFiltersOpen) {
      setDraftAdvancedFilters(appliedAdvancedFilters);
    }
    setIsAdvancedFiltersOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDateRangeOpen && dateRangeRef.current && !dateRangeRef.current.contains(event.target)) {
        setIsDateRangeOpen(false);
      }
      if (isAdvancedFiltersOpen && advancedFiltersRef.current && !advancedFiltersRef.current.contains(event.target)) {
        setIsAdvancedFiltersOpen(false);
      }
    };
    
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDateRangeOpen(false);
        setIsAdvancedFiltersOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDateRangeOpen, isAdvancedFiltersOpen]);

  const canShowHistoricalStatus = Boolean(results && (results.can_show_historical_status ?? results.has_actual_churn_label ?? true));
  const canShowAiRisk = Boolean(results && (results.can_show_ai_risk ?? (results.customer_summary || []).some(row => row.ai_risk_zone || row.ai_churn_estimate !== undefined)));
  const customerTableColSpan = 1 + 6 + (canShowHistoricalStatus ? 1 : 0) + (canShowAiRisk ? 3 : 0);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, customerStatusFilter, aiRiskZoneFilter, timeRangeFilter, appliedAdvancedFilters, appliedDateRange]);
  useEffect(() => { setChurnState({ selectedDataset: selected, results }); }, [selected, results, setChurnState]);
  useEffect(() => {
    if (!canShowHistoricalStatus && customerStatusFilter !== 'All') {
      setCustomerStatusFilter('All');
    }
  }, [canShowHistoricalStatus, customerStatusFilter]);
  useEffect(() => {
    setAiBehaviorFilters({
      riskZone: 'All',
      category: 'All',
      paymentMethod: 'All',
      recencyBucket: 'All',
      aovBand: 'All'
    });
    setAiRiskZoneFilter('All');
  }, [results?.dataset_id]);

  useEffect(() => {
    if (results?.chart_data?.monthly_churn_seasonality) {
      if (seasonalityYear !== 'all_years' && !results.chart_data.monthly_churn_seasonality[seasonalityYear]) {
        setSeasonalityYear('all_years');
      }
    }
  }, [results, seasonalityYear]);

  useEffect(() => {
    if (!user?.email) return;
    setIsFetching(true);
    listDatasets(user.email).then(res => {
      const list = res.datasets || [];
      setDatasets(list);
      if (!selected && list.length > 0) {
        const enterprise = list.find(d => d.dataset_id.startsWith('erp_') || d.dataset_id.startsWith('webhook_'));
        setSelected(enterprise ? enterprise.dataset_id : list[0].dataset_id);
      }
    }).catch(err => setError(err)).finally(() => setIsFetching(false));
  }, [user?.email]);

  const handleAnalyze = async () => {
    if (!selected) return setError('Please select a dataset.');
    if (!user?.email) return setError("User identity not confirmed.");
    setLoading(true); setError(null);
    try {
      const res = await API.post('/churn/predict', { dataset_id: selected, email: user.email }, { timeout: 120000 });
      if (!res || res.success === false) throw new Error(res?.error || "Prediction failed");
      setResults(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to run churn prediction.");
    } finally {
      setLoading(false);
    }
  };

  const normalizedCustomerRows = useMemo(() => {
    if (!results?.customer_summary && !results?.predictions) return [];
    const data = results.customer_summary || results.predictions;
    return data.map(c => {
      const historicalStatus = canShowHistoricalStatus
        ? (c.historical_status || c.status || c.risk_level || c.riskLevel || null)
        : null;
      const aiRiskZone = canShowAiRisk ? normalizeRiskZoneLabel(c.ai_risk_zone) : null;
      const aiChurnEstimate = c.ai_churn_estimate ?? null;
      const aiRecommendedAction = c.ai_recommended_action || getAiRecommendedAction(aiRiskZone);
      return {
        id: c.customer_ref_id || c.customer_id || c.id || '-',
        name: c.customer_name || c.name || '',
        email: c.email || '',
        orders: c.orders || c.order_count || c.total_orders || 0,
        revenue: c.revenue || c.total_revenue || 0,
        aov: c.aov || c.avg_order_value || 0,
        lastOrder: c.last_order || c.last_order_date || '-',
        historicalStatus,
        riskLevel: historicalStatus || 'Unknown',
        aiChurnEstimate,
        aiRiskZone,
        aiRecommendedAction,
        action: aiRecommendedAction,
        categories: c.categories || [],
        paymentMethods: c.payment_methods || [],
        returns: c.returns || 0,
        age: c.age || '',
        gender: c.gender || '',
        transactions: c.transactions || []
      };
    });
  }, [results, canShowHistoricalStatus, canShowAiRisk]);

  const datasetBounds = useMemo(() => {
    const responseBounds = results?.dataset_bounds || {};
    if (responseBounds.min_date && responseBounds.max_date) {
      const minDate = new Date(`${responseBounds.min_date}T00:00:00`);
      const maxDate = new Date(`${responseBounds.max_date}T00:00:00`);
      if (!isNaN(minDate.getTime()) && !isNaN(maxDate.getTime())) {
        return {
          minDatasetDate: minDate,
          maxDatasetDate: maxDate,
          minDatasetStr: responseBounds.min_date,
          maxDatasetStr: responseBounds.max_date,
          minDatasetDisplay: formatDDMMYYYY(responseBounds.min_date),
          maxDatasetDisplay: formatDDMMYYYY(responseBounds.max_date)
        };
      }
    }
    let max = 0;
    let min = Infinity;
    normalizedCustomerRows.forEach(r => {
      r.transactions?.forEach(tx => {
        if (tx.date) {
           const dStr = tx.date.includes('T') ? tx.date : `${tx.date}T00:00:00`;
           const d = new Date(dStr).getTime();
           if (!isNaN(d)) {
             if (d > max) max = d;
             if (d < min) min = d;
           }
        }
      });
    });
    const minDate = min !== Infinity ? new Date(min) : new Date('2020-01-01');
    const maxDate = max > 0 ? new Date(max) : new Date();
    return {
      minDatasetDate: minDate,
      maxDatasetDate: maxDate,
      minDatasetStr: minDate.toISOString().split('T')[0],
      maxDatasetStr: maxDate.toISOString().split('T')[0],
      minDatasetDisplay: formatDDMMYYYY(minDate.toISOString()),
      maxDatasetDisplay: formatDDMMYYYY(maxDate.toISOString())
    };
  }, [normalizedCustomerRows, results?.dataset_bounds]);

  const filteredRows = useMemo(() => {
    let rows = normalizedCustomerRows.map(r => ({...r})); // clone to allow dynamic recalculation

    // 1. Timeframe / Date Range Recalculation
    let isTimeRestricted = false;
    let validStart = null, validEndExclusive = null;

    if (appliedDateRange.start && appliedDateRange.end) {
      isTimeRestricted = true;
      const isoStart = parseDDMMYYYY(appliedDateRange.start);
      const isoEnd = parseDDMMYYYY(appliedDateRange.end);
      if (isoStart && isoEnd) {
        validStart = new Date(`${isoStart}T00:00:00`).getTime();
        const endExclusive = new Date(`${isoEnd}T00:00:00`);
        endExclusive.setDate(endExclusive.getDate() + 1);
        validEndExclusive = endExclusive.getTime();
      }
    } else if (timeRangeFilter !== 'All Time') {
      let days = 0;
      if (timeRangeFilter === 'Last 30 Days') days = 30;
      else if (timeRangeFilter === 'Last 90 Days') days = 90;
      else if (timeRangeFilter === 'Last 6 Months') days = 180;
      else if (timeRangeFilter === 'Last 12 Months') days = 365;

      if (days > 0) {
        isTimeRestricted = true;
        validEndExclusive = datasetBounds.maxDatasetDate.getTime() + 86400000;
        validStart = datasetBounds.maxDatasetDate.getTime() - (days * 86400000);
      }
    }

    if (isTimeRestricted) {
      rows = rows.filter(r => {
        if (!r.transactions || r.transactions.length === 0) {
          if (!r.lastOrder || r.lastOrder === '-') return false;
          const lastOrderStr = r.lastOrder.includes('T') ? r.lastOrder : `${r.lastOrder}T00:00:00`;
          const lastOrderTime = new Date(lastOrderStr).getTime();
          return !isNaN(lastOrderTime) && lastOrderTime >= validStart && lastOrderTime < validEndExclusive;
        }
        
        const validTxs = r.transactions.filter(tx => {
          if (!tx.date) return false;
          // Parse strictly to avoid timezone shifts
          const dStr = tx.date.includes('T') ? tx.date : `${tx.date}T00:00:00`;
          const tTime = new Date(dStr).getTime();
          return tTime >= validStart && tTime < validEndExclusive;
        });

        if (validTxs.length === 0) return false;

        r.orders = validTxs.length;
        r.revenue = validTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        r.aov = r.orders > 0 ? r.revenue / r.orders : 0;
        
        const latest = validTxs.reduce((max, tx) => {
          const tTime = new Date(tx.date).getTime();
          return tTime > max ? tTime : max;
        }, 0);
        r.lastOrder = new Date(latest).toISOString().split('T')[0];
        
        // returns if available per tx
        if (validTxs[0].returns !== undefined) {
           r.returns = validTxs.reduce((sum, tx) => sum + (Number(tx.returns) || 0), 0);
        }
        
        // Ensure advanced filters test only scoped categories/payments
        r.categories = [...new Set(validTxs.map(tx => tx.category).filter(Boolean))];
        r.paymentMethods = [...new Set(validTxs.map(tx => tx.payment_method).filter(Boolean))];
        return true;
      });
    }

    // 2. Search Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase().trim();
      rows = rows.filter(r => 
        (r.name && r.name.toLowerCase().includes(lower)) || 
        (r.id && String(r.id).toLowerCase().includes(lower))
      );
    }

    // 3. Historical Status Filter
    if (canShowHistoricalStatus && customerStatusFilter !== 'All') {
      const target = customerStatusFilter === 'Safe' ? 'Safe' : 'At Risk';
      rows = rows.filter(r => r.historicalStatus === target);
    }

    // 4. AI Risk Zone Filter
    if (canShowAiRisk && aiRiskZoneFilter !== 'All') {
      rows = rows.filter(r => normalizeRiskZoneLabel(r.aiRiskZone) === aiRiskZoneFilter);
    }

    // 5. Advanced Filters
    if (appliedAdvancedFilters.category !== 'All Categories') {
      rows = rows.filter(r => r.categories && r.categories.includes(appliedAdvancedFilters.category));
    }
    if (appliedAdvancedFilters.paymentMethod !== 'All Payment Methods') {
      rows = rows.filter(r => r.paymentMethods && r.paymentMethods.includes(appliedAdvancedFilters.paymentMethod));
    }
    if (appliedAdvancedFilters.gender !== 'All Genders') {
      rows = rows.filter(r => String(r.gender).toLowerCase() === appliedAdvancedFilters.gender.toLowerCase());
    }
    if (appliedAdvancedFilters.returns !== 'All') {
      if (appliedAdvancedFilters.returns === 'Has Returns') rows = rows.filter(r => r.returns > 0);
      if (appliedAdvancedFilters.returns === 'No Returns') rows = rows.filter(r => !r.returns || r.returns === 0);
    }
    if (appliedAdvancedFilters.minOrders) rows = rows.filter(r => r.orders >= Number(appliedAdvancedFilters.minOrders));
    if (appliedAdvancedFilters.maxOrders) rows = rows.filter(r => r.orders <= Number(appliedAdvancedFilters.maxOrders));
    if (appliedAdvancedFilters.minRevenue) rows = rows.filter(r => r.revenue >= Number(appliedAdvancedFilters.minRevenue));
    if (appliedAdvancedFilters.maxRevenue) rows = rows.filter(r => r.revenue <= Number(appliedAdvancedFilters.maxRevenue));
    if (appliedAdvancedFilters.minAOV) rows = rows.filter(r => r.aov >= Number(appliedAdvancedFilters.minAOV));
    if (appliedAdvancedFilters.maxAOV) rows = rows.filter(r => r.aov <= Number(appliedAdvancedFilters.maxAOV));
    if (appliedAdvancedFilters.minAge) rows = rows.filter(r => r.age >= Number(appliedAdvancedFilters.minAge));
    if (appliedAdvancedFilters.maxAge) rows = rows.filter(r => r.age <= Number(appliedAdvancedFilters.maxAge));

    // 6. Sorting
    const sortByRevenueThenRecent = (a, b) => {
      const revenueDiff = Number(b.revenue || 0) - Number(a.revenue || 0);
      if (revenueDiff !== 0) return revenueDiff;
      
      const dateA = new Date(a.lastOrder || 0).getTime();
      const dateB = new Date(b.lastOrder || 0).getTime();
      return dateB - dateA;
    };
    const sortByAiPriorityThenRevenue = (a, b) => {
      const priority = { 'High Risk': 0, Watchlist: 1, 'Low Risk': 2 };
      const priorityDiff = (priority[normalizeRiskZoneLabel(a.aiRiskZone)] ?? 3) - (priority[normalizeRiskZoneLabel(b.aiRiskZone)] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      return sortByRevenueThenRecent(a, b);
    };

    if (canShowHistoricalStatus && customerStatusFilter === 'All') {
      const atRisk = rows.filter(c => c.historicalStatus === 'At Risk').sort(sortByRevenueThenRecent);
      const safe = rows.filter(c => c.historicalStatus === 'Safe').sort(sortByRevenueThenRecent);
      const unknown = rows.filter(c => c.historicalStatus !== 'At Risk' && c.historicalStatus !== 'Safe').sort(sortByAiPriorityThenRevenue);

      const mixed = [];
      let r = 0;
      let s = 0;

      while (r < atRisk.length || s < safe.length) {
        if (r < atRisk.length) mixed.push(atRisk[r++]);
        if (s < safe.length) mixed.push(safe[s++]);
        if (s < safe.length) mixed.push(safe[s++]);
      }
      rows = [...mixed, ...unknown];
    } else if (canShowAiRisk && aiRiskZoneFilter === 'All') {
      rows.sort(sortByAiPriorityThenRevenue);
    } else {
      rows.sort(sortByRevenueThenRecent);
    }

    const uniqueCustomerCount = new Set(rows.map(row => row.name)).size;
    if (rows.length !== uniqueCustomerCount) {
      console.warn("Customer List duplication detected", {
        rowCount: rows.length,
        uniqueCustomerCount,
        duplicates: rows.length - uniqueCustomerCount
      });
    } else {
      console.log("Customer List Deduplication Audit PASS:", {
        rowCount: rows.length,
        uniqueCustomerCount
      });
    }

    return rows;
  }, [normalizedCustomerRows, searchTerm, customerStatusFilter, aiRiskZoneFilter, timeRangeFilter, datasetBounds, appliedAdvancedFilters, appliedDateRange, canShowHistoricalStatus, canShowAiRisk]);

  const validateDateRange = () => {
    if (!draftDateRange.start || !draftDateRange.end) return "";
    
    const isoStart = parseDDMMYYYY(draftDateRange.start);
    const isoEnd = parseDDMMYYYY(draftDateRange.end);
    
    if (!isoStart || !isoEnd) return "Invalid date format. Use DD/MM/YYYY.";
    
    const s = new Date(`${isoStart}T00:00:00`).getTime();
    const e = new Date(`${isoEnd}T00:00:00`).getTime();
    if (isNaN(s) || isNaN(e)) return "Invalid date format.";
    if (s > e) return "Start date cannot be after end date.";
    
    const minT = datasetBounds.minDatasetDate.getTime();
    const maxT = datasetBounds.maxDatasetDate.getTime();
    
    if (s < minT) return `Start date cannot be before ${datasetBounds.minDatasetDisplay}.`;
    if (e > maxT) return `End date cannot be after ${datasetBounds.maxDatasetDisplay}.`;
    
    if (new Date(isoStart).getFullYear() < 2000) return "Year must be realistic.";
    return "";
  };
  const currentDateError = validateDateRange();

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const kpis = results?.summary || results?.kpis || {};
  const meta = results?.metadata || {};
  const totalCustomers = kpis.total_customers || results?.total_customers || 0;
  const transactionsAnalyzed = kpis.transactions_analyzed || kpis.total_transactions || results?.total_transactions || 0;
  const safeCustomers = kpis.safe_customers || results?.safe_customers || 0;
  const atRiskCustomers = kpis.at_risk_customers || results?.at_risk_customers || 0;
  const churnRiskPercentage = kpis.churn_risk_percentage || ((atRiskCustomers / (totalCustomers || 1)) * 100) || 0;
  const featureImportance = results?.feature_importance || {};
  const chartData = results?.chart_data || {};
  const aiChurnAnalysis = results?.ai_churn_analysis || {};
  const aiBehaviorSnapshot = aiChurnAnalysis.ai_behavior_snapshot || [];
  const aiFilterCount = Object.values(aiBehaviorFilters).filter(value => value !== 'All').length;
  const aiBehaviorFilterOptions = useMemo(() => {
    const options = aiChurnAnalysis.filter_options || {};
    const fromSnapshot = (key) => [...new Set(aiBehaviorSnapshot.map(row => row?.[key]).filter(Boolean).map(String))].sort();
    const riskZones = [...new Set((options.risk_zones || ['Low Risk', 'Watchlist', 'High Risk']).map(normalizeRiskZoneLabel))].filter(zone => zone !== 'Unknown');
    const sourceAovBands = options.aov_bands?.length ? options.aov_bands : fromSnapshot('aov_band');
    return {
      riskZones,
      categories: options.categories || fromSnapshot('primary_product_category'),
      paymentMethods: options.payment_methods || fromSnapshot('primary_payment_method'),
      recencyBuckets: options.recency_buckets || ['0-30 days', '31-60 days', '61-90 days', '91-180 days', '180+ days'],
      aovBands: [...new Set((sourceAovBands.length ? sourceAovBands : AOV_BAND_ORDER).map(normalizeAovBandLabel))]
        .filter(band => band !== 'Unknown')
        .sort((a, b) => getAovBandOrderIndex(a) - getAovBandOrderIndex(b))
    };
  }, [aiChurnAnalysis.filter_options, aiBehaviorSnapshot]);
  const filteredAiBehaviorSnapshot = useMemo(() => {
    if (aiFilterCount === 0) return aiBehaviorSnapshot;
    return aiBehaviorSnapshot.filter(row => {
      if (aiBehaviorFilters.riskZone !== 'All' && normalizeRiskZoneLabel(row.risk_zone) !== aiBehaviorFilters.riskZone) return false;
      if (aiBehaviorFilters.category !== 'All' && row.primary_product_category !== aiBehaviorFilters.category) return false;
      if (aiBehaviorFilters.paymentMethod !== 'All' && row.primary_payment_method !== aiBehaviorFilters.paymentMethod) return false;
      if (aiBehaviorFilters.recencyBucket !== 'All' && row.recency_bucket !== aiBehaviorFilters.recencyBucket) return false;
      if (aiBehaviorFilters.aovBand !== 'All' && normalizeAovBandLabel(row.aov_band) !== aiBehaviorFilters.aovBand) return false;
      return true;
    });
  }, [aiBehaviorSnapshot, aiBehaviorFilters, aiFilterCount]);
  const filteredAiBehaviorCharts = useMemo(() => {
    if (aiFilterCount > 0 && aiBehaviorSnapshot.length > 0) {
      return buildAiBehaviorCharts(filteredAiBehaviorSnapshot, aiChurnAnalysis.top_ai_churn_signals || []);
    }
    return aiChurnAnalysis;
  }, [aiFilterCount, aiBehaviorSnapshot, filteredAiBehaviorSnapshot, aiChurnAnalysis]);
  const aiRiskByAovBandData = useMemo(() => {
    return normalizeAovBandChartRows(filteredAiBehaviorCharts.ai_risk_by_aov_band || []);
  }, [filteredAiBehaviorCharts.ai_risk_by_aov_band]);
  const handleAiBehaviorFilterChange = (key, value) => {
    setAiBehaviorFilters(prev => ({ ...prev, [key]: value }));
  };
  const resetAiBehaviorFilters = () => {
    setAiBehaviorFilters({
      riskZone: 'All',
      category: 'All',
      paymentMethod: 'All',
      recencyBucket: 'All',
      aovBand: 'All'
    });
  };

  const getChartInsight = (type) => {
    const data = chartData;
    switch (type) {
      case 'risk_distribution': {
        const safe = data.risk_distribution?.find(d => d.name.includes("Safe"))?.value || 0;
        const atRisk = data.risk_distribution?.find(d => d.name.includes("At-Risk"))?.value || 0;
        const total = safe + atRisk;
        if (total === 0) return "Customer risk distribution is available for retention prioritization.";
        const pct = (atRisk / total) * 100;
        return `At-Risk customers represent ${formatPct(pct)} of the customer base, so retention should focus on the highest-value risk accounts first.`;
      }
      case 'churn_drivers': {
        const drivers = data.churn_drivers || [];
        const top = getTopItem(drivers, ["value", "impact"]);
        if (!top) return "No dominant churn signal is detected across the available drivers.";
        const label = getLabel(top);
        const valStr = top.value_label ? ` at +${top.value_label}` : '';
        return `${label} shows the strongest churn signal concentration compared to the overall average${valStr}.`;
      }
      case 'risk_by_category': {
        const catRisk = data.risk_by_category || [];
        const top = getTopItem(catRisk, ["risk_rate", "risk_percent", "churn_risk", "at_risk_customers"]);
        if (!top) return "Category risk is evenly distributed across product groups.";
        const label = getLabel(top);
        const rate = getValue(top, ["risk_rate", "risk_percent", "churn_risk"]);
        return `${label} has the highest category risk at ${formatPct(rate)}, making it a priority for retention review.`;
      }
      case 'revenue_at_risk_by_category': {
        const revRisk = data.revenue_at_risk_by_category || [];
        const top = getTopItem(revRisk, ["revenue_at_risk", "revenueAtRisk"]);
        if (!top) return "Revenue-at-risk data is available for category-level retention planning.";
        const label = getLabel(top);
        const amount = getValue(top, ["revenue_at_risk", "revenueAtRisk"]);
        return `${label} has the highest revenue at risk at ${formatCurrency(amount)}, making it the top business-impact category.`;
      }
      case 'risk_by_payment_method': {
        const payRisk = data.risk_by_payment_method || [];
        const top = getTopItem(payRisk, ["at_risk_customers", "atRiskCustomers", "value", "count"]);
        if (!top) return "Payment method risk patterns are available for retention segmentation.";
        const label = getLabel(top);
        const count = getValue(top, ["at_risk_customers", "atRiskCustomers", "value", "count"]);
        return `${label} has the largest at-risk group with ${formatNumber(count)} customers.`;
      }
      case 'return_behavior': {
        const ret = data.return_behavior_by_risk_segment || [];
        const safe = ret.find(r => (r.risk_segment || '').toLowerCase().includes('safe'));
        const risk = ret.find(r => (r.risk_segment || '').toLowerCase().includes('risk'));
        if (!safe || !risk) return "Return behavior data is available for risk comparison.";
        const safeRate = getValue(safe, ["return_rate"]);
        const riskRate = getValue(risk, ["return_rate"]);
        if (riskRate > safeRate + 1) return `At-Risk customers show a higher return rate (${formatPct(riskRate)}) than Safe customers (${formatPct(safeRate)}), suggesting returns may be a retention signal.`;
        if (safeRate > riskRate + 1) return `Safe customers show a higher return rate (${formatPct(safeRate)}), so returns alone may not explain churn risk in this dataset.`;
        return `Return behavior is similar across Safe and At-Risk groups, so returns may not be a major differentiator.`;
      }
      case 'recency_buckets': {
        const rec = data.customer_recency_buckets || [];
        const top = getTopItem(rec, ["at_risk_customers", "atRiskCustomers", "risk_rate"]);
        if (!top) return "Recency buckets help identify customers who may need re-engagement.";
        const label = getLabel(top);
        const count = getValue(top, ["at_risk_customers", "atRiskCustomers"]);
        return `The ${label} bucket contains ${formatNumber(count)} at-risk customers, making it the top win-back priority.`;
      }
      case 'customer_value': {
        const val = data.orders_aov_by_risk_segment || [];
        const safe = val.find(r => (r.risk_segment || '').toLowerCase().includes('safe'));
        const risk = val.find(r => (r.risk_segment || '').toLowerCase().includes('risk'));
        if (!safe || !risk) return "Customer value data helps prioritize high-impact retention.";
        const safeOrders = getValue(safe, ["avg_orders"]);
        const riskOrders = getValue(risk, ["avg_orders"]);
        const safeAOV = getValue(safe, ["avg_aov"]);
        const riskAOV = getValue(risk, ["avg_aov"]);
        if (riskOrders > safeOrders) return `At-Risk customers place more orders on average (${formatNumber(riskOrders)} vs ${formatNumber(safeOrders)}), making retention outreach more valuable.`;
        if (riskAOV > safeAOV) return `At-Risk customers have a higher average order value (${formatCurrency(riskAOV)} vs ${formatCurrency(safeAOV)}), increasing potential revenue impact if they churn.`;
        return `Safe customers currently show stronger purchase value, while At-Risk customers still need monitoring.`;
      }
      case 'weekday': {
        const wd = data.churn_activity_by_weekday?.[weekdayTimeframe] || [];
        const top = getTopItem(wd, ["at_risk_customers", "atRiskCustomers", "count", "value"]);
        if (!top) return "Weekday churn activity is available for timing retention actions.";
        const label = getLabel(top);
        const count = getValue(top, ["at_risk_customers", "atRiskCustomers", "count", "value"]);
        return `${label} shows the highest churn activity with ${formatNumber(count)} at-risk events in the selected period.`;
      }
      case 'price_sensitivity': {
        const ps = data.price_sensitivity || [];
        const top = getTopItem(ps, ["churn_risk", "risk_rate"]);
        if (!top) return "AOV band risk data is available for spending-segment retention review.";
        const label = getLabel(top);
        const rate = getValue(top, ["churn_risk", "risk_rate"]);
        return `${label} customers show the highest churn risk at ${formatPct(rate)}, making this spending segment a priority for retention review.`;
      }
      default: return "";
    }
  };

  const riskDistributionData = (chartData.risk_distribution || []).map(item => ({
    ...item,
    color: item.name === 'Safe Customers' ? '#10B981' : '#EF4444'
  }));
  const churnDriversData = chartData.churn_drivers || [];
  
  const processTrendData = (trendArray, isMonthly = false) => {
    if (!trendArray || trendArray.length < 3) return trendArray;
    const result = [...trendArray];
    const last = result[result.length - 1];
    
    if (isMonthly) {
      const isLastMonthIncomplete = (datasetMaxDate) => {
        if (!datasetMaxDate) return false;
        const year = datasetMaxDate.getFullYear();
        const month = datasetMaxDate.getMonth();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const datasetDay = datasetMaxDate.getDate();
        return datasetDay < lastDayOfMonth;
      };
      
      const maxDate = datasetBounds.maxDatasetDate;
      const lastPointDate = new Date(last.period);
      const isSameMonth = !isNaN(lastPointDate) && 
        lastPointDate.getFullYear() === maxDate.getFullYear() && 
        lastPointDate.getMonth() === maxDate.getMonth();
        
      if (isSameMonth && isLastMonthIncomplete(maxDate)) {
        result.pop();
      }
    } else {
      const slice = result.slice(Math.max(0, result.length - 6), result.length - 1);
      const avg = slice.reduce((sum, item) => sum + (item.at_risk_customers || item.customers || item.value || item.risk_percent || item.risk_rate || 0), 0) / slice.length;
      const lastVal = last.at_risk_customers || last.customers || last.value || last.risk_percent || last.risk_rate || 0;
      
      // In python backend: last_30_days uses %Y-%m-%d, last_90_days uses %Y-%m-%d
      const maxDateStr = datasetBounds.maxDatasetStr;
      const isSameDay = last.period === maxDateStr || last.period >= maxDateStr; 
      
      if (isSameDay && avg > 0 && lastVal < avg * 0.5) {
        result.pop();
      }
    }
    
    return result;
  };

  const rawAtRiskTrend = chartData.at_risk_customers_trend?.[atRiskTrendTimeframe] || [];
  const isAtRiskMonthly = ['last_6_months', 'last_12_months', 'all_time'].includes(atRiskTrendTimeframe);
  const atRiskCustomersTrend = processTrendData(rawAtRiskTrend, isAtRiskMonthly);

  const rawChurnRiskTrend = chartData.churn_risk_trend?.[churnRiskTrendTimeframe] || [];
  const isChurnRiskMonthly = ['last_6_months', 'last_12_months', 'all_time'].includes(churnRiskTrendTimeframe);
  const churnRiskTrend = processTrendData(rawChurnRiskTrend, isChurnRiskMonthly);
  const riskByCategory = chartData.risk_by_category || [];
  const revenueAtRiskByCategory = chartData.revenue_at_risk_by_category || [];
  const riskByPaymentMethod = (chartData.risk_by_payment_method || []).map((item, i) => ({
    ...item,
    color: ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#6366F1'][i % 6]
  }));
  const returnBehaviorByRiskSegment = chartData.return_behavior_by_risk_segment || [];
  const customerRecencyBuckets = chartData.customer_recency_buckets || [];
  const ordersAovByRiskSegment = chartData.orders_aov_by_risk_segment || [];
  const churnActivityByWeekday = chartData.churn_activity_by_weekday?.[weekdayTimeframe] || [];
  const monthlyChurnSeasonality = chartData.monthly_churn_seasonality?.[seasonalityYear] || [];
  const priceSensitivity = chartData.price_sensitivity || [];

  const handleExportCSV = () => {
    const targetRows = selectedRows.size > 0
      ? filteredRows.filter(r => selectedRows.has(r.id))
      : filteredRows;

    if (!targetRows || targetRows.length === 0) return;

    const headers = ['Customer Name', 'Ref ID', 'Orders', 'Revenue', 'AOV', 'Last Order'];
    if (canShowHistoricalStatus) headers.push('Historical Status');
    if (canShowAiRisk) headers.push('AI Churn Est.', 'AI Risk Zone', 'AI Recommended Action');
    headers.push('Categories', 'Payment Methods', 'Returns', 'Age', 'Gender');
    const csvContent = [
      headers.join(','),
      ...targetRows.map(r => {
        const aiEstimate = r.aiChurnEstimate !== null && r.aiChurnEstimate !== undefined && !Number.isNaN(Number(r.aiChurnEstimate))
          ? `${Number(r.aiChurnEstimate).toFixed(1)}%`
          : '';
        const name = `"${(r.name || '').replace(/"/g, '""')}"`;
        const id = `"${(r.id || '').toString().replace(/"/g, '""')}"`;
        const orders = `"${r.orders || 0}"`;
        const revenue = `"${r.revenue || 0}"`;
        const aov = `"${r.aov || 0}"`;
        const lastOrder = `"${r.lastOrder || ''}"`;
        const rowValues = [name, id, orders, revenue, aov, lastOrder];
        if (canShowHistoricalStatus) rowValues.push(`"${r.historicalStatus || ''}"`);
        if (canShowAiRisk) {
          rowValues.push(
            `"${aiEstimate}"`,
            `"${r.aiRiskZone || ''}"`,
            `"${r.aiRecommendedAction || ''}"`
          );
        }
        const cats = `"${(r.categories || []).join(' | ')}"`;
        const pmts = `"${(r.paymentMethods || []).join(' | ')}"`;
        const rets = `"${r.returns || 0}"`;
        const age = `"${r.age || ''}"`;
        const gender = `"${r.gender || ''}"`;
        return [...rowValues, cats, pmts, rets, age, gender].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `churn_customers_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-content-fade-in">
      <style>{`
        .churnChartGrid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 20px;
          align-items: stretch;
          width: 100%;
          margin-bottom: 2rem;
        }
        .churnChartCard {
          width: 100%;
          height: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .churnFullWidthCard {
          grid-column: 1 / -1 !important;
        }
        @media (max-width: 768px) {
          .churnChartGrid {
            grid-template-columns: 1fr !important;
          }
          .churnFullWidthCard {
            grid-column: auto !important;
          }
        }
      `}</style>
      <Navbar title="Customer Churn Prediction" subtitle="Identify at-risk customers before they leave using AI behavioral analysis." actions={
        results && (
          <>
            <select style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', minWidth: '150px' }} value={selected} onChange={e => setSelected(e.target.value)}>
              {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
            </select>
            <button onClick={handleAnalyze} disabled={loading} style={{ padding: '0.55rem 1.25rem', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? '⏳...' : <><Play size={14} fill="currentColor" /> Run</>}
            </button>
            <button style={{ padding: '0.55rem 1rem', background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> CSV
            </button>
            <button style={{ padding: '0.55rem 1rem', background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> PDF
            </button>
          </>
        )
      } />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {datasets.length === 0 && !isFetching && !loading && <EmptyState moduleName="Churn Analysis" />}
      {!results && datasets.length > 0 && !isFetching && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="premium-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <AlertTriangle size={32} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Start AI Analysis</h3>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Identify at-risk customers through behavioral churn analysis.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Select Dataset</label>
                <select
                  style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, width: '100%', outline: 'none', cursor: 'pointer' }}
                  value={selected}
                  onChange={e => setSelected(e.target.value)}
                >
                  <option value="">-- Select Dataset --</option>
                  {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
                </select>
              </div>

              <button onClick={handleAnalyze} disabled={!selected} style={{ padding: '0.85rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem', width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
                <Play size={16} fill="currentColor" /> Run Prediction
              </button>
            </div>
          </div>
        </div>
      )}

      <ErrorMessage message={error} />

      {loading && (
        <DashboardLoadingState 
          title="Analyzing Customer Risk"
          subtitle="Please wait while we process customer behavior and generate churn predictions."
          statusText="Calculating risk signals..."
        />
      )}

      {results && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <MetricCard icon={Users} label="Total Customers" value={totalCustomers.toLocaleString()} color="#3B82F6" />
            <MetricCard icon={Activity} label="Transactions Analyzed" value={transactionsAnalyzed.toLocaleString()} color="#8B5CF6" />
            {canShowHistoricalStatus && (
              <>
                <MetricCard icon={ShieldCheck} label="Safe Customers" value={safeCustomers.toLocaleString()} color="#10B981" />
                <MetricCard icon={AlertTriangle} label="At-Risk Customers" value={atRiskCustomers.toLocaleString()} color="#EF4444" />
                <MetricCard icon={TrendingUp} label="Churn Risk" value={`${churnRiskPercentage.toFixed(2)}%`} color="#F59E0B" />
              </>
            )}
          </div>

          {/* AI Behavioral Churn Signals Section */}
          {results?.ai_churn_analysis && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>AI Behavioral Churn Signals</h3>
                <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0 }}>Customer-level behavioral patterns learned from purchase activity, frequency, revenue, recency, returns, and value trends.</p>
              </div>

              {aiBehaviorSnapshot.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  {[
                    ['riskZone', 'Risk Zone', ['All', ...aiBehaviorFilterOptions.riskZones]],
                    ['category', 'Category', ['All', ...aiBehaviorFilterOptions.categories]],
                    ['paymentMethod', 'Payment Method', ['All', ...aiBehaviorFilterOptions.paymentMethods]],
                    ['recencyBucket', 'Recency Bucket', ['All', ...aiBehaviorFilterOptions.recencyBuckets]],
                    ['aovBand', 'AOV Band', ['All', ...aiBehaviorFilterOptions.aovBands]]
                  ].map(([key, label, options]) => (
                    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
                      <select
                        value={aiBehaviorFilters[key]}
                        onChange={event => handleAiBehaviorFilterChange(key, event.target.value)}
                        style={{ width: '100%', minWidth: 0, fontSize: '0.85rem', padding: '0.55rem 2rem 0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', outline: 'none', cursor: 'pointer' }}
                      >
                        {options.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{formatNumber(filteredAiBehaviorCharts.filtered_total_customers || 0)} customers</p>
                    <button
                      type="button"
                      onClick={resetAiBehaviorFilters}
                      disabled={aiFilterCount === 0}
                      style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: aiFilterCount === 0 ? '#F1F5F9' : '#FFFFFF', color: aiFilterCount === 0 ? '#94A3B8' : '#0F172A', cursor: aiFilterCount === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 800 }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {/* AI Charts Grid Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Behavioral Risk Zone Distribution</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Risk zones are based on customer behavior score bands.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.ai_predicted_risk_distribution?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={filteredAiBehaviorCharts.ai_predicted_risk_distribution}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={90}
                            paddingAngle={2}
                            minAngle={6}
                            dataKey="customer_count"
                            nameKey="label"
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          >
                            {filteredAiBehaviorCharts.ai_predicted_risk_distribution.map((entry, index) => {
                              const colors = { 'High Risk': '#EF4444', Watchlist: '#F59E0B', 'Low Risk': '#10B981' };
                              return <Cell key={`cell-${index}`} fill={colors[entry.label] || '#94A3B8'} />;
                            })}
                          </Pie>
                          <RechartsTooltip content={<AIBehaviorTooltip type="riskZone" />} />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>

                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Risk Score Bands</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Customer distribution across predicted churn-risk score ranges.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.risk_score_bands?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.risk_score_bands} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="scoreBand" />} />
                          <Bar dataKey="customer_count" name="Customers" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Charts Grid Row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Behavioral Risk by Category</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Average risk score grouped by customers' primary purchase category.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.ai_risk_by_category?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.ai_risk_by_category} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="category" />} />
                          <Bar dataKey="avg_model_risk_score" name="Avg Risk Score" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>

                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Estimated Revenue Exposure</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Revenue exposure estimated from customer risk scores, grouped by primary category.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.ai_revenue_at_risk_by_category?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.ai_revenue_at_risk_by_category} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="revenue" />} />
                          <Bar dataKey="probability_weighted_revenue_exposure" name="Revenue Exposure" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Charts Grid Row 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Behavioral Risk by Payment Method</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Average risk score grouped by customers' primary payment behavior.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.ai_risk_by_payment_method?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.ai_risk_by_payment_method} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} width={100} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="payment" />} />
                          <Bar dataKey="avg_model_risk_score" name="Avg Risk Score" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>

                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Behavioral Risk by Recency</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Risk score grouped by how recently customers last purchased.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.ai_risk_by_recency_bucket?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.ai_risk_by_recency_bucket} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="recency" />} />
                          <Bar dataKey="avg_model_risk_score" name="Avg Risk Score" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Charts Grid Row 4 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Behavioral Risk by AOV Band</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Risk score grouped by customer average order value range.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {aiRiskByAovBandData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aiRiskByAovBandData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="aov" />} />
                          <Bar dataKey="avg_model_risk_score" name="Avg Risk Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>

                <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Top Behavioral Churn Signals</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Most influential customer behavior signals behind the risk scoring.</p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {filteredAiBehaviorCharts.top_ai_churn_signals?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredAiBehaviorCharts.top_ai_churn_signals} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} width={140} />
                          <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AIBehaviorTooltip type="signal" />} />
                          <Bar dataKey="value" name="Signal Strength" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                       <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', height: '100%' }}>
                         <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Behavior fields were not returned for this dataset.</p>
                       </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {canShowHistoricalStatus && (
            <>
          {/* Section 3: Trend Analytics Row */}
          <div style={{ marginBottom: '1.5rem', marginTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Historical Churn Analysis</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0 }}>Actual churn patterns calculated from historical customer data.</p>
          </div>
          <div className="churnChartGrid">
            <div className="premium-card churnChartCard churnFullWidthCard" style={{ padding: '1.5rem', height: '380px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>At-Risk Customers Trend</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>At-risk customer movement over selected period.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={atRiskTrendTimeframe}
                    onChange={e => setAtRiskTrendTimeframe(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '4px 28px 4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748B\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                  >
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="last_90_days">Last 90 Days</option>
                    <option value="last_6_months">Last 6 Months</option>
                    <option value="last_12_months">Last 12 Months</option>
                    <option value="all_time">All Time</option>
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {atRiskCustomersTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={atRiskCustomersTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Line type="monotone" dataKey="at_risk_customers" name="At-Risk Customers" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>Trend data will appear after backend trend mapping is available.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="premium-card churnChartCard churnFullWidthCard" style={{ padding: '1.5rem', height: '380px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Churn Risk Trend</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Percentage of customers at risk over selected period.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={churnRiskTrendTimeframe}
                    onChange={e => setChurnRiskTrendTimeframe(e.target.value)}
                    style={{ fontSize: '0.85rem', padding: '4px 28px 4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748B\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                  >
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="last_90_days">Last 90 Days</option>
                    <option value="last_6_months">Last 6 Months</option>
                    <option value="last_12_months">Last 12 Months</option>
                    <option value="all_time">All Time</option>
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {churnRiskTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={churnRiskTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} formatter={(val) => [`${val}%`, 'Churn Risk']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Line type="monotone" dataKey="risk_percent" name="Churn Risk" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>Trend data will appear after backend trend mapping is available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Customer Behavior Breakdown */}
          <div className="churnChartGrid">
            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Risk by Category</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>At-risk customers grouped by product category.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {riskByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskByCategory} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} formatter={(val, name, props) => {
                          if (name === 'risk_rate') return [`${val}%`, 'Risk Rate'];
                          return [val, name];
                      }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Bar dataKey="risk_rate" name="Risk Rate" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('risk_by_category')}
              </ChartInsight>
            </div>

            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Revenue at Risk by Category</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>Revenue exposure across churn-risk categories.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {revenueAtRiskByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueAtRiskByCategory} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} formatter={(val) => [`$${val.toLocaleString()}`, 'Revenue at Risk']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Bar dataKey="revenue_at_risk" name="Revenue at Risk" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('revenue_at_risk_by_category')}
              </ChartInsight>
            </div>

            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Risk by Payment Method</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>Risk concentration by payment behavior.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {riskByPaymentMethod.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie data={riskByPaymentMethod} innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="at_risk_customers" nameKey="payment_method">
                      {riskByPaymentMethod.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip isCurrency={false} />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span style={{ color: '#334155', fontWeight: 500, fontSize: '0.85rem' }}>{value}</span>} />
                  </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('risk_by_payment_method')}
              </ChartInsight>
            </div>

            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Return Behavior by Risk Segment</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>Return rate comparison between safe and at-risk customers.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {returnBehaviorByRiskSegment.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={returnBehaviorByRiskSegment} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="risk_segment" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} formatter={(val) => [`${val}%`, 'Return Rate']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Bar dataKey="return_rate" name="Return Rate" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('return_behavior')}
              </ChartInsight>
            </div>
          </div>

          {/* Section 5: Recency and Value Analysis */}
          <div className="churnChartGrid">
            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Customer Recency Buckets</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>Customers grouped by last purchase recency.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {customerRecencyBuckets.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerRecencyBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      <Bar dataKey="safe_customers" name="Safe Customers" stackId="a" fill="#10B981" />
                      <Bar dataKey="at_risk_customers" name="At-Risk Customers" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('recency_buckets')}
              </ChartInsight>
            </div>

            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Customer Value by Risk Segment</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 0.5rem 0' }}>Compares average orders and spending value for Safe vs At-Risk customers.</p>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '0 0 1.5rem 0', fontStyle: 'italic', lineHeight: 1.4 }}>At-Risk customers can still be high-value buyers. Higher orders or AOV means greater revenue impact if they churn.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {ordersAovByRiskSegment.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ordersAovByRiskSegment} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="risk_segment" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip content={<ValueRiskTooltip />} cursor={{ fill: '#F8FAFC' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      <Bar yAxisId="left" dataKey="avg_orders" name="Average Orders" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                      <Line yAxisId="right" type="monotone" dataKey="avg_aov" name="Average Order Value" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('customer_value')}
              </ChartInsight>
            </div>
          </div>

          {/* Section 6: Seasonal / Time Behavior */}
          <div className="churnChartGrid">
            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Churn Activity by Weekday</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Customer churn-risk activity across weekdays.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={weekdayTimeframe}
                    onChange={e => setWeekdayTimeframe(e.target.value)}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: '0.8rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="last_90_days">Last 90 Days</option>
                    <option value="last_6_months">Last 6 Months</option>
                    <option value="last_12_months">Last 12 Months</option>
                    <option value="all_time">All Time</option>
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {churnActivityByWeekday.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={churnActivityByWeekday} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="weekday" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                      <Bar dataKey="at_risk_customers" name="At-Risk Customers" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('weekday')}
              </ChartInsight>
            </div>

            <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Churn Risk by AOV Band</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>Shows how churn risk changes across customer spending levels.</p>
              <div style={{ flex: 1, minHeight: 0 }}>
                {priceSensitivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceSensitivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} interval={0} height={35} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<AovTooltip />} />
                      <Bar dataKey="churn_risk" name="Churn Risk" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                  </div>
                )}
              </div>
              <ChartInsight>
                {getChartInsight('price_sensitivity')}
              </ChartInsight>
            </div>
          </div>

          <div className="premium-card churnChartCard" style={{ padding: '1.5rem', height: '380px', display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Monthly Churn Seasonality</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 1.5rem 0' }}>Month-level churn behavior across selected years.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={seasonalityYear}
                  onChange={e => setSeasonalityYear(e.target.value)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: '0.8rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
                >
                  <option value="all_years">All Years</option>
                  {chartData?.monthly_churn_seasonality && Object.keys(chartData.monthly_churn_seasonality)
                    .filter(key => key !== 'all_years')
                    .sort((a, b) => Number(a) - Number(b))
                    .map(year => (
                      <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {monthlyChurnSeasonality.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChurnSeasonality} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                    <RechartsTooltip cursor={{ fill: '#F8FAFC' }} formatter={(val) => [`${val}%`, 'Risk Rate']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }} />
                    <Line type="monotone" dataKey="risk_rate" name="Risk Rate" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0' }}>
                  <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>This visualization is prepared for churn analytics data.</p>
                </div>
              )}
            </div>
          </div>
            </>
          )}

          {/* CRM Customer List Table */}
          <div className="crm-customer-card" style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="crm-header">
              <div className="crm-header-top">
                <div>
                  <h3 className="crm-header-title">Customer List</h3>
                  <p className="crm-header-subtitle">AI-driven customer retention priority list.</p>
                </div>
                <div className="crm-toolbar">
                  <button className="crm-toolbar-btn" onClick={handleExportCSV}><Download size={14} /> Export CSV</button>
                  <div className="crm-toolbar-divider"></div>
                  
                  <div style={{ position: 'relative' }} ref={dateRangeRef}>
                    <button className="crm-toolbar-btn" onClick={handleToggleDateRange} style={{ background: (appliedDateRange.start && appliedDateRange.end) ? '#EFF6FF' : '', borderColor: (appliedDateRange.start && appliedDateRange.end) ? '#BFDBFE' : '' }}>
                      <Calendar size={14} /> {(appliedDateRange.start && appliedDateRange.end) ? `${appliedDateRange.start} → ${appliedDateRange.end}` : 'Date Range'}
                    </button>
                    {isDateRangeOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 50, background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '280px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0F172A', fontWeight: 600 }}>Custom Date Range</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>Start Date</label>
                            <input type="text" placeholder="DD/MM/YYYY" maxLength={10} value={draftDateRange.start} onChange={e => {
                              let val = e.target.value;
                              if (draftDateRange.start && draftDateRange.start.length > val.length) { setDraftDateRange({...draftDateRange, start: val}); return; }
                              let num = val.replace(/\D/g, '');
                              if (num.length > 8) num = num.slice(0, 8);
                              let fmt = num;
                              if (num.length >= 3) fmt = num.slice(0, 2) + '/' + num.slice(2);
                              if (num.length >= 5) fmt = fmt.slice(0, 5) + '/' + num.slice(4);
                              setDraftDateRange({...draftDateRange, start: fmt});
                            }} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>End Date</label>
                            <input type="text" placeholder="DD/MM/YYYY" maxLength={10} value={draftDateRange.end} onChange={e => {
                              let val = e.target.value;
                              if (draftDateRange.end && draftDateRange.end.length > val.length) { setDraftDateRange({...draftDateRange, end: val}); return; }
                              let num = val.replace(/\D/g, '');
                              if (num.length > 8) num = num.slice(0, 8);
                              let fmt = num;
                              if (num.length >= 3) fmt = num.slice(0, 2) + '/' + num.slice(2);
                              if (num.length >= 5) fmt = fmt.slice(0, 5) + '/' + num.slice(4);
                              setDraftDateRange({...draftDateRange, end: fmt});
                            }} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                          </div>
                          {currentDateError && (
                            <p style={{ color: '#EF4444', fontSize: '0.75rem', margin: 0 }}>{currentDateError}</p>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button onClick={() => { setDraftDateRange(defaultDateRange); setAppliedDateRange(defaultDateRange); setIsDateRangeOpen(false); setCurrentPage(1); }} style={{ flex: 1, padding: '8px', background: '#F1F5F9', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Clear</button>
                            <button disabled={!!currentDateError || !draftDateRange.start || !draftDateRange.end} onClick={() => { if(!currentDateError && draftDateRange.start && draftDateRange.end) { setAppliedDateRange(draftDateRange); setTimeRangeFilter('All Time'); setIsDateRangeOpen(false); setCurrentPage(1); } }} style={{ flex: 1, padding: '8px', background: (!!currentDateError || !draftDateRange.start || !draftDateRange.end) ? '#94A3B8' : '#3B82F6', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'white', cursor: (!!currentDateError || !draftDateRange.start || !draftDateRange.end) ? 'not-allowed' : 'pointer' }}>Apply</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <select className="crm-toolbar-select" value={timeRangeFilter} onChange={e => { setTimeRangeFilter(e.target.value); setDraftDateRange(defaultDateRange); setAppliedDateRange(defaultDateRange); setCurrentPage(1); }}>
                    <option value="All Time">All Time</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                    <option value="Last 90 Days">Last 90 Days</option>
                    <option value="Last 6 Months">Last 6 Months</option>
                    <option value="Last 12 Months">Last 12 Months</option>
                  </select>
                  {canShowHistoricalStatus && (
                    <select className="crm-toolbar-select" value={customerStatusFilter} onChange={e => setCustomerStatusFilter(e.target.value)}>
                      <option value="All">All Customers</option>
                      <option value="Safe">Safe</option>
                      <option value="At Risk">At Risk</option>
                    </select>
                  )}
                  {canShowAiRisk && (
                    <select className="crm-toolbar-select" value={aiRiskZoneFilter} onChange={e => setAiRiskZoneFilter(e.target.value)}>
                      <option value="All">All AI Risk</option>
                      <option value="Low Risk">Low Risk</option>
                      <option value="Watchlist">Watchlist</option>
                      <option value="High Risk">High Risk</option>
                    </select>
                  )}
                  
                  <div style={{ position: 'relative' }} ref={advancedFiltersRef}>
                    <button className="crm-toolbar-btn" onClick={handleToggleAdvancedFilters} style={{ background: getAdvancedFilterCount(appliedAdvancedFilters) > 0 ? '#EFF6FF' : '', borderColor: getAdvancedFilterCount(appliedAdvancedFilters) > 0 ? '#BFDBFE' : '' }}>
                      <SlidersHorizontal size={14} /> Advanced Filters {getAdvancedFilterCount(appliedAdvancedFilters) > 0 ? `(${getAdvancedFilterCount(appliedAdvancedFilters)})` : ''}
                    </button>
                    {isAdvancedFiltersOpen && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 50, background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', width: '600px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        
                        {/* Column 1 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: 700, gridColumn: 'span 2' }}>Advanced Filters</h4>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Product Category</label>
                            <select value={draftAdvancedFilters.category} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, category: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <option value="All Categories">All Categories</option>
                              {Array.from(new Set(normalizedCustomerRows.flatMap(r => r.categories || []))).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Payment Method</label>
                            <select value={draftAdvancedFilters.paymentMethod} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, paymentMethod: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <option value="All Payment Methods">All Payment Methods</option>
                              {Array.from(new Set(normalizedCustomerRows.flatMap(r => r.paymentMethods || []))).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Gender</label>
                            <select value={draftAdvancedFilters.gender} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, gender: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <option value="All Genders">All Genders</option>
                              {Array.from(new Set(normalizedCustomerRows.map(r => String(r.gender)))).filter(g => g !== 'undefined' && g !== 'null' && g).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Returns Behavior</label>
                            <select value={draftAdvancedFilters.returns} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, returns: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <option value="All">All</option>
                              <option value="Has Returns">Has Returns</option>
                              <option value="No Returns">No Returns</option>
                            </select>
                          </div>
                        </div>

                        {/* Column 2 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '32px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Orders Range</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="Min" value={draftAdvancedFilters.minOrders} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, minOrders: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                              <input type="number" placeholder="Max" value={draftAdvancedFilters.maxOrders} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, maxOrders: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Revenue Range ($)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="Min" value={draftAdvancedFilters.minRevenue} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, minRevenue: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                              <input type="number" placeholder="Max" value={draftAdvancedFilters.maxRevenue} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, maxRevenue: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>AOV Range ($)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="Min" value={draftAdvancedFilters.minAOV} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, minAOV: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                              <input type="number" placeholder="Max" value={draftAdvancedFilters.maxAOV} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, maxAOV: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', fontWeight: 600 }}>Age Range</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="number" placeholder="Min" value={draftAdvancedFilters.minAge} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, minAge: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                              <input type="number" placeholder="Max" value={draftAdvancedFilters.maxAge} onChange={e => setDraftAdvancedFilters({...draftAdvancedFilters, maxAge: e.target.value})} style={{ width: '50%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} />
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                          <button onClick={() => {
                            setDraftAdvancedFilters(defaultAdvancedFilters); setAppliedAdvancedFilters(defaultAdvancedFilters); setCurrentPage(1);
                            setIsAdvancedFiltersOpen(false);
                          }} style={{ padding: '10px 20px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Clear Filters</button>
                          <button onClick={() => { setAppliedAdvancedFilters(draftAdvancedFilters); setIsAdvancedFiltersOpen(false); setCurrentPage(1); }} style={{ flex: 1, padding: '10px 20px', background: '#3B82F6', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Apply Filters</button>
                        </div>
                        
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="crm-search-row">
              <div className="crm-search-wrapper" style={{ width: '100%', maxWidth: '350px' }}>
                <Search className="crm-search-icon" size={16} />
                <input type="text" className="crm-search-input" placeholder="Search Customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="crm-result-count">{filteredRows.length} customers found</span>
              </div>
            </div>

            {selectedRows.size > 0 && (
              <div className="crm-selection-bar">
                <span>{selectedRows.size} customers selected</span>
                <button onClick={() => setSelectedRows(new Set())}>Clear selection</button>
              </div>
            )}

            <div className="crm-table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        className="crm-checkbox header-checkbox"
                        checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedRows.has(r.id))}
                        onChange={e => {
                          const next = new Set(selectedRows);
                          if (e.target.checked) paginatedRows.forEach(r => next.add(r.id));
                          else paginatedRows.forEach(r => next.delete(r.id));
                          setSelectedRows(next);
                        }}
                      />
                    </th>
                    <th>CUSTOMER NAME</th>
                    <th>REF ID</th>
                    <th>ORDERS</th>
                    <th>REVENUE</th>
                    <th>AOV</th>
                    <th>LAST ORDER</th>
                    {canShowHistoricalStatus && <th>HISTORICAL STATUS</th>}
                    {canShowAiRisk && (
                      <>
                        <th>AI CHURN EST.</th>
                        <th>AI RISK ZONE</th>
                        <th>AI RECOMMENDED ACTION</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((p, i) => {
                    const isHighRisk = p.historicalStatus === 'At Risk';
                    const isSafe = p.historicalStatus === 'Safe';

                    const statusClass = isHighRisk ? 'at-risk' : isSafe ? 'safe' : 'muted';
                    const aiRiskClass = getRiskZoneClass(p.aiRiskZone);
                    const actionClass = getActionClass(p.aiRecommendedAction);
                    const isSelected = selectedRows.has(p.id);
                    const initials = p.name !== '-' && p.name ? p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '';

                    const fmtRevenue = p.revenue !== '-' ? `$${Number(p.revenue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '-';
                    const fmtAov = p.aov !== '-' ? `$${Number(p.aov).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '-';
                    const fmtAiChurnEstimate = p.aiChurnEstimate !== null && p.aiChurnEstimate !== undefined && !Number.isNaN(Number(p.aiChurnEstimate))
                      ? `${Number(p.aiChurnEstimate).toFixed(1)}%`
                      : '-';

                    return (
                      <tr key={p.id + '-' + i} style={{ background: isSelected ? '#F0F7FF' : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            className="crm-checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedRows);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              setSelectedRows(next);
                            }}
                          />
                        </td>
                        <td>
                          <div className="crm-customer-cell">
                            {p.name && p.name !== '-' ? (
                              <div className="crm-customer-avatar">{initials}</div>
                            ) : (
                              <div className="crm-customer-avatar"><Users size={14} /></div>
                            )}
                            <div className="crm-customer-info">
                              <span className="crm-customer-name">{p.name && p.name !== '-' ? p.name : p.id}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="crm-value muted">#{String(p.id).replace(/\D/g, '') || p.id}</span></td>
                        <td><span className="crm-value">{p.orders}</span></td>
                        <td><span className={`crm-value ${fmtRevenue !== '-' ? 'revenue' : 'muted'}`}>{fmtRevenue}</span></td>
                        <td><span className={`crm-value ${fmtAov !== '-' ? '' : 'muted'}`}>{fmtAov}</span></td>
                        <td><span className={`crm-value ${p.lastOrder !== '-' ? '' : 'muted'}`}>{p.lastOrder}</span></td>
                        {canShowHistoricalStatus && (
                          <td>
                            <span className={`crm-status-badge ${statusClass}`}>
                              <span className="status-dot" />
                              {p.historicalStatus || '-'}
                            </span>
                          </td>
                        )}
                        {canShowAiRisk && (
                          <>
                            <td><span className={`crm-value ${fmtAiChurnEstimate !== '-' ? '' : 'muted'}`} title="Estimated from customer behavior patterns.">{fmtAiChurnEstimate}</span></td>
                            <td>
                              <span className={`crm-status-badge ${aiRiskClass}`}>
                                <span className="status-dot" />
                                {p.aiRiskZone || '-'}
                              </span>
                            </td>
                            <td>
                              <span className={`crm-action-label ${actionClass}`}>{p.aiRecommendedAction || '-'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={customerTableColSpan}>
                        <div className="crm-empty-state">
                          <AlertTriangle className="crm-empty-icon" size={32} />
                          <h4 className="crm-empty-title">No customers found</h4>
                          <p className="crm-empty-desc">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 0 && (
              <div className="crm-pagination">
                <div className="crm-pagination-info">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} customers
                </div>
                <div className="crm-pagination-controls">
                  <button className="crm-page-btn nav-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {(() => {
                    const pages = [];
                    const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1);
                    visiblePages.forEach((p, i) => {
                      if (i > 0 && visiblePages[i - 1] !== p - 1) {
                        pages.push(<span key={`e-${p}`} className="crm-page-ellipsis">…</span>);
                      }
                      pages.push(
                        <button key={p} className={`crm-page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>
                          {p}
                        </button>
                      );
                    });
                    return pages;
                  })()}
                  <button className="crm-page-btn nav-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ChurnPrediction;

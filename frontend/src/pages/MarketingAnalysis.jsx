import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import Navbar from '../components/common/Navbar';
import MarketingChart from '../components/charts/MarketingChart';
import DataExplorerChart from '../components/charts/DataExplorerChart';
import DashboardLoadingState from '../components/common/DashboardLoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { listDatasets } from '../api/datasetAPI';
import { exportReport } from '../api/reportAPI';
import API from '../api/index';
import html2canvas from 'html2canvas';
import { Users, Target, Award, Activity, Download, BarChart as BarChartIcon, Play, ArrowLeft, DollarSign, TrendingUp, Percent, Gem, Sparkles, Search, ChevronLeft, ChevronRight, ArrowUpDown, WalletCards, AlertTriangle, FileText, ChevronDown, Check, PieChart, ShoppingCart, Smartphone, Package, Globe, UserCheck, Megaphone, CheckCircle2, RefreshCw, BarChart2 } from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../context/AuthContext';
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';

const SEGMENT_COLORS = {
  'Champions': '#16A34A',
  'Loyal Customers': '#2563EB',
  'At-Risk Customers': '#D97706',
  'At-Risk Customers A': '#D97706',
  'At-Risk Customers B': '#7C3AED',
  'Lost Customers': '#DC2626',
  'Potential Loyalists': '#0891B2',
  'Recent Customers': '#0D9488',
};

const getSegmentColor = (name) => {
  if (SEGMENT_COLORS[name]) return SEGMENT_COLORS[name];
  const family = String(name || '').replace(/\s+[A-Z]$/, '');
  return SEGMENT_COLORS[family] || '#2563EB';
};

const getCountPrecision = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || Number.isInteger(number) || Math.abs(number) >= 1000) return 0;
  const decimalPart = String(value).split('.')[1];
  return Math.min(decimalPart?.length || 0, 2);
};

const useCountUp = (target, duration = 1500) => {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const number = Number(target);
    if (!Number.isFinite(number)) {
      setCount(0);
      return undefined;
    }

    const startTime = performance.now();
    const precision = getCountPrecision(number);
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextValue = progress === 1 ? number : eased * number;
      setCount(Number(nextValue.toFixed(precision)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return count;
};

const MetricCard = React.memo(({ icon: Icon, label, value, color, sub }) => {
  return (
    <PremiumCard color={color} padding="1.5rem" delay={0.05} style={{ overflow: 'hidden', minHeight: 132, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', height: '100%' }}>
        <PremiumIconBox icon={Icon} color={color} size={20} style={{ width: 44, height: 44, borderRadius: '12px', flexShrink: 0, marginBottom: 0 }} />
        <div style={{ flex: 1, position: 'relative', zIndex: 2 }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", lineHeight: 1.1, margin: 0 }}>{value}</p>
          {sub && <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500, margin: '6px 0 0 0' }}>{sub}</p>}
        </div>
      </div>
    </PremiumCard>
  );
});

const formatCompactNumber = (value, options = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  }).format(number);
};

const formatStandardNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return number.toLocaleString();
};

const formatPercent = (value, digits = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return `${number.toFixed(digits)}%`;
};

const formatCurrencyCompact = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return `$${formatCompactNumber(number)}`;
};

const formatCurrencyInsight = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Insight unavailable';
  return `$${formatCompactNumber(number, { maximumFractionDigits: 2 })}`;
};

const formatMetricValue = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return number.toFixed(digits);
};

const getNumericValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeFeedbackTheme = (theme, row = {}) => {
  const text = [
    theme,
    row.clean_feedback_text,
    row.feedback_snippet,
    row.main_issue,
    row.main_aspect,
    row.top_negative_aspect,
    row.nlp_sentiment_label
  ].filter(Boolean).join(' ').toLowerCase().trim();
  if (!text) return 'General Feedback';
  if (/(top[- ]?notch|excellent quality|quality praise|highly recommended|recommended)/.test(text)) return 'Product Quality Praise';
  if (/(buy.*again|5 stars|five stars|repeat purchase|buying stars)/.test(text)) return 'Repeat Purchase Intent';
  if (/(wines?|meats?|selection)/.test(text)) return 'Product Selection';
  if (/(fast delivery|quick delivery|on time)/.test(text)) return 'Fast Delivery';
  if (/(delivery took|took long|delay|delayed|late delivery)/.test(text)) return 'Delivery Delay';
  if (/(store experience.*frustrat|experience.*frustrat|frustrat|disappointed|worst|glitch|slow|complained|complaint|no one reached out)/.test(text)) return 'Store Experience Complaint';
  if (/(customer service|support|staff|agent|service smooth)/.test(text)) return 'Customer Support';
  if (/(checkout|website|site|glitches|too slow|cart|payment)/.test(text)) return 'Website / Checkout Issues';
  if (/(discount|deals?|coupon|offer|promotion|promo)/.test(text)) return 'Discount Sensitivity';
  if (/(average|fine|okay|standard|nothing special|acceptable|basic expectations|experience products|products fine|okay special)/.test(text)) return 'Neutral Experience';
  if (/(complained|complaint|no one reached out|worst customer service)/.test(text)) return 'Support Complaint';
  return String(theme || '').trim();
};

const getDisplayThemes = (row) => {
  const rawThemes = Array.isArray(row?.top_themes) ? row.top_themes : (row?.top_theme ? [row.top_theme] : []);
  return [...new Set(rawThemes.map(theme => normalizeFeedbackTheme(theme, row)).filter(Boolean))];
};

const getPercentile = (values, percentile) => {
  const sorted = values
    .map(getNumericValue)
    .filter(value => value !== null)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;

  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const getSegmentName = (row) => row?.segment_display_name || row?.segment_name || row?.name || 'Segment';
const isGenericSegmentLabel = (value) => /^Segment\s+\d+$/i.test(String(value || '').trim());

const normalizeSegmentRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    ...row,
    segment_display_name: getSegmentName(row)
  }));
};

const normalizeSegmentSpendRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => ({
      segment_display_name: getSegmentName(row),
      total_spend: getNumericValue(row?.total_spend)
    }))
    .filter(row => row.segment_display_name && row.total_spend !== null);
};

const aggregateSegmentSpendRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  const spendByName = new Map();
  rows.forEach(row => {
    const spend = getNumericValue(row?.total_spend);
    if (spend === null) return;
    const segmentName = getSegmentName(row);
    spendByName.set(segmentName, (spendByName.get(segmentName) || 0) + spend);
  });
  return Array.from(spendByName, ([segment_display_name, total_spend]) => ({
    segment_display_name,
    total_spend
  }));
};

const chartText = '#94a3b8';
const chartGrid = 'rgba(148, 163, 184, 0.16)';
const SEGMENT_SIZE_BARS = [{ dataKey: 'customer_count', name: 'Customers', color: '#2563EB' }];
const SPEND_BARS = [{ dataKey: 'total_spend', name: 'Total Spend', color: '#16A34A' }];
const RESPONSE_RATE_BARS = [{ dataKey: 'response_rate', name: 'Response Rate', color: '#EC4899' }];
const SENTIMENT_SCORE_BARS = [{ dataKey: 'sentiment_score', name: 'Mood Score', color: '#F59E0B' }];
const RECENCY_BARS = [{ dataKey: 'avg_recency', name: 'Avg Recency', color: '#06B6D4' }];
const PRODUCT_SPEND_BARS = [
  { dataKey: 'wines', name: 'Wines', color: '#7C3AED' },
  { dataKey: 'fruits', name: 'Fruits', color: '#16A34A' },
  { dataKey: 'meat', name: 'Meat', color: '#DC2626' },
  { dataKey: 'fish', name: 'Fish', color: '#06B6D4' },
  { dataKey: 'sweets', name: 'Sweets', color: '#EC4899' },
  { dataKey: 'gold', name: 'Gold', color: '#F59E0B' },
];
const CHANNEL_MIX_BARS = [
  { dataKey: 'web_purchases', name: 'Web', color: '#2563EB' },
  { dataKey: 'catalog_purchases', name: 'Catalog', color: '#7C3AED' },
  { dataKey: 'store_purchases', name: 'Store', color: '#16A34A' },
  { dataKey: 'deal_purchases', name: 'Deals', color: '#F59E0B' },
];
const CLUSTER_OPTIONS = ['auto', '3', '4', '5', '6'];
const AVERAGE_PURCHASE_BARS = [{ dataKey: 'avg_purchases', name: 'Avg Purchases', color: '#2563EB' }];
const HIGH_VALUE_BARS = [{ dataKey: 'high_value_count', name: 'High-Value Customers', color: '#F59E0B' }];
const SEGMENT_BUSINESS_PRIORITY = [
  ['champions', 'champion', 'vip', 'high value'],
  ['loyal customers', 'loyal customer', 'loyal', 'active customers', 'active customer', 'active', 'potential loyalists', 'potential loyalist'],
  ['recent customers', 'recent customer', 'recent', 'new customers', 'new customer', 'new'],
  ['at-risk customers', 'at risk customers', 'at-risk customer', 'at risk customer', 'at-risk', 'at risk'],
  ['low engagement', 'need attention', 'needs attention'],
  ['lost customers', 'lost customer', 'lost', 'dormant customers', 'dormant customer', 'dormant', 'churned customers', 'churned customer', 'churned'],
];
const percentAxisFormatter = (value) => `${Number(value).toFixed(0)}%`;
const wholeNumberAxisFormatter = (value) => Number(value).toFixed(0);
const percentKpiFormatter = (value) => formatPercent(value, 0);
const responseRateKpiFormatter = (value) => formatPercent(value, 1);
const CHART_ANIMATION_PROPS = {
  isAnimationActive: false,
  animationDuration: 800,
  animationEasing: 'ease-out',
  animationBegin: 150,
};

const normalizeSegmentPriorityText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getSegmentDisplayLabel = (profile) => (
  Array.isArray(profile)
    ? profile[0]
    : typeof profile === 'string'
      ? profile
      : profile?.segment_display_name || profile?.segment_name || profile?.name || profile?.segment_family || ''
);

const getSegmentPriorityLabel = (profile) => (
  Array.isArray(profile)
    ? profile[0]
    : typeof profile === 'string'
      ? profile
      : profile?.segment_family || profile?.segment_display_name || profile?.segment_name || profile?.name || ''
);

const getSegmentSuffixRank = (value) => {
  const match = String(value || '').trim().match(/\s+([A-Z])$/);
  return match ? match[1].charCodeAt(0) - 65 : null;
};

const getSegmentBusinessPriority = (profile) => {
  const normalized = normalizeSegmentPriorityText(getSegmentPriorityLabel(profile).replace(/\s+[A-Z]$/, ''));
  const priority = SEGMENT_BUSINESS_PRIORITY.findIndex(aliases => (
    aliases.some(alias => normalized === alias || normalized.includes(alias))
  ));
  return priority === -1 ? Number.MAX_SAFE_INTEGER : priority;
};

const getSegmentCustomerCount = (item) => (
  Array.isArray(item)
    ? Number(item[1])
    : Number(item?.customer_count)
);

const compareSegmentsBusinessWise = (a, b) => {
  const priorityDiff = getSegmentBusinessPriority(a) - getSegmentBusinessPriority(b);
  if (priorityDiff !== 0) return priorityDiff;

  const aLabel = getSegmentDisplayLabel(a);
  const bLabel = getSegmentDisplayLabel(b);
  const aSuffixRank = getSegmentSuffixRank(aLabel);
  const bSuffixRank = getSegmentSuffixRank(bLabel);
  if (aSuffixRank !== null || bSuffixRank !== null) {
    const suffixDiff = (aSuffixRank ?? -1) - (bSuffixRank ?? -1);
    if (suffixDiff !== 0) return suffixDiff;
  }

  const countDiff = (getSegmentCustomerCount(b) || 0) - (getSegmentCustomerCount(a) || 0);
  if (countDiff !== 0) return countDiff;

  return String(aLabel).localeCompare(String(bLabel), undefined, { sensitivity: 'base' });
};

const sortSegmentsBusinessWise = (items) => (
  Array.isArray(items) ? [...items].sort(compareSegmentsBusinessWise) : []
);

const SectionHeader = React.memo(({ icon: Icon, iconColor, title, subtitle }) => (
  <div style={{ marginBottom: '1.35rem' }}>
    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Manrope', sans-serif", margin: 0 }}>
      {Icon && <Icon size={18} color={iconColor || '#2563EB'} />} {title}
    </h4>
    <p style={{ fontSize: '0.88rem', color: 'var(--text-light)', margin: '0.45rem 0 0 0' }}>{subtitle}</p>
  </div>
));

const StaticCard = React.memo(({ children, style = {}, className }) => (
  <div
    className={className}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#000'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)'; }}
    style={{
      position: 'relative',
      background: '#FFFFFF',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: 24,
      boxShadow: '0 4px 24px rgba(15, 23, 42, 0.04)',
      height: '100%',
      transition: 'border-color 0.16s ease-out',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }}
  >
    {children}
  </div>
));

const ChartCard = React.memo(({ title, subtitle, children, className }) => (
  <StaticCard className={className} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
    <div style={{ marginBottom: '1.25rem' }}>
      <h5 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', fontFamily: "'Manrope', sans-serif" }}>
        {title}
      </h5>
      {subtitle && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      {children}
    </div>
  </StaticCard>
));

const InsightRow = React.memo(({ label, value, detail, color = '#2563EB' }) => (
  <div style={{ padding: '0.95rem 0', borderTop: '1px solid var(--border)' }}>
    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.35rem 0' }}>
      {label}
    </p>
    <p style={{ fontSize: '0.98rem', color, fontWeight: 850, margin: '0 0 0.25rem 0', lineHeight: 1.25 }}>
      {value || 'Insight unavailable'}
    </p>
    <p style={{ fontSize: '0.76rem', color: 'var(--text-light)', fontWeight: 600, margin: 0, lineHeight: 1.45 }}>
      {detail || 'Not enough customer data yet.'}
    </p>
  </div>
));

const SegmentTooltip = React.memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', color: 'var(--text-main)', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 800, margin: '0 0 0.45rem 0' }}>{label}</p>
      {payload.map(item => (
        <p key={item.dataKey} style={{ fontSize: '0.75rem', margin: '0.2rem 0', color: item.color }}>
          {item.name}: {item.dataKey?.includes('rate') || item.dataKey?.includes('score') ? formatPercent(item.value, 1) : formatCompactNumber(item.value)}
        </p>
      ))}
    </div>
  );
});

const SegmentBarChart = React.memo(({ data, bars, xKey = 'segment_display_name', yFormatter = formatCompactNumber, stacked = false }) => {
  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let res = `<div style="font-weight:600;margin-bottom:4px;color:var(--text-main);">${params[0].axisValue}</div>`;
          params.forEach(p => {
             res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:12px;color:var(--text-main);">
                       <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}</span>
                       <span style="font-weight:600">${yFormatter ? yFormatter(p.value) : p.value}</span>
                     </div>`;
          });
          return res;
        }
      },
      legend: bars.length > 1 ? { bottom: 0, textStyle: { color: chartText } } : undefined,
      grid: { left: '0%', right: '4%', bottom: bars.length > 1 ? '12%' : '0%', top: '4%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(item => item[xKey] || 'Unknown'),
        axisLabel: { interval: 0, rotate: 22, color: chartText, fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: chartGrid } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (value) => yFormatter ? yFormatter(value) : value, color: chartText, fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: chartGrid } }
      },
      series: bars.map(bar => ({
        name: bar.name,
        type: 'bar',
        stack: stacked ? 'total' : undefined,
        itemStyle: { color: bar.color, borderRadius: stacked ? [0, 0, 0, 0] : [4, 4, 0, 0] },
        data: data.map(item => item[bar.dataKey])
      }))
    };
  }, [data, bars, xKey, yFormatter, stacked]);

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', minHeight: 250 }} notMerge={true} lazyUpdate={true} />;
});

/* ─── IncomeSpendScatter now uses ECharts for high performance canvas rendering ─── */
const IncomeSpendScatter = React.memo(({ groupedData }) => {
  const series = useMemo(() => {
    return groupedData.map(group => ({
      name: group.name,
      type: 'scatter',
      data: group.rows.map(r => ({
        value: [r.income, r.total_spend],
        customer_id: r.customer_id,
        segment: r.segment
      })),
      symbolSize: 6,
      itemStyle: {
        color: getSegmentColor(group.name),
        opacity: 0.8
      },
      emphasis: {
        focus: 'series',
        itemStyle: {
          opacity: 1,
          borderColor: '#ffffff',
          borderWidth: 1
        }
      }
    }));
  }, [groupedData]);

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: function (params) {
          const point = params.data;
          return `
            <div style="font-weight:800;margin-bottom:6px;">Customer ${point.customer_id ?? 'N/A'}</div>
            <div>Segment: ${point.segment ?? 'N/A'}</div>
            <div>Income: $${formatCompactNumber(point.value[0])}</div>
            <div>Total Spend: $${formatCompactNumber(point.value[1])}</div>
          `;
        }
      },
      grid: {
        top: 20,
        right: 40,
        bottom: 80,
        left: 55,
        containLabel: true
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontWeight: 600, color: '#475569', fontSize: 12 }
      },
      xAxis: {
        type: 'value',
        name: 'Income ($)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#334155', fontWeight: 700 },
        axisLabel: {
          color: '#475569',
          fontWeight: 600,
          formatter: (val) => formatCompactNumber(val)
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'value',
        name: 'Total Spend ($)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#334155', fontWeight: 700 },
        axisLabel: {
          color: '#475569',
          fontWeight: 600,
          formatter: (val) => formatCompactNumber(val)
        },
        splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: [0], filterMode: 'filter' },
        { type: 'inside', yAxisIndex: [0], filterMode: 'filter' }
      ],
      series: series
    };
  }, [series]);

  return (
    <div style={{ height: 400, width: '100%' }}>
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }} 
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
});

const MarketingKpiSection = React.memo(({
  results,
  totalCustomers,
  visibleSegmentCount,
  topSegment,
  avgPurchasesPerCustomer,
  highValueCustomerCount
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridAutoRows: '1fr', gap: '1rem', marginBottom: '2rem' }}>
    <MetricCard icon={Users} label="Audience Size" value={formatStandardNumber(totalCustomers)} rawValue={totalCustomers} formatter={formatStandardNumber} color="#2563EB" sub="Database reach" />
    <MetricCard icon={Target} label="Audience Groups" value={visibleSegmentCount} rawValue={visibleSegmentCount} formatter={formatStandardNumber} color="#7C3AED" sub="Distinct segments found" />
    <MetricCard icon={Activity} label="Avg Purchases / Customer" value={formatMetricValue(avgPurchasesPerCustomer, 1)} rawValue={avgPurchasesPerCustomer} formatter={(value) => formatMetricValue(value, 1)} color="#0D9488" sub="Purchase frequency" />
    <MetricCard icon={Award} label="Top Segment" value={topSegment} color="#D97706" sub="Largest customer group" />
    <MetricCard icon={DollarSign} label="Total Customer Spend" value={formatCurrencyCompact(results.total_customer_spend)} rawValue={results.total_customer_spend} formatter={formatCurrencyCompact} color="#16A34A" sub="Processed audience spend" />
    <MetricCard icon={TrendingUp} label="Avg Spend / Customer" value={formatCurrencyCompact(results.avg_spend_per_customer)} rawValue={results.avg_spend_per_customer} formatter={formatCurrencyCompact} color="#06B6D4" sub="Average customer value" />
    <MetricCard icon={Percent} label="Campaign Response Rate" value={formatPercent(results.campaign_response_rate, 1)} rawValue={results.campaign_response_rate} formatter={responseRateKpiFormatter} color="#EC4899" sub="Customers who responded" />
    <MetricCard icon={Gem} label="High-Value Customers" value={formatStandardNumber(highValueCustomerCount)} rawValue={highValueCustomerCount} formatter={formatStandardNumber} color="#F59E0B" sub="High-spend customer segments" />
  </div>
));

const AutoKInsight = React.memo(({ results }) => {
  const selection = results?.k_selection;
  if (!selection) return null;

  const mode = results?.cluster_mode || 'manual';
  const selectedK = results?.selected_k || results?.n_clusters || selection.selected_k || selection.recommended_k;
  const title = mode === 'auto'
    ? `Suggested Groups: ${selectedK}`
    : `Manual Groups: ${selectedK} · Auto suggestion: ${selection.recommended_k || 'Use Auto mode'}`;
  const detail = mode === 'auto'
    ? `Selected ${selectedK} groups based on customer behavior patterns, segment balance, and business usability.`
    : 'You are viewing a manual segmentation override.';

  return (
    <div style={{ margin: '-0.75rem 0 1.5rem 0', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: 800 }}>{title}</p>
      <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.78rem', lineHeight: 1.45 }}>{detail}</p>
    </div>
  );
});

const AiSegmentIntelligenceSection = React.memo(({ segmentProfiles, recommendationsBySegment }) => {
  const isSixSegmentGrid = segmentProfiles.length === 6;

  return (
    <div style={{ marginBottom: '2rem' }}>
      {isSixSegmentGrid && (
        <style>{`
        .mkt-segment-card-grid.is-six-segment-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 1100px) {
          .mkt-segment-card-grid.is-six-segment-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .mkt-segment-card-grid.is-six-segment-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h4 style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Manrope', sans-serif", margin: 0 }}>
            <Sparkles size={18} color="#2563EB" /> AI Segment Intelligence
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '0.45rem 0 0 0' }}>
            Customers grouped by spending, purchases, recency, income, and campaign response. Customer mood is interpreted from feedback to guide recommendations.
          </p>
        </div>
      </div>

      <div className={`mkt-segment-card-grid${isSixSegmentGrid ? ' is-six-segment-grid' : ''}`} style={{ display: 'grid', gridTemplateColumns: isSixSegmentGrid ? undefined : 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {segmentProfiles.map((profile) => {
          const color = getSegmentColor(profile.segment_display_name);
          const recommendation = recommendationsBySegment[profile.segment_display_name];
          return (
            <StaticCard key={profile.segment_display_name} style={{ padding: '1.25rem', minHeight: 310 }}>
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0', fontFamily: "'Manrope', sans-serif" }}>
                  {profile.segment_display_name}
                </h5>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, margin: 0 }}>
                  {formatStandardNumber(profile.customer_count)} customers • {formatPercent(profile.share_pct, 1)} of audience
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Avg spend</p>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{formatCurrencyCompact(profile.avg_spend)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Avg purchases</p>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{formatMetricValue(profile.avg_purchases)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Avg recency</p>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{formatMetricValue(profile.avg_recency, 0)} days</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.2rem 0' }}>Customer mood</p>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800, margin: 0 }}>{formatPercent(profile.sentiment_score, 0)}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Response rate</span>
                <span style={{ fontSize: '0.9rem', color, fontWeight: 800 }}>{formatPercent(profile.response_rate, 1)}</span>
              </div>

              <div>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.35rem 0' }}>
                  Action{recommendation?.action_category ? ` • ${recommendation.action_category}` : ''}
                </p>
                <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-main)', fontWeight: 600, margin: 0 }}>
                  {recommendation?.recommended_action || 'Use personalized product recommendations to increase engagement.'}
                </p>
              </div>
            </StaticCard>
          );
        })}
      </div>
    </div>
  );
});

const NlpFeedbackIntelligenceSection = React.memo(({ nlpInsights, customerRows = [], segmentOptions = [] }) => {
  if (!nlpInsights) return null;

  const sentimentDistribution = nlpInsights.sentiment_distribution || {};
  const positivePct = sentimentDistribution.positive?.percentage ?? 0;
  const negativePct = sentimentDistribution.negative?.percentage ?? 0;
  const isEmpty = nlpInsights.status === 'empty';

  // Fallback segment actions
  const segmentActions = useMemo(() => {
    const mapping = {};
    const themeRows = nlpInsights.top_themes_by_segment || [];
    themeRows.forEach(row => {
      const segment = row.segment_display_name || row.segment_name;
      if (segment) {
        mapping[segment] = row.suggested_action;
      }
    });
    return mapping;
  }, [nlpInsights]);

  // States for filters
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [mixedSignalFilter, setMixedSignalFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');

  const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'desc' });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Derive filter options
  const filterOptions = useMemo(() => {
    const issues = new Set();
    const themes = new Set();
    const languages = new Set();

    customerRows.forEach(row => {
      if (row.main_issue || row.main_aspect) issues.add(row.main_issue || row.main_aspect);
      getDisplayThemes(row).forEach(t => themes.add(t));
      if (row.language) languages.add(row.language);
    });

    return {
      issues: Array.from(issues).filter(Boolean).sort(),
      themes: Array.from(themes).filter(Boolean).sort(),
      languages: Array.from(languages).filter(Boolean).sort()
    };
  }, [customerRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return customerRows.filter(row => {
      const segment = row.segment_display_name || row.segment_name || '';
      const nlpSentiment = row.nlp_sentiment_label || '';
      const mainIssue = row.main_issue || row.main_aspect || '';
      const feedbackSnippet = row.feedback_snippet || '';
      const recommendedAction = row.recommended_action || segmentActions[segment] || '';
      const topThemesArray = getDisplayThemes(row);
      const sarcasmFlag = row.sarcasm_flag === 'Possible';
      const language = row.language || '';

      const searchTarget = [row.customer_id, segment, nlpSentiment, mainIssue, feedbackSnippet, recommendedAction, ...topThemesArray].join(' ').toLowerCase();
      const matchesSearch = !deferredSearch || searchTarget.includes(deferredSearch.toLowerCase());
      const matchesSegment = segmentFilter === 'all' || segment === segmentFilter;
      const matchesSentiment = sentimentFilter === 'all' || nlpSentiment.toLowerCase() === sentimentFilter.toLowerCase();
      const matchesIssue = issueFilter === 'all' || mainIssue === issueFilter;
      const matchesTheme = themeFilter === 'all' || topThemesArray.includes(themeFilter);
      const matchesMixed = mixedSignalFilter === 'all' ||
        (mixedSignalFilter === 'flagged' && sarcasmFlag) ||
        (mixedSignalFilter === 'clear' && !sarcasmFlag);
      const matchesLanguage = languageFilter === 'all' || language === languageFilter;

      return matchesSearch && matchesSegment && matchesSentiment && matchesIssue && matchesTheme && matchesMixed && matchesLanguage;
    });
  }, [customerRows, deferredSearch, segmentFilter, sentimentFilter, issueFilter, themeFilter, mixedSignalFilter, languageFilter, segmentActions]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortConfig.key === 'default') {
        const sarcasmA = a.sarcasm_flag === 'Possible' ? 1 : 0;
        const sarcasmB = b.sarcasm_flag === 'Possible' ? 1 : 0;
        if (sarcasmA !== sarcasmB) return sarcasmB - sarcasmA; // Flagged first

        const sentimentOrder = { 'Negative': 3, 'Neutral': 2, 'Positive': 1, 'Mixed': 4 };
        const sentA = sentimentOrder[a.nlp_sentiment_label] || 0;
        const sentB = sentimentOrder[b.nlp_sentiment_label] || 0;
        if (sentA !== sentB) return sentB - sentA; // Negative first among non-flagged

        const scoreA = Number(a.sentiment_confidence || a.nlp_sentiment_score || 0);
        const scoreB = Number(b.sentiment_confidence || b.nlp_sentiment_score || 0);
        return scoreB - scoreA;
      }

      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'sentiment_score') {
        valA = Number(a.nlp_sentiment_score || 0);
        valB = Number(b.nlp_sentiment_score || 0);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortConfig]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleRows = useMemo(() => sortedRows.slice(startIndex, startIndex + pageSize), [sortedRows, startIndex]);

  // Reset page on filter
  useEffect(() => setPage(1), [deferredSearch, segmentFilter, sentimentFilter, issueFilter, themeFilter, mixedSignalFilter, languageFilter]);

  const handleSort = (key) => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const renderBadge = (text, type) => {
    if (!text || text === 'N/A') return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
    let color = 'var(--text-main)';
    let bg = 'transparent';
    if (type === 'sentiment') {
      if (text === 'Positive') { color = '#16A34A'; bg = '#DCFCE7'; }
      else if (text === 'Negative') { color = '#DC2626'; bg = '#FEE2E2'; }
      else if (text === 'Neutral') { color = '#475569'; bg = '#F1F5F9'; }
      else if (text === 'Mixed') { color = '#D97706'; bg = '#FEF3C7'; }
    } else if (type === 'mixed') {
      if (text === 'Flagged') { color = '#D97706'; bg = '#FEF3C7'; }
      else { color = '#16A34A'; bg = '#DCFCE7'; }
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem',
        borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
        color, backgroundColor: bg
      }}>
        {text}
      </span>
    );
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <SectionHeader
        icon={Sparkles}
        iconColor="#2563EB"
        title="NLP Feedback Intelligence"
        subtitle="Customer feedback is analyzed with NLP to measure sentiment, identify feedback themes, detect mixed signals, and support marketing actions."
      />

      {isEmpty ? (
        <StaticCard style={{ padding: '1.25rem' }}>
          <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>{nlpInsights.message || 'No feedback text available.'}</p>
        </StaticCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <MetricCard icon={Users} label="Feedback Records Analyzed" value={formatStandardNumber(nlpInsights.feedback_records_analyzed)} rawValue={nlpInsights.feedback_records_analyzed} formatter={formatStandardNumber} color="#2563EB" sub="Customer comments processed" />
            <MetricCard icon={Activity} label="Overall Sentiment" value={nlpInsights.overall_sentiment_score !== null && nlpInsights.overall_sentiment_score !== undefined ? `${nlpInsights.overall_sentiment_score}%` : 'N/A'} color="#16A34A" sub="Feedback mood score" />
            <MetricCard icon={TrendingUp} label="Positive Feedback" value={formatPercent(positivePct, 1)} rawValue={positivePct} formatter={responseRateKpiFormatter} color="#16A34A" sub="Share of comments" />
            <MetricCard icon={Percent} label="Negative Feedback" value={formatPercent(negativePct, 1)} rawValue={negativePct} formatter={responseRateKpiFormatter} color="#DC2626" sub="Needs attention" />
            <MetricCard icon={AlertTriangle} label="Mixed Signal Flags" value={formatStandardNumber(nlpInsights.possible_sarcasm_count)} rawValue={nlpInsights.possible_sarcasm_count} formatter={formatStandardNumber} color="#D97706" sub="Mixed signal comments" />
            <MetricCard icon={Target} label="Most Discussed Aspect" value={nlpInsights.most_discussed_aspect || nlpInsights.top_complaint_aspect || 'N/A'} color="#7C3AED" sub="Most mentioned feedback topic" />
          </div>

          <StaticCard style={{ padding: '1rem', marginBottom: '1.25rem' }}>
            <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0', fontFamily: "'Manrope', sans-serif" }}>NLP Customer Feedback Intelligence</h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: '0 0 1rem 0' }}>
              Customer-level feedback analysis with sentiment, themes, detected issues, aspect signals, mixed-signal flags, and recommended marketing actions.
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '-0.35rem 0 1rem 0', fontWeight: 600 }}>
              Sorted by attention-needed feedback first.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <label style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={14} color="#64748B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search text, themes, aspects..."
                  style={{ width: '100%', padding: '0.65rem 0.65rem 0.65rem 2.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                />
              </label>
              <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Segments</option>
                {segmentOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sentimentFilter} onChange={e => setSentimentFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
                <option value="mixed">Mixed</option>
              </select>
              <select value={issueFilter} onChange={e => setIssueFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Issues / Aspects</option>
                {filterOptions.issues.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={themeFilter} onChange={e => setThemeFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Themes</option>
                {filterOptions.themes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={mixedSignalFilter} onChange={e => setMixedSignalFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Signals</option>
                <option value="flagged">Flagged mixed signals</option>
                <option value="clear">Clear</option>
              </select>
              <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} style={{ flex: '1 1 120px', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}>
                <option value="all">All Languages</option>
                {filterOptions.languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1600px' }}>
                <thead>
                  <tr>
                    {[
                      ['Customer ID', 'customer_id'],
                      ['Segment', 'segment_display_name'],
                      ['Feedback Snippet', null],
                      ['NLP Sentiment', 'nlp_sentiment_label'],
                      ['Sentiment Score', 'sentiment_score'],
                      ['Main Issue / Aspect', 'main_issue'],
                      ['Top Theme', null],
                      ['Positive Aspect', 'top_positive_aspect'],
                      ['Negative Aspect', 'top_negative_aspect'],
                      ['Mixed Signal', 'sarcasm_flag'],
                      ['Language', 'language'],
                      ['Recommended Action', null]
                    ].map(([label, sortKey]) => (
                      <th key={label} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {sortKey ? (
                          <button onClick={() => handleSort(sortKey)} style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                            {label} <ArrowUpDown size={12} />
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => {
                    const segment = row.segment_display_name || row.segment_name || 'Segment';
                    const feedbackSnippet = row.feedback_snippet || 'No feedback text';
                    const fullFeedback = row.clean_feedback_text || feedbackSnippet;
                    const nlpSentiment = row.nlp_sentiment_label || 'N/A';
                    const sentimentScore = row.nlp_sentiment_score != null ? `${row.nlp_sentiment_score}%` : 'N/A';
                    const mainIssue = row.main_issue || row.main_aspect || 'N/A';
                    const topThemesArray = getDisplayThemes(row);
                    const topTheme = topThemesArray.length > 0 ? topThemesArray[0] : 'N/A';
                    const posAspect = row.top_positive_aspect || 'N/A';
                    const negAspect = row.top_negative_aspect || 'N/A';
                    const isMixed = row.sarcasm_flag === 'Possible';
                    const mixedSignalText = isMixed ? 'Flagged' : 'Clear';
                    const language = row.language || 'N/A';
                    const action = row.recommended_action || segmentActions[segment] || 'Use tailored outreach based on feedback themes.';

                    return (
                      <tr key={`${row.customer_id}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.8rem' }}>{row.customer_id}</td>
                        <td style={{ padding: '0.75rem', color: getSegmentColor(segment), fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{segment}</td>
                        <td title={fullFeedback} style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{feedbackSnippet}</td>
                        <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{renderBadge(nlpSentiment, 'sentiment')}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.8rem' }}>{sentimentScore}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{mainIssue}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{topTheme}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{posAspect}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{negAspect}</td>
                        <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{renderBadge(mixedSignalText, 'mixed')}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem' }}>{language}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-main)', fontSize: '0.8rem', minWidth: 200 }}>{action}</td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan="12" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                        No feedback records found matching the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
                Showing {sortedRows.length ? startIndex + 1 : 0} to {Math.min(startIndex + pageSize, sortedRows.length)} of {sortedRows.length.toLocaleString()} records
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: safePage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </StaticCard>
        </>
      )}
    </div>
  );
});

const SegmentPerformanceSection = React.memo(({
  sizeDistributionData,
  spendBySegment,
  campaignResponseBySegment,
  sentimentBySegment,
  recencyBySegment,
  productSpendBySegment,
  channelMixBySegment,
  averagePurchasesBySegment,
  highValueBySegment,
  incomeSpendGrouped,
}) => (
  <div style={{ marginBottom: '2rem' }}>
    <SectionHeader
      icon={BarChartIcon}
      iconColor="#7C3AED"
      title="Segment Performance Analytics"
      subtitle="Compare customer segments by value, response, sentiment, and recency."
    />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.25rem' }}>
      <ChartCard title="Segment Size Distribution" subtitle="Customer count and audience share by segment." className="capture-chart">
        <SegmentBarChart data={sizeDistributionData} bars={SEGMENT_SIZE_BARS} yFormatter={formatCompactNumber} />
      </ChartCard>

      <ChartCard title="Spend by Segment" subtitle="Total customer spend across each AI segment." className="capture-chart">
        <SegmentBarChart data={spendBySegment} bars={SPEND_BARS} yFormatter={formatCompactNumber} />
      </ChartCard>

      <ChartCard title="Campaign Response by Segment" subtitle="Share of customers who responded to campaigns.">
        <SegmentBarChart data={campaignResponseBySegment} bars={RESPONSE_RATE_BARS} yFormatter={percentAxisFormatter} />
      </ChartCard>

      <ChartCard title="Customer Mood by Segment" subtitle="Average feedback mood score by customer segment.">
        <SegmentBarChart data={sentimentBySegment} bars={SENTIMENT_SCORE_BARS} yFormatter={percentAxisFormatter} />
      </ChartCard>

      <ChartCard title="Average Recency by Segment" subtitle="Average days since each segment last purchased.">
        <SegmentBarChart data={recencyBySegment} bars={RECENCY_BARS} yFormatter={wholeNumberAxisFormatter} />
      </ChartCard>

      <ChartCard title="Product Spend by Segment" subtitle="Category spend mix across each segment.">
        <SegmentBarChart data={productSpendBySegment} stacked bars={PRODUCT_SPEND_BARS} yFormatter={formatCompactNumber} />
      </ChartCard>

      <ChartCard title="Purchase Channel Mix by Segment" subtitle="How each segment buys across channels.">
        <SegmentBarChart data={channelMixBySegment} stacked bars={CHANNEL_MIX_BARS} yFormatter={formatCompactNumber} />
      </ChartCard>

      <ChartCard title="Income vs Spend by Segment" subtitle="Relationship between income and customer spend.">
        <IncomeSpendScatter groupedData={incomeSpendGrouped} />
      </ChartCard>

      <ChartCard title="Average Purchases by Segment" subtitle="Average purchase activity across customer segments.">
        <SegmentBarChart data={averagePurchasesBySegment} bars={AVERAGE_PURCHASE_BARS} yFormatter={wholeNumberAxisFormatter} />
      </ChartCard>

      <ChartCard title="High-Value Customers by Segment" subtitle="Top-spend customers distributed across each segment.">
        <SegmentBarChart data={highValueBySegment} bars={HIGH_VALUE_BARS} yFormatter={wholeNumberAxisFormatter} />
      </ChartCard>
    </div>
  </div>
));

const RfmBehavioralSection = React.memo(({ marketingRows, rfmInsights }) => (
  <div style={{ marginBottom: '2rem' }}>
    <SectionHeader
      icon={Activity}
      iconColor="#16A34A"
      title="RFM / Behavioral Analysis"
      subtitle="Explore how customer value, recency, product spend, and channel behavior differ by segment."
    />
    <StaticCard style={{ padding: '1.6rem', minHeight: 520 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '2.35 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", margin: '0 0 0.35rem 0' }}>RFM Customer Distribution</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: '0 0 1.35rem 0', lineHeight: 1.45 }}>
            Each dot is one customer. Use recency and spend to compare segment behavior.
          </p>
          <div style={{ flex: 1, minHeight: 390, width: '100%' }}>
            <MarketingChart data={marketingRows} />
          </div>
        </div>

        <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '0.1rem 0 0.1rem 1.25rem', borderLeft: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0', fontFamily: "'Manrope', sans-serif" }}>RFM Behavioral Insights</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '0 0 0.75rem 0', lineHeight: 1.45, fontWeight: 600 }}>
            High-signal customer behavior patterns from the current segmentation run.
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.7rem 0', lineHeight: 1.45, fontWeight: 600 }}>
            Average spend compares customer value; total spend shows segment-wide business impact.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rfmInsights.map(insight => (
              <InsightRow
                key={insight.label}
                label={insight.label}
                value={insight.value}
                detail={insight.detail}
                color={insight.color}
              />
            ))}
          </div>
        </div>
      </div>
    </StaticCard>
  </div>
));

const CustomerSegmentTableSection = React.memo(({ marketingRows, segmentOptions, recommendationTextBySegment, highValueSegmentKeys }) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState('all');
  const [customerValueFilter, setCustomerValueFilter] = useState('all');
  const [customerResponseFilter, setCustomerResponseFilter] = useState('all');
  const [customerSort, setCustomerSort] = useState({ key: 'total_spend', direction: 'desc' });
  const [customerPage, setCustomerPage] = useState(1);
  const deferredCustomerSearch = useDeferredValue(customerSearch);

  const isHighValueCustomer = useCallback((row) => {
    const segment = row?.segment_display_name || row?.segment_name || row?.segment_family || '';
    return highValueSegmentKeys.has(normalizeSegmentPriorityText(segment));
  }, [highValueSegmentKeys]);

  const getCustomerValueTier = useCallback((row) => (
    isHighValueCustomer(row) ? 'High Value' : 'Standard'
  ), [isHighValueCustomer]);

  const getShortTableAction = useCallback((row, actionText) => {
    const segment = String(row?.segment_display_name || row?.segment_name || row?.segment_family || '').toLowerCase();
    const action = String(actionText || '').toLowerCase();
    const source = `${segment} ${action}`;
    if (source.includes('win-back') || source.includes('win back')) return 'Send win-back offer.';
    if (source.includes('experience') || source.includes('recovery')) return 'Improve experience first.';
    if (source.includes('retention') || source.includes('loyalty') || source.includes('retain')) return 'Retain with loyalty rewards.';
    if (source.includes('campaign') || source.includes('offer') || source.includes('promotional') || source.includes('prioritize')) return 'Prioritize campaign offers.';
    if (source.includes('engagement') || source.includes('nurture') || source.includes('recommendation')) return 'Nurture with light engagement.';
    return 'Use tailored outreach.';
  }, []);

  useEffect(() => {
    setCustomerPage(1);
  }, [deferredCustomerSearch, customerSegmentFilter, customerValueFilter, customerResponseFilter, customerSort.key, customerSort.direction]);

  const handleCustomerSearchChange = useCallback((event) => {
    setCustomerSearch(event.target.value);
  }, []);

  const handleCustomerSegmentFilterChange = useCallback((event) => {
    setCustomerSegmentFilter(event.target.value);
  }, []);

  const handleCustomerValueFilterChange = useCallback((event) => {
    setCustomerValueFilter(event.target.value);
  }, []);

  const handleCustomerResponseFilterChange = useCallback((event) => {
    setCustomerResponseFilter(event.target.value);
  }, []);

  const handleCustomerSort = useCallback((key) => {
    setCustomerSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  const filteredCustomerRows = useMemo(() => {
    const query = deferredCustomerSearch.trim().toLowerCase();
    return marketingRows.filter(row => {
      const segment = row.segment_display_name || row.segment_name || '';
      const family = row.segment_family || '';
      const action = recommendationTextBySegment[segment] || '';
      const valueTier = getCustomerValueTier(row);
      const nlpSentiment = row.nlp_sentiment_label || '';
      const mainIssue = row.main_issue || row.main_aspect || '';
      const feedbackSnippet = row.feedback_snippet || '';
      const responseValue = Number(row.response);
      const responded = responseValue === 1;
      const matchesSearch = !query || [row.customer_id, segment, family, valueTier, nlpSentiment, mainIssue, feedbackSnippet, action]
        .some(value => String(value || '').toLowerCase().includes(query));
      const matchesSegment = customerSegmentFilter === 'all' || segment === customerSegmentFilter;
      const matchesValueTier = customerValueFilter === 'all' ||
        (customerValueFilter === 'high_value' && valueTier === 'High Value') ||
        (customerValueFilter === 'standard' && valueTier === 'Standard');
      const matchesResponse = customerResponseFilter === 'all' ||
        (customerResponseFilter === 'responded' && responded) ||
        (customerResponseFilter === 'no_response' && !responded);
      return matchesSearch && matchesSegment && matchesValueTier && matchesResponse;
    });
  }, [marketingRows, deferredCustomerSearch, customerSegmentFilter, customerValueFilter, customerResponseFilter, recommendationTextBySegment, getCustomerValueTier]);

  const sortedCustomerRows = useMemo(() => (
    [...filteredCustomerRows].sort((a, b) => {
      const segmentDiff = compareSegmentsBusinessWise(a, b);
      if (segmentDiff !== 0) return segmentDiff;

      const getSortValue = (row) => {
        if (customerSort.key === 'sentiment_score') return ((Number(row.sentiment) || 0) + 1) / 2 * 100;
        return Number(row[customerSort.key]) || 0;
      };
      const diff = getSortValue(a) - getSortValue(b);
      return customerSort.direction === 'asc' ? diff : -diff;
    })
  ), [filteredCustomerRows, customerSort.key, customerSort.direction]);

  const customerPageSize = 10;
  const customerTotalPages = Math.max(1, Math.ceil(sortedCustomerRows.length / customerPageSize));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const customerStartIndex = (safeCustomerPage - 1) * customerPageSize;
  const visibleCustomerRows = useMemo(() => (
    sortedCustomerRows.slice(customerStartIndex, customerStartIndex + customerPageSize)
  ), [sortedCustomerRows, customerStartIndex]);

  const handlePreviousCustomerPage = useCallback(() => {
    setCustomerPage(page => Math.max(1, page - 1));
  }, []);

  const handleNextCustomerPage = useCallback(() => {
    setCustomerPage(page => Math.min(customerTotalPages, page + 1));
  }, [customerTotalPages]);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHeader
        icon={WalletCards}
        iconColor="#2563EB"
        title="Customer Segment Detail"
        subtitle="Customer-level segment assignments and marketing signals."
      />
      <StaticCard style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ position: 'relative', display: 'block' }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={customerSearch}
              onChange={handleCustomerSearchChange}
              placeholder="Search customers, segments, actions"
              style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.2rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
            />
          </label>
          <select value={customerSegmentFilter} onChange={handleCustomerSegmentFilterChange} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
            <option value="all">All segments</option>
            {segmentOptions.map(segment => <option key={segment} value={segment}>{segment}</option>)}
          </select>
          <select value={customerValueFilter} onChange={handleCustomerValueFilterChange} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
            <option value="all">All Value Tiers</option>
            <option value="high_value">High-Value Customers</option>
            <option value="standard">Standard Customers</option>
          </select>
          <select value={customerResponseFilter} onChange={handleCustomerResponseFilterChange} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
            <option value="all">All responses</option>
            <option value="responded">Responded</option>
            <option value="no_response">No response</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1260px' }}>
            <thead>
              <tr>
                {[
                  ['Customer ID'],
                  ['Segment'],
                  ['Customer Value'],
                  ['Total Spend', 'total_spend'],
                  ['Purchases', 'total_purchases'],
                  ['Recency', 'recency'],
                  ['Customer Income'],
                  ['NLP Sentiment'],
                  ['Main Issue'],
                  ['Feedback Snippet'],
                  ['Campaign Response'],
                  ['Action'],
                ].map(([label, sortKey]) => (
                  <th key={label} style={{ padding: '0.8rem', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {sortKey ? (
                      <button onClick={() => handleCustomerSort(sortKey)} style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: 0 }}>
                        {label} <ArrowUpDown size={12} />
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleCustomerRows.map(row => {
                const segment = row.segment_display_name || row.segment_name || 'Segment';
                const action = recommendationTextBySegment[segment] || '';
                const responseValue = Number(row.response);
                const responded = responseValue === 1;
                const customerValueTier = getCustomerValueTier(row);
                const nlpSentiment = row.nlp_sentiment_label || 'N/A';
                const mainIssue = row.main_issue || row.main_aspect || 'N/A';
                const feedbackSnippet = row.feedback_snippet || 'No feedback text';
                return (
                  <tr key={`${row.customer_id}-${segment}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.82rem' }}>{row.customer_id}</td>
                    <td style={{ padding: '0.8rem', color: getSegmentColor(segment), fontWeight: 700, fontSize: '0.82rem' }}>{segment}</td>
                    <td style={{ padding: '0.8rem', color: customerValueTier === 'High Value' ? '#D97706' : 'var(--text-main)', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{customerValueTier}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.82rem' }}>{formatCurrencyCompact(row.total_spend)}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>{formatMetricValue(row.total_purchases, 0)}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>{formatMetricValue(row.recency, 0)} days</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem' }}>{formatCurrencyCompact(row.income)}</td>
                    <td style={{ padding: '0.8rem', color: nlpSentiment === 'Negative' ? '#DC2626' : nlpSentiment === 'Positive' ? '#16A34A' : 'var(--text-main)', fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{nlpSentiment}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{mainIssue}</td>
                    <td title={row.clean_feedback_text || row.feedback_snippet || ''} style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{feedbackSnippet}</td>
                    <td style={{ padding: '0.8rem', color: responded ? '#16A34A' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.82rem' }}>{responded ? 'Responded' : 'No response'}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-main)', fontSize: '0.82rem', minWidth: 210, whiteSpace: 'nowrap' }}>{getShortTableAction(row, action)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
            Showing {sortedCustomerRows.length ? customerStartIndex + 1 : 0} to {Math.min(customerStartIndex + customerPageSize, sortedCustomerRows.length)} of {sortedCustomerRows.length.toLocaleString()} customers
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={handlePreviousCustomerPage} disabled={safeCustomerPage === 1} style={{ padding: '0.55rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: safeCustomerPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: safeCustomerPage === 1 ? 0.5 : 1 }}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 700 }}>Page {safeCustomerPage} of {customerTotalPages}</span>
            <button onClick={handleNextCustomerPage} disabled={safeCustomerPage === customerTotalPages} style={{ padding: '0.55rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: safeCustomerPage === customerTotalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: safeCustomerPage === customerTotalPages ? 0.5 : 1 }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </StaticCard>
    </div>
  );
});

const MarketingExplorerSection = React.memo(({ marketingRows }) => {
  const [explorerX, setExplorerX] = useState('');
  const [explorerY, setExplorerY] = useState('');
  const [explorerChart, setExplorerChart] = useState('bar');

  const explorerColumns = useMemo(() => (
    marketingRows.length > 0 ? Object.keys(marketingRows[0]).filter(k => k !== 'customer_id') : []
  ), [marketingRows]);

  const handleExplorerXChange = useCallback((event) => {
    setExplorerX(event.target.value);
  }, []);

  const handleExplorerYChange = useCallback((event) => {
    setExplorerY(event.target.value);
  }, []);

  const handleExplorerChartChange = useCallback((event) => {
    setExplorerChart(event.target.value);
  }, []);

  return (
    <StaticCard style={{ padding: '1.5rem' }}>
      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Manrope', sans-serif" }}>
        <BarChartIcon size={18} color="#7C3AED" /> Custom Data Explorer
      </h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
        Select any X and Y columns to dynamically generate custom comparisons and visualize patterns in your dataset.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>X-Axis (Category)</label>
          <select value={explorerX} onChange={handleExplorerXChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
            <option value="">-- Select --</option>
            {explorerColumns.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Y-Axis (Value)</label>
          <select value={explorerY} onChange={handleExplorerYChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
            <option value="">-- Select --</option>
            {explorerColumns.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Chart Type</label>
          <select value={explorerChart} onChange={handleExplorerChartChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
            <option value="bar">Bar Chart (Avg Values)</option>
            <option value="line">Line Chart (Avg Values)</option>
            <option value="scatter">Scatter Plot (Raw Dots)</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <DataExplorerChart data={marketingRows} xAxis={explorerX} yAxis={explorerY} chartType={explorerChart} />
      </div>
    </StaticCard>
  );
});

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
const MarketingAnalysis = () => {
  const { user } = useAuth();
  const { marketingState, setMarketingState } = useApp();
  const [datasets, setDatasets] = useState([]);

  const initialClusters = marketingState.clusters === undefined || marketingState.clusters === null || marketingState.clusters === ''
    ? 'auto'
    : String(marketingState.clusters);
  const [selected, setSelected] = useState(marketingState.selected);
  const [clusters, setClusters] = useState(initialClusters);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(marketingState.results);
  const [exporting, setExporting] = useState(false);
  const [runVersion, setRunVersion] = useState(0);

  /* ─── In-memory results cache: key = "datasetId:clusters" ─── */
  const resultsCache = useRef(new Map());

  useEffect(() => {
    setMarketingState({ selected, clusters, results });
  }, [selected, clusters, results, setMarketingState]);

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
    }).catch(err => setError(err))
      .finally(() => setIsFetching(false));
  }, [user?.email]);

  const isClusterCountValid = useMemo(() => {
    if (String(clusters).toLowerCase() === 'auto') return true;
    const value = Number(clusters);
    return Number.isInteger(value) && value >= 3 && value <= 6;
  }, [clusters]);

  const handleKMeans = useCallback(async () => {
    if (loading) return;
    if (!selected) return setError('Please select a dataset.');
    if (!isClusterCountValid) return setError('Please select Auto or a group count between 3 and 6.');
    if (!user?.email) return setError("User identity not confirmed.");

    /* ── PHASE 1 TIMING LOGS ── */
    const t_click = performance.now();
    const isAutoMode = String(clusters).toLowerCase() === 'auto';
    const clusterCount = isAutoMode ? null : Number(clusters);
    const clusterMode = isAutoMode ? 'auto' : 'manual';
    const cacheKey = isAutoMode ? `${selected}:auto` : `${selected}:manual:${clusterCount}`;

    setLoading(true);
    setError(null);

    const t_api_start = performance.now();
    try {
      const cached = resultsCache.current.get(cacheKey);
      if (cached) {
        if (import.meta.env.DEV) {
          const t_cache_hit = performance.now();
          console.table({
            source: 'CACHE HIT',
            cache_key: cacheKey,
            click_to_results_ms: Math.round(t_cache_hit - t_click),
          });
        }
        setResults({ ...cached });
        setRunVersion(version => version + 1);
        return;
      }

      const payload = {
        dataset_id: selected,
        cluster_mode: clusterMode,
        email: user.email,
      };
      if (!isAutoMode) payload.n_clusters = clusterCount;

      const res = await API.post('/marketing/analyze', payload);
      const t_api_end = performance.now();
      resultsCache.current.set(cacheKey, res);
      setResults(res);
      setRunVersion(version => version + 1);
      if (import.meta.env.DEV) {
        const t_done = performance.now();
        console.table({
          source: 'API CALL',
          click_to_api_start_ms: Math.round(t_api_start - t_click),
          api_duration_ms: Math.round(t_api_end - t_api_start),
          total_click_to_results_ready_ms: Math.round(t_done - t_click),
        });
      }
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [selected, user?.email, clusters, isClusterCountValid, loading]);

  const handleExport = useCallback(async (fmt) => {
    if (!results?.clusters) return;
    setExporting(true);
    try {
      let totalSentiment = 0;
      let sentimentCount = 0;

      const exportData = results.clusters.map(row => {
        let sentimentScore = 'N/A';
        const rawSentiment = row.nlp_sentiment_score ?? row.sentiment;
        if (typeof rawSentiment === 'number') {
           // If rawSentiment is already a percentage (e.g. 58, 98), use it directly
           // If it's a -1 to +1 score, convert it to percentage
           const score = rawSentiment > 1 || rawSentiment < -1 
               ? Math.round(rawSentiment) 
               : Math.round(((rawSentiment + 1) / 2) * 100);
           sentimentScore = `${score}%`;
           totalSentiment += score;
           sentimentCount++;
        }

        return {
          'Customer ID': row.customer_id || row.id || 'N/A',
          'Customer Segment': row.segment_display_name || row.segment_name || row.segment_family || 'Unassigned',
          'Total Spend': row.total_spend ? `$${Number(row.total_spend).toLocaleString()}` : '$0',
          'Total Purchases': Number(row.total_purchases || 0).toFixed(0),
          'Recency (Days)': Number(row.recency || 0).toFixed(0),
          'Sentiment Score': sentimentScore,
          'Sentiment Label': row.nlp_sentiment_label || 'N/A',
          'Campaign Response': (row.response == 1 || row.Response == 1) ? 'Accepted' : ((row.response == 0 || row.Response == 0) ? 'Not Accepted' : 'N/A'),
          'Income': row.income ? `$${Number(row.income).toLocaleString()}` : 'N/A'
        };
      });

      const avgSentimentScore = sentimentCount > 0 ? Math.round(totalSentiment / sentimentCount) : 0;
      const avgSentimentLabel = avgSentimentScore >= 65 ? 'Positive' : (avgSentimentScore <= 40 ? 'Negative' : 'Neutral');

      // Extract Bar Charts using html2canvas
      let charts = [];
      if (fmt === 'pdf') {
        const chartElements = document.querySelectorAll('.capture-chart');
        for (let i = 0; i < chartElements.length && i < 2; i++) {
          try {
            const canvas = await html2canvas(chartElements[i], { scale: 2, backgroundColor: null });
            charts.push(canvas.toDataURL('image/png', 1.0));
          } catch (e) {
            console.error("Failed to capture chart", e);
          }
        }
      }

      await exportReport('marketing', fmt, exportData, selected, {
        'Analysis': 'Customer segmentation and sentiment analysis',
        'Top Segment': topSegment,
        'Audience Groups': results.n_clusters,
        'Total Customers': results.clusters?.length,
        'Total Revenue': results.total_customer_spend ? `$${Number(results.total_customer_spend).toLocaleString()}` : 'N/A',
        'Average Spend / Customer': results.avg_spend_per_customer ? `$${Number(results.avg_spend_per_customer).toLocaleString()}` : 'N/A',
        'High Value Customers': results.high_value_customer_count || 'N/A',
        'Audience Sentiment Score': `${avgSentimentScore}% (${avgSentimentLabel})`,
      }, charts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    finally { setExporting(false); }
  }, [results, selected]);

  const handleCsvExport = useCallback(() => {
    handleExport('csv');
  }, [handleExport]);

  const handlePdfExport = useCallback(() => {
    handleExport('pdf');
  }, [handleExport]);

  const handleSelectedChange = useCallback((event) => {
    setSelected(event.target.value);
  }, []);

  const handleClustersChange = useCallback((event) => {
    setClusters(event.target.value);
  }, []);

  /* ─── All derived data — each memoized independently ─── */

  const marketingRows = useMemo(() => (
    Array.isArray(results?.clusters) ? results.clusters : []
  ), [results?.clusters]);

  const businessSortedMarketingRows = useMemo(() => (
    sortSegmentsBusinessWise(marketingRows)
  ), [marketingRows]);

  const segmentProfiles = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.segment_profiles) ? results.segment_profiles : []))
  ), [results?.segment_profiles]);

  const segmentCounts = useMemo(() => {
    const distributionEntries = results?.segment_distribution ? Object.entries(results.segment_distribution) : [];
    const hasGenericDistributionLabels = distributionEntries.some(([name]) => isGenericSegmentLabel(name));
    if (distributionEntries.length && !hasGenericDistributionLabels) return distributionEntries;
    if (segmentProfiles.length) {
      return segmentProfiles.map(profile => [
        profile.segment_display_name,
        Number(profile.customer_count) || 0
      ]);
    }
    return distributionEntries;
  }, [results?.segment_distribution, segmentProfiles]);

  const sortedSegmentCounts = useMemo(() => (
    sortSegmentsBusinessWise(segmentCounts)
  ), [segmentCounts]);

  const largestSegmentCounts = useMemo(() => (
    [...segmentCounts].sort((a, b) => b[1] - a[1])
  ), [segmentCounts]);

  const segmentRecommendations = useMemo(() => (
    sortSegmentsBusinessWise(Array.isArray(results?.segment_recommendations) ? results.segment_recommendations : [])
  ), [results?.segment_recommendations]);

  const recommendationsBySegment = useMemo(() => segmentRecommendations.reduce((acc, item) => {
    if (item?.segment_display_name) acc[item.segment_display_name] = item;
    return acc;
  }, {}), [segmentRecommendations]);

  const visibleSegmentCount = segmentProfiles.length || segmentCounts.length || results?.n_clusters || 0;

  const topSegmentProfile = useMemo(() => (
    segmentProfiles.reduce((best, profile) => {
      if (!best) return profile;
      return (Number(profile.customer_count) || 0) > (Number(best.customer_count) || 0) ? profile : best;
    }, null)
  ), [segmentProfiles]);

  const topSegment = topSegmentProfile?.segment_display_name || largestSegmentCounts[0]?.[0] || 'N/A';
  const totalCustomers = results?.total_customers || marketingRows.length || 0;
  const totalPurchases = useMemo(() => (
    marketingRows.reduce((sum, row) => {
      const purchases = getNumericValue(row?.total_purchases ?? row?.Total_Purchases ?? row?.purchases);
      return purchases === null ? sum : sum + purchases;
    }, 0)
  ), [marketingRows]);
  const avgPurchasesPerCustomer = totalCustomers ? totalPurchases / totalCustomers : null;

  const recommendationTextBySegment = useMemo(() => (
    Object.fromEntries(segmentRecommendations.map(item => [item.segment_display_name, item.recommended_action]))
  ), [segmentRecommendations]);

  const sizeDistributionData = useMemo(() => sortedSegmentCounts.map(([name, count]) => ({
    segment_display_name: name,
    customer_count: count,
    share_pct: totalCustomers ? (count / totalCustomers) * 100 : 0
  })), [sortedSegmentCounts, totalCustomers]);

  const spendBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.spend_by_segment) ? results.spend_by_segment : segmentProfiles.map(profile => ({
      segment_display_name: profile.segment_display_name,
      total_spend: profile.total_spend,
      avg_spend: profile.avg_spend,
      customer_count: profile.customer_count
    }))))
  ), [results?.spend_by_segment, segmentProfiles]);

  const campaignResponseBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.campaign_response_by_segment) ? results.campaign_response_by_segment : segmentProfiles.map(profile => ({
      segment_display_name: profile.segment_display_name,
      response_rate: profile.response_rate,
      customer_count: profile.customer_count
    }))))
  ), [results?.campaign_response_by_segment, segmentProfiles]);

  const sentimentBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.sentiment_by_segment) ? results.sentiment_by_segment : segmentProfiles.map(profile => ({
      segment_display_name: profile.segment_display_name,
      sentiment_score: profile.sentiment_score,
      avg_sentiment: profile.avg_sentiment,
      customer_count: profile.customer_count
    }))))
  ), [results?.sentiment_by_segment, segmentProfiles]);

  const recencyBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.recency_by_segment) ? results.recency_by_segment : segmentProfiles.map(profile => ({
      segment_display_name: profile.segment_display_name,
      avg_recency: profile.avg_recency,
      customer_count: profile.customer_count
    }))))
  ), [results?.recency_by_segment, segmentProfiles]);

  const productSpendBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.product_spend_by_segment) ? results.product_spend_by_segment : []))
  ), [results?.product_spend_by_segment]);

  const channelMixBySegment = useMemo(() => (
    sortSegmentsBusinessWise(normalizeSegmentRows(Array.isArray(results?.channel_mix_by_segment) ? results.channel_mix_by_segment : []))
  ), [results?.channel_mix_by_segment]);

  const averagePurchasesBySegment = useMemo(() => sortSegmentsBusinessWise(segmentProfiles.map(profile => ({
    segment_display_name: profile.segment_display_name,
    avg_purchases: profile.avg_purchases,
    customer_count: profile.customer_count
  }))), [segmentProfiles]);

  const highValueSegmentSummary = useMemo(() => {
    const validProfiles = segmentProfiles.filter(profile => (
      getNumericValue(profile?.avg_spend) !== null &&
      getNumericValue(profile?.avg_purchases) !== null &&
      getNumericValue(profile?.customer_count) !== null &&
      Number(profile.customer_count) > 0
    ));

    const totalProfileCustomers = validProfiles.reduce((sum, profile) => sum + Number(profile.customer_count), 0);
    if (!totalProfileCustomers) {
      return { count: 0, segmentKeys: new Set(), overallAvgSpend: null, overallAvgPurchases: null };
    }

    const weightedAvgSpend = validProfiles.reduce((sum, profile) => (
      sum + Number(profile.avg_spend) * Number(profile.customer_count)
    ), 0) / totalProfileCustomers;
    const weightedAvgPurchases = validProfiles.reduce((sum, profile) => (
      sum + Number(profile.avg_purchases) * Number(profile.customer_count)
    ), 0) / totalProfileCustomers;
    const overallAvgSpend = getNumericValue(results?.avg_spend_per_customer) ?? weightedAvgSpend;

    const highValueProfiles = validProfiles.filter(profile => (
      Number(profile.avg_spend) > overallAvgSpend &&
      Number(profile.avg_purchases) >= weightedAvgPurchases
    ));

    const segmentKeys = new Set();
    highValueProfiles.forEach(profile => {
      [
        profile.segment_display_name,
        profile.segment_name,
        profile.segment_family
      ].forEach(value => {
        if (value) segmentKeys.add(normalizeSegmentPriorityText(value));
      });
    });

    return {
      count: highValueProfiles.reduce((sum, profile) => sum + Number(profile.customer_count), 0),
      segmentKeys,
      overallAvgSpend,
      overallAvgPurchases: weightedAvgPurchases
    };
  }, [segmentProfiles, results?.avg_spend_per_customer]);

  const highValueBySegment = useMemo(() => {
    return sortSegmentsBusinessWise(segmentProfiles.map(profile => {
      const segmentKey = normalizeSegmentPriorityText(profile.segment_display_name || profile.segment_name || profile.segment_family);
      return {
        segment_display_name: profile.segment_display_name,
        high_value_count: highValueSegmentSummary.segmentKeys.has(segmentKey) ? Number(profile.customer_count) || 0 : 0,
        customer_count: profile.customer_count
      };
    }));
  }, [segmentProfiles, highValueSegmentSummary]);

  /* ─── Precompute scatter grouping at parent level (avoids grouping inside chart on every render) ─── */
  const incomeSpendGrouped = useMemo(() => {
    const groups = {};
    marketingRows.forEach(item => {
      const segment = item.segment_display_name || item.segment_name || 'Segment';
      if (!groups[segment]) groups[segment] = [];
      const income = Number(item.income);
      const total_spend = Number(item.total_spend);
      if (Number.isFinite(income) && Number.isFinite(total_spend)) {
        groups[segment].push({ income, total_spend, customer_id: item.customer_id, segment });
      }
    });
    return sortSegmentsBusinessWise(Object.entries(groups).map(([name, rows]) => ({ name, rows })));
  }, [marketingRows]);

  const segmentOptions = useMemo(() => (
    sortedSegmentCounts.map(([name]) => name)
  ), [sortedSegmentCounts]);

  const rfmInsights = useMemo(() => {
    const profiles = Array.isArray(segmentProfiles) ? segmentProfiles : [];
    const profileName = (profile) => profile?.segment_display_name || profile?.segment_name || 'Segment';
    const profileColor = (profile) => getSegmentColor(profileName(profile));
    const validSpendProfiles = profiles.filter(profile => getNumericValue(profile?.avg_spend) !== null);
    const validRecencyProfiles = profiles.filter(profile => getNumericValue(profile?.avg_recency) !== null);
    const validSentimentProfiles = profiles.filter(profile => getNumericValue(profile?.sentiment_score) !== null);

    const highestValue = validSpendProfiles.reduce((best, profile) => {
      if (!best) return profile;
      return Number(profile.avg_spend) > Number(best.avg_spend) ? profile : best;
    }, null);

    const mostRecent = validRecencyProfiles.reduce((best, profile) => {
      if (!best) return profile;
      return Number(profile.avg_recency) < Number(best.avg_recency) ? profile : best;
    }, null);

    const spendP75 = getPercentile(marketingRows.map(row => row.total_spend), 0.75);
    const recencyP75 = getPercentile(marketingRows.map(row => row.recency), 0.75);
    const highValueWinBackCount = spendP75 === null || recencyP75 === null
      ? null
      : marketingRows.filter(row => {
        const spend = getNumericValue(row.total_spend);
        const recency = getNumericValue(row.recency);
        return spend !== null && recency !== null && spend >= spendP75 && recency >= recencyP75;
      }).length;

    const profileRecencyP75 = getPercentile(profiles.map(profile => profile.avg_recency), 0.75);
    const highValueHighRecency = profileRecencyP75 === null
      ? null
      : validSpendProfiles
        .filter(profile => getNumericValue(profile.avg_recency) !== null && Number(profile.avg_recency) >= profileRecencyP75)
        .sort((a, b) => Number(b.avg_spend) - Number(a.avg_spend))[0] || null;

    const lowestSentiment = validSentimentProfiles.reduce((lowest, profile) => {
      if (!lowest) return profile;
      return Number(profile.sentiment_score) < Number(lowest.sentiment_score) ? profile : lowest;
    }, null);

    const topCountName = largestSegmentCounts[0]?.[0];
    const topCountProfile = profiles.find(profile => profileName(profile) === topCountName) || null;
    const actionFocus = highValueHighRecency || lowestSentiment || topCountProfile || profiles[0] || null;
    const actionFocusName = actionFocus ? profileName(actionFocus) : null;
    const actionRecommendation = actionFocusName
      ? recommendationsBySegment[actionFocusName]?.recommended_action
      : null;

    const primarySpendRows = normalizeSegmentSpendRows(results?.spend_by_segment);
    const profileSpendRows = normalizeSegmentSpendRows(profiles);
    const clusterSpendRows = aggregateSegmentSpendRows(marketingRows);
    const segmentSpendRows = primarySpendRows.length
      ? primarySpendRows
      : profileSpendRows.length
        ? profileSpendRows
        : clusterSpendRows;
    const spendTotal = getNumericValue(results?.total_customer_spend) || segmentSpendRows.reduce((sum, row) => sum + row.total_spend, 0);
    const spendLeader = segmentSpendRows.reduce((leader, row) => {
      if (!leader) return row;
      return row.total_spend > leader.total_spend ? row : leader;
    }, null);
    const spendLeaderShare = spendLeader && spendTotal
      ? (spendLeader.total_spend / spendTotal) * 100
      : null;

    return [
      {
        label: 'Highest Avg Spend / Customer',
        value: highestValue ? profileName(highestValue) : 'Insight unavailable',
        detail: highestValue ? `Avg spend: ${formatCurrencyInsight(highestValue.avg_spend)}` : 'Not enough spend data yet.',
        color: highestValue ? profileColor(highestValue) : '#2563EB'
      },
      {
        label: 'Most Recent Segment',
        value: mostRecent ? profileName(mostRecent) : 'Insight unavailable',
        detail: mostRecent ? `Avg recency: ${formatMetricValue(mostRecent.avg_recency, 0)} days` : 'Not enough recency data yet.',
        color: mostRecent ? profileColor(mostRecent) : '#2563EB'
      },
      {
        label: 'High-Value Win-Back',
        value: highValueWinBackCount === null ? 'Insight unavailable' : `${formatStandardNumber(highValueWinBackCount)} customers`,
        detail: 'High spend but less recent activity',
        color: '#D97706'
      },
      {
        label: 'Segment Action Focus',
        value: actionFocusName || 'Insight unavailable',
        detail: actionRecommendation || 'Use tailored outreach for the segment needing the most attention.',
        color: actionFocus ? profileColor(actionFocus) : '#2563EB'
      },
      {
        label: 'Largest Total Spend Segment',
        value: spendLeader && spendLeaderShare !== null
          ? `${spendLeader.segment_display_name} drives ${formatPercent(spendLeaderShare, 1)} of total spend`
          : 'Insight unavailable',
        detail: 'Based on segment-wide customer spend',
        color: spendLeader ? getSegmentColor(spendLeader.segment_display_name) : '#2563EB'
      }
    ];
  }, [marketingRows, segmentProfiles, largestSegmentCounts, recommendationsBySegment, results?.spend_by_segment, results?.total_customer_spend]);

  const [showNlp, setShowNlp] = useState(false);
  const [showSegmentPerformance, setShowSegmentPerformance] = useState(false);
  const [showRfm, setShowRfm] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (results && !loading) {
      // Wait for the 500ms intro animation of KPI cards to finish before rendering heavy charts to prevent jitter
      const nlpTimer = setTimeout(() => setShowNlp(true), 150);
      const spTimer = setTimeout(() => setShowSegmentPerformance(true), 600);
      const rfmTimer = setTimeout(() => setShowRfm(true), 800);
      const tableTimer = setTimeout(() => setShowTable(true), 1000);
      return () => {
        clearTimeout(nlpTimer);
        clearTimeout(spTimer);
        clearTimeout(rfmTimer);
        clearTimeout(tableTimer);
      };
    } else {
      setShowNlp(false);
      setShowSegmentPerformance(false);
      setShowRfm(false);
      setShowTable(false);
    }
  }, [results, loading]);

  return (
    <div className="dashboard-content-fade-in">
      <Navbar
        title="Marketing Insights"
        subtitle="Group customers by spending habits and feedback sentiment to target them better."
        actions={results ? (
          <>
            <select
              style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 500, minWidth: '150px' }}
              value={selected}
              onChange={handleSelectedChange}
            >
              <option value="">Dataset ID</option>
              {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '0.35rem 0.5rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <label style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Groups:</label>
              <select value={clusters} onChange={handleClustersChange} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', width: '56px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>
                {CLUSTER_OPTIONS.map(option => (
                  <option key={option} value={option}>{option === 'auto' ? 'Auto' : option}</option>
                ))}
              </select>
            </div>

            <button onClick={handleKMeans} disabled={loading || !selected || !isClusterCountValid} style={{ padding: '0.55rem 1.25rem', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? '⏳...' : <><Play size={14} fill="currentColor" /> Run</>}
            </button>

            <button onClick={handleCsvExport} disabled={exporting} style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={handlePdfExport} disabled={exporting} style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
              <Download size={14} /> PDF
            </button>
          </>
        ) : null}
      />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {datasets.length === 0 && !isFetching && !loading && (
        <EmptyState moduleName="Marketing" />
      )}

      {!results && datasets.length > 0 && !isFetching && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div style={{
            maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)', transition: 'border-color 0.2s'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#000000';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Target size={32} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Start Segmentation</h3>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Select an audience list to begin AI-driven grouping.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Audience Dataset</label>
                <select
                  style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, width: '100%' }}
                  value={selected}
                  onChange={handleSelectedChange}
                >
                  <option value="">-- Select Dataset --</option>
                  {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Number of Segments (K)</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <span style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: 500 }}>Groups:</span>
                  <select value={clusters} onChange={handleClustersChange} style={{ background: 'var(--bg-card)', border: '1px solid #CBD5E1', borderRadius: '6px', color: 'var(--text-main)', width: '76px', padding: '0.25rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
                    {CLUSTER_OPTIONS.map(option => (
                      <option key={option} value={option}>{option === 'auto' ? 'Auto' : option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={handleKMeans} disabled={!selected} style={{ padding: '0.85rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem', width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
                <Play size={16} fill="currentColor" /> Run Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      <ErrorMessage message={error} />
      {loading && (
        <DashboardLoadingState
          title="Segmenting Your Audience"
          subtitle="AI is grouping customers by spending behavior, recency, and campaign response."
          statusText="Running K-Means segmentation..."
        />
      )}

      {results && !loading && (
        <div key={runVersion} style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <MarketingKpiSection
            results={results}
            totalCustomers={totalCustomers}
            visibleSegmentCount={visibleSegmentCount}
            topSegment={topSegment}
            avgPurchasesPerCustomer={avgPurchasesPerCustomer}
            highValueCustomerCount={highValueSegmentSummary.count}
          />

          <AutoKInsight results={results} />

          <AiSegmentIntelligenceSection
            segmentProfiles={segmentProfiles}
            recommendationsBySegment={recommendationsBySegment}
          />

          {showNlp && (
            <div className="dashboard-content-fade-in" style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <NlpFeedbackIntelligenceSection 
                nlpInsights={results.nlp_insights} 
                customerRows={businessSortedMarketingRows}
                segmentOptions={segmentOptions}
              />
            </div>
          )}

          {showSegmentPerformance && (
            <div className="dashboard-content-fade-in" style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <SegmentPerformanceSection
                sizeDistributionData={sizeDistributionData}
                spendBySegment={spendBySegment}
                campaignResponseBySegment={campaignResponseBySegment}
                sentimentBySegment={sentimentBySegment}
                recencyBySegment={recencyBySegment}
                productSpendBySegment={productSpendBySegment}
                channelMixBySegment={channelMixBySegment}
                averagePurchasesBySegment={averagePurchasesBySegment}
                highValueBySegment={highValueBySegment}
                incomeSpendGrouped={incomeSpendGrouped}
              />
            </div>
          )}

          {showRfm && (
            <div className="dashboard-content-fade-in" style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <RfmBehavioralSection
                marketingRows={businessSortedMarketingRows}
                rfmInsights={rfmInsights}
              />
            </div>
          )}

          {showTable && (
            <div className="dashboard-content-fade-in" style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <CustomerSegmentTableSection
                marketingRows={businessSortedMarketingRows}
                segmentOptions={segmentOptions}
                recommendationTextBySegment={recommendationTextBySegment}
                highValueSegmentKeys={highValueSegmentSummary.segmentKeys}
              />

              <MarketingExplorerSection marketingRows={businessSortedMarketingRows} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketingAnalysis;

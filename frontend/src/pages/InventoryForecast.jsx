import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { listDatasets } from '../api/datasetAPI';
import API from '../api/index';
import { exportReport } from '../api/reportAPI';

import Navbar from '../components/common/Navbar';
import EmptyState from '../components/common/EmptyState';
import DashboardLoadingState from '../components/common/DashboardLoadingState';
import { PremiumCard, PremiumIconBox } from '../components/marketing/PremiumCard';

import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

import { 
  PackageSearch, TrendingUp, Calendar, ShoppingCart, Target, Box, AlertTriangle, PackageCheck, Download, Activity, Search, ShieldCheck, Zap, Sparkles, ArrowLeft, Play, CloudRain, Tag, Percent, MapPin, Store, DollarSign
} from 'lucide-react';

const formatChartNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatTableWholeNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return Math.round(num).toLocaleString();
};

const formatTableDemandNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return Math.round(num).toLocaleString();
};

const formatCompactNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
};

const getCompactFormatter = formatCompactNumber;

const formatPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatOperationalDate = (value) => {
  if (!value) return "—";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(value);
  }

  const text = String(value);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!isoMatch) return text;

  const [, year, month, day] = isoMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const formatTableDecimal = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return value || "—";

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatTableDiscount = (value) => {
  if (value === null || value === undefined || value === '') return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);

  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
};

const formatPromotionStatus = (value) => {
  if (value === null || value === undefined || value === '') return "—";
  const normalized = String(value).trim().toLowerCase();

  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'promotion'
    ? 'Promotion'
    : 'No Promotion';
};

const OPERATIONAL_INVENTORY_COLUMNS = [
  { label: 'Date', field: 'Date', format: formatOperationalDate, nowrap: true },
  { label: 'Store ID', field: 'Store ID' },
  { label: 'Product ID', field: 'Product ID' },
  { label: 'Category', field: 'Category' },
  { label: 'Region', field: 'Region' },
  { label: 'Inventory Level', field: 'Inventory Level', format: formatTableWholeNumber },
  { label: 'Units Sold', field: 'Units Sold', format: formatTableWholeNumber },
  { label: 'Units Ordered', field: 'Units Ordered', format: formatTableWholeNumber },
  { label: 'Price', field: 'Price', format: formatTableDecimal },
  { label: 'Discount', field: 'Discount', format: formatTableDiscount },
  { label: 'Promotion', field: 'Holiday/Promotion', format: formatPromotionStatus },
  { label: 'Competitor Price', field: 'Competitor Pricing', format: formatTableDecimal },
  { label: 'Weather', field: 'Weather Condition' },
  { label: 'Seasonality', field: 'Seasonality' },
];

const STOCK_RISK_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

const getAlertSeverity = (alert) => String(alert?.severity || '').toUpperCase();

const hasRealDimensionValue = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();

  return Boolean(normalized) && !['undefined', 'null', 'unknown'].includes(normalized);
};

const getAlertDimension = (alert, groupBy) => {
  switch (groupBy) {
    case 'Category':
      return alert.category || alert.Category || alert.product_category || alert.productCategory || alert['Product Category'];
    case 'Product':
      return alert.product_id || alert.productId || alert.product || alert['Product ID'];
    case 'Store':
      return alert.store_id || alert.storeId || alert.store || alert['Store ID'];
    case 'Region':
      return alert.region || alert.Region;
    default:
      return null;
  }
};

const getAlertDimensionLabel = (alert, groupBy) => {
  const rawValue = getAlertDimension(alert, groupBy);
  const value = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

  if (!hasRealDimensionValue(value)) {
    return `Unknown ${groupBy}`;
  }

  return value;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '12px 16px 8px 16px', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 1000, fontFamily: "'Inter', sans-serif" }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: entry.color || '#3B82F6', marginRight: '6px' }}></span>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{entry.name}</span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A', marginLeft: '12px' }}>
                {(!isNaN(entry.value) && entry.value !== null && entry.value !== '') ? formatChartNumber(entry.value) : entry.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const EmptyChartState = ({ message = "This visualization is prepared for inventory analytics data." }) => (
  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', minHeight: '200px' }}>
    <p style={{ color: '#64748B', fontSize: '0.9rem', textAlign: 'center', padding: '1rem', fontWeight: 500 }}>{message}</p>
  </div>
);

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

const MetricCard = ({ icon: Icon, label, value, color, microcopy }) => (
  <PremiumCard color={color} padding="1.25rem" delay={0.05}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, margin: 0, paddingRight: '8px', lineHeight: 1.2 }}>{label}</p>
        <PremiumIconBox icon={Icon} color={color} size={18} style={{ width: 36, height: 36, borderRadius: '10px', marginBottom: 0, flexShrink: 0 }} />
      </div>
      <div style={{ marginTop: 'auto' }}>
        <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Manrope', sans-serif", lineHeight: 1.2, margin: 0 }}>{value}</p>
        {microcopy && (
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '6px 0 0 0', fontWeight: 500 }}>{microcopy}</p>
        )}
      </div>
    </div>
  </PremiumCard>
);

const FutureAIForecastChart = React.memo(({ data, forecastDays }) => {
  const option = useMemo(() => {
    return {
      title: {
        text: `Future AI Forecast (Next ${forecastDays || 7} Days)`,
        subtext: 'Live production forecasting for the upcoming days, aggregated across all categories.',
        left: '1%',
        top: '0%',
        textStyle: { color: '#0F172A', fontSize: 18, fontWeight: 800, fontFamily: "'Inter', sans-serif" },
        subtextStyle: { color: '#64748B', fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E2E8F0',
        textStyle: { color: '#0F172A' },
        formatter: (params) => {
          let res = `<div style="font-weight:700;margin-bottom:6px;color:#1E293B;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">${params[0].axisValue}</div>`;
          params.forEach(p => {
             res += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:13px;color:#334155;margin-top:4px;">
                       <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:8px;box-shadow:0 0 4px ${p.color};"></span>${p.seriesName}</span>
                       <span style="font-weight:700">${formatCompactNumber(p.value)}</span>
                     </div>`;
          });
          return res;
        }
      },
      legend: { top: '12%', right: '3%', textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 } },
      grid: { left: '1%', right: '3%', bottom: '2%', top: '25%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(item => item.date),
        axisLabel: { color: '#64748B', fontSize: 12, fontWeight: 500, padding: [6, 0, 0, 0] },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'value',
        scale: true,
        min: (value) => Math.floor(value.min * 0.95),
        max: (value) => Math.ceil(value.max * 1.05),
        axisLabel: { formatter: (value) => formatCompactNumber(value), color: '#64748B', fontSize: 12, fontWeight: 500 },
        splitLine: { lineStyle: { type: 'dashed', color: '#F1F5F9' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: 'Predicted Demand',
          type: 'line',
          data: data.map(item => item.demand),
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 10,
          showSymbol: true,
          label: {
            show: true,
            position: 'top',
            distance: 10,
            formatter: (p) => formatCompactNumber(p.value),
            color: '#1E293B',
            fontSize: 12,
            fontWeight: 700,
            backgroundColor: 'rgba(255,255,255,0.7)',
            padding: [2, 4],
            borderRadius: 4
          },
          itemStyle: { color: '#6366F1', borderColor: '#ffffff', borderWidth: 2 },
          lineStyle: { 
            color: '#6366F1', 
            width: 4,
            shadowColor: 'rgba(99, 102, 241, 0.4)',
            shadowBlur: 10,
            shadowOffsetY: 5
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99, 102, 241, 0.2)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0)' }
            ])
          }
        }
      ]
    };
  }, [data, forecastDays]);

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', minHeight: 350 }} notMerge={true} lazyUpdate={true} />;
});

const InventoryForecast = () => {
  const { user } = useAuth();
  const { inventoryState, setInventoryState } = useApp();
  const [datasets, setDatasets] = useState([]);
  
  const [selected, setSelected] = useState(inventoryState.selected);
  const [forecastDays, setForecastDays] = useState(inventoryState.forecastDays || 7);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(inventoryState.results);
  const [exporting, setExporting] = useState(false);

  // Table state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  
  // AI Decision Table state
  const [decisionPage, setDecisionPage] = useState(1);
  const [decisionPageSize] = useState(10);

  // Chart Filters State
  // Section 2: No period filters, only view/risk/groupBy
  // Section 3: period + metric, powered by historicalAnalytics
  const [chartFilters, setChartFilters] = useState({
    // Section 2 — Decision Support (no time filters)
    stockCoverage: { view: 'coverage_days', category: 'all', store: 'all', region: 'all' },
    criticalRisks: { riskLevel: 'all', groupBy: 'Product', category: 'all', store: 'all', region: 'all' },
    // Section 3 — Historical Analytics (period + metric)
    inventoryTrend: { period: 'all', metric: 'sold' },
    demandByCategory: { period: 'all', metric: 'demand' },
    inventoryVsDemand: { period: 'all', comparison: 'stock_vs_demand' },
    demandByStore: { period: 'all', metric: 'demand' },
    demandByRegion: { period: 'all', metric: 'demand' },
    seasonality: { period: 'all', metric: 'demand' },
    weatherImpact: { period: 'all', metric: 'demand' },
    priceGap: { period: 'all', metric: 'demand' },
    promotionImpact: { period: 'all', metric: 'demand' }
  });

  useEffect(() => {
    setInventoryState({ selected, forecastDays, results });
  }, [selected, forecastDays, results]);

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

  const handleForecast = async () => {
    if (!selected) return setError('Please select a dataset.');
    if (!user?.email) return setError("User identity not confirmed.");
    setLoading(true); setError(null);
    try {
      const res = await API.post('/inventory/forecast', { dataset_id: selected, forecast_days: forecastDays, email: user.email });
      setResults(res);
      setPage(1);
      setDecisionPage(1);
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  };

  const handleExport = async (fmt) => {
    if (!results) return;
    setExporting(true);
    try {
      let chartImages = [];
      if (fmt === 'pdf') {
        const echartCanvases = document.querySelectorAll('.capture-chart .echarts-for-react canvas');
        for (let i = 0; i < echartCanvases.length && i < 2; i++) {
          try {
            chartImages.push(echartCanvases[i].toDataURL('image/png', 1.0));
          } catch (err) {
            console.error("Chart export failed", err);
          }
        }
      }

      const exportData = alerts.map(alert => {
        const product = getAlertDimensionLabel(alert, 'Product');
        const store = getAlertDimensionLabel(alert, 'Store');
        const category = getAlertDimensionLabel(alert, 'Category');
        const region = getAlertDimensionLabel(alert, 'Region');
        const severityStr = getAlertSeverity(alert);
        const currentStock = alert.current_stock || alert.current_inventory || alert.current_qty || 0;
        const predictedDemand = alert.forecast_demand || alert.arima_forecast_demand || alert.predicted_demand || alert.demand_forecast || 0;
        const recommendedOrder = alert.q_reorder_suggestion || alert.recommended_reorder || 0;

        return {
          'Product ID': product,
          'Store ID': store,
          'Category': category,
          'Region': region,
          'Current Stock': Math.round(Number(currentStock) || 0),
          'AI Demand Forecast': Math.round(Number(predictedDemand) || 0),
          'Recommended Order Qty': Math.round(Number(recommendedOrder) || 0),
          'Risk Level': severityStr
        };
      });

      await exportReport('inventory', fmt, exportData, selected, {
        'Forecast Period': `${forecastDays} Days`,
        'Total Historical Units Sold': totalUnitsSold ? Math.round(Number(totalUnitsSold)).toLocaleString() : 'N/A',
        'AI Forecasted Demand': Math.round(aiForecastedDemand).toLocaleString(),
        'Total Recommended Reorder': Math.round(recommendedOrderQty).toLocaleString(),
        'High Priority Stock Risks': highPriorityStockRisks,
        'Total Risk Alerts': alerts.length
      }, chartImages);
    } catch (err) { 
      setError(err instanceof Error ? err.message : String(err)); 
    }
    finally { setExporting(false); }
  };

  const kpis = results?.kpis || {};
  const datasetKpis = results?.datasetKpis || results?.dataset_kpis || {};
  const totalUnitsSold = datasetKpis.totalUnitsSold ?? datasetKpis.total_units_sold;
  const totalUnitsOrdered = datasetKpis.totalUnitsOrdered ?? datasetKpis.total_units_ordered;
  const netSalesValue = datasetKpis.netSalesValue ?? datasetKpis.net_sales_value;
  const charts = results?.charts || {};
  const alerts = results?.low_stock_alerts || [];
  const inventoryDetail = results?.tables?.inventory_detail || [];
  const stockRiskDetailLookup = useMemo(() => {
    const lookup = new Map();

    inventoryDetail.forEach((row) => {
      const product = String(row['Product ID'] ?? '').trim();
      const store = String(row['Store ID'] ?? '').trim();
      if (!product || !store) return;

      lookup.set(`${product}::${store}`, {
        category: row['Category'],
        region: row['Region'],
      });
    });

    return lookup;
  }, [inventoryDetail]);

  const stockRiskAlerts = useMemo(() => (
    alerts.map((alert) => {
      const product = String(getAlertDimension(alert, 'Product') ?? '').trim();
      const store = String(getAlertDimension(alert, 'Store') ?? '').trim();
      const detail = product && store ? stockRiskDetailLookup.get(`${product}::${store}`) : null;
      const category = hasRealDimensionValue(getAlertDimension(alert, 'Category'))
        ? getAlertDimension(alert, 'Category')
        : detail?.category;
      const region = hasRealDimensionValue(getAlertDimension(alert, 'Region'))
        ? getAlertDimension(alert, 'Region')
        : detail?.region;

      return {
        ...alert,
        category: hasRealDimensionValue(category) ? category : alert.category,
        region: hasRealDimensionValue(region) ? region : alert.region,
      };
    })
  ), [alerts, stockRiskDetailLookup]);
  const backtest = results?.backtest_evaluation || {};
  const production = results?.production_forecast || {};

  // Extract historicalAnalytics from results (full dataset, NOT capped table data)
  const histAnalytics = results?.historicalAnalytics || {};
  const histCoverage = histAnalytics?.coverage || {};
  const histAvailDays = histCoverage?.availableDays || 0;
  const histLatestDate = histCoverage?.latestDate || null;

  // ---- UTC-safe date helpers (avoids timezone-shift bugs on YYYY-MM-DD strings) ----
  // new Date("2024-01-01") parses as UTC midnight but setMonth/getMonth operates in local time
  // which causes the period start date to shift by timezone offset. Parse manually via UTC.
  const parseUTCDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const getStartDate = useCallback((periodValue) => {
    if (!histLatestDate) return null;
    const [ly, lm, ld] = histLatestDate.split('-').map(Number);
    if (periodValue.endsWith('m')) {
      const months = parseInt(periodValue.replace(/[^0-9]/g, ''));
      // Subtract calendar months from the latest date, then +1 day to get startDate
      let startY = ly, startM = lm - 1 - months; // lm-1 = 0-indexed month
      while (startM < 0) { startM += 12; startY -= 1; }
      // +1 day: advance one day
      let startD = ld;
      startD += 1;
      const tempDate = new Date(Date.UTC(startY, startM, startD));
      return tempDate;
    } else {
      const days = parseInt(periodValue.replace(/[^0-9]/g, ''));
      const latest = new Date(Date.UTC(ly, lm - 1, ld));
      return new Date(latest.getTime() - (days - 1) * 86400000);
    }
  }, [histLatestDate]);

  // Section 3 helper: filter daily records by period and aggregate by group
  const aggregateHistorical = useCallback((dailyData, groupField, metricField, periodValue, useMean = false) => {
    if (!dailyData || !dailyData.length) return null;

    let rows = dailyData;
    if (periodValue !== 'all') {
      const startDate = getStartDate(periodValue);
      if (startDate) {
        rows = rows.filter(r => parseUTCDate(r.date) >= startDate);
      }
    }

    if (!rows.length) return null;

    const grouped = {};
    rows.forEach(r => {
      const key = r[groupField] || 'Unknown';
      if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
      grouped[key].sum += (Number(r[metricField]) || 0);
      grouped[key].count += 1;
    });

    return Object.keys(grouped)
      .filter(k => k !== 'Unknown')
      .map(key => ({
        name: key,
        value: Number((useMean ? grouped[key].sum / grouped[key].count : grouped[key].sum).toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);
  }, [histLatestDate, getStartDate]);

  // Section 3 helper: get latest stock by group within period (NOT summed across dates)
  const getLatestStockByGroup = useCallback((dailyData, groupField, periodValue) => {
    if (!dailyData || !dailyData.length) return null;

    let rows = dailyData;
    if (periodValue !== 'all') {
      const startDate = getStartDate(periodValue);
      if (startDate) {
        rows = rows.filter(r => parseUTCDate(r.date) >= startDate);
      }
    }

    if (!rows.length) return null;

    // Find latest date in the filtered set
    const maxDate = rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date);
    const latestRows = rows.filter(r => r.date === maxDate);

    const result = {};
    latestRows.forEach(r => {
      const key = r[groupField] || 'Unknown';
      result[key] = (result[key] || 0) + (Number(r.stock) || 0);
    });

    return Object.keys(result)
      .filter(k => k !== 'Unknown')
      .map(key => ({ name: key, value: Number(result[key].toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [histLatestDate, getStartDate]);

  // Section 3 helper: filter daily trend by period for line/area charts
  const filterDailyTrend = useCallback((dailyData, periodValue) => {
    if (!dailyData || !dailyData.length) return [];

    let rows = dailyData;
    if (periodValue !== 'all') {
      const startDate = getStartDate(periodValue);
      if (startDate) {
        rows = rows.filter(r => parseUTCDate(r.date) >= startDate);
      }
    }

    return rows;
  }, [histLatestDate, getStartDate]);

  // Keep payloadMetrics for table filtering only (not for chart filters)
  const payloadMetrics = useMemo(() => {
    if (!inventoryDetail || !inventoryDetail.length) return null;
    const sample = inventoryDetail[0];
    const cols = Object.keys(sample);
    return {
      dateCol: cols.find(c => c.toLowerCase() === 'date'),
      catCol: cols.find(c => c.toLowerCase().includes('category')),
      storeCol: cols.find(c => c.toLowerCase().includes('store')),
      regionCol: cols.find(c => c.toLowerCase().includes('region')),
    };
  }, [inventoryDetail]);

  // Filter detail table
  const filteredDetail = useMemo(() => {
    if (!searchTerm) return inventoryDetail;
    const lower = searchTerm.toLowerCase();
    return inventoryDetail.filter(row => 
      String(row['Product ID'] || '').toLowerCase().includes(lower) ||
      String(row['Store ID'] || '').toLowerCase().includes(lower) ||
      String(row['Category'] || '').toLowerCase().includes(lower) ||
      String(row['Region'] || '').toLowerCase().includes(lower) ||
      String(row['Seasonality'] || '').toLowerCase().includes(lower) ||
      String(row['Weather Condition'] || '').toLowerCase().includes(lower)
    );
  }, [inventoryDetail, searchTerm]);

  const totalPages = Math.ceil(filteredDetail.length / pageSize);
  const currentTableData = filteredDetail.slice((page - 1) * pageSize, page * pageSize);

  const totalDecisionPages = Math.ceil(alerts.length / decisionPageSize);
  const currentDecisionData = alerts.slice((decisionPage - 1) * decisionPageSize, decisionPage * decisionPageSize);

  const aggregatedFuture = useMemo(() => {
    const raw = production?.arima_forecast || [];
    if (!raw.length) return [];
    const grouped = {};
    raw.forEach(r => {
      grouped[r.date] = (grouped[r.date] || 0) + (r.demand || 0);
    });
    return Object.keys(grouped).sort().map(d => ({ date: d, demand: grouped[d] }));
  }, [production]);

  const aiForecastedDemand = useMemo(() => (
    aggregatedFuture.reduce((sum, item) => sum + (Number(item.demand) || 0), 0)
  ), [aggregatedFuture]);

  const recommendedOrderQty = useMemo(() => (
    alerts.reduce((sum, alert) => sum + (Number(alert.q_reorder_suggestion) || 0), 0)
  ), [alerts]);

  const highPriorityStockRisks = useMemo(() => (
    alerts.filter(alert => alert.severity === 'CRITICAL' || alert.severity === 'HIGH').length
  ), [alerts]);

    const topReorderProducts = useMemo(() => {
    if (!alerts || !alerts.length) return [];
    const sorted = [...alerts].sort((a, b) => (b.recommended_reorder || 0) - (a.recommended_reorder || 0));
    return sorted.slice(0, 10).map(a => ({
      name: a.product_id || 'Unknown',
      value: a.recommended_reorder || 0
    })).filter(x => x.value > 0);
  }, [alerts]);

  const stockCoverageData = useMemo(() => {
    if (!charts.inventory_vs_demand || !charts.inventory_vs_demand.length) return [];
    
    return charts.inventory_vs_demand.map(item => {
      const demand = item.demand || 0;
      const currentStock = item.stock || 0;
      const safeDailyDemand = Math.max(demand / forecastDays, 1);
      const coverageDays = currentStock / safeDailyDemand;
      
      let status = 'Moderate Coverage';
      let fill = '#F59E0B'; // amber
      
      if (coverageDays < forecastDays) {
        status = 'Low Coverage';
        fill = '#EF4444'; // red
      } else if (coverageDays >= forecastDays * 1.5) {
        status = 'Healthy Coverage';
        fill = '#10B981'; // green
      }
      
      return {
        name: item.name,
        coverageDays: Number(coverageDays.toFixed(2)),
        status,
        fill
      };
    }).sort((a, b) => a.coverageDays - b.coverageDays);
  }, [charts.inventory_vs_demand, forecastDays]);

  const criticalRiskData = useMemo(() => {
    if (!alerts || !alerts.length) return { data: [], groupType: null };
    const critical = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');
    if (critical.length === 0) return { data: [], groupType: null };
    
    let groupType = null;
    let groupKey = null;
    if (critical.some(a => a.category || a.Category)) { groupType = 'Category'; groupKey = a => a.category || a.Category; }
    else if (critical.some(a => a.product_id || a.productId || a.product || a['Product ID'])) { groupType = 'Product'; groupKey = a => a.product_id || a.productId || a.product || a['Product ID']; }
    else if (critical.some(a => a.store_id || a.storeId || a.store || a['Store ID'])) { groupType = 'Store'; groupKey = a => a.store_id || a.storeId || a.store || a['Store ID']; }
    else if (critical.some(a => a.region || a.Region)) { groupType = 'Region'; groupKey = a => a.region || a.Region; }
    
    if (!groupType) return { data: [], groupType: null };

    const grouped = {};
    critical.forEach(c => {
      const label = groupKey(c);
      if (label) {
        grouped[label] = (grouped[label] || 0) + 1;
      }
    });
    
    const data = Object.keys(grouped).map(k => ({ name: k, count: grouped[k] })).sort((a, b) => b.count - a.count);
    return { data, groupType };
  }, [alerts]);

  const getTopItem = (arr, valKey, nameKey = 'name') => {
    if (!arr || !arr.length) return null;
    return arr.reduce((prev, current) => (prev[valKey] > current[valKey]) ? prev : current);
  };

  const handleFilterChange = useCallback((chartKey, filterKey, value) => {
    setChartFilters(prev => ({
      ...prev,
      [chartKey]: {
        ...prev[chartKey],
        [filterKey]: value
      }
    }));
  }, []);

  const ChartHeader = ({ 
    title, subtitle, 
    chartKey, filtersDef, 
    currentFilters, 
    availableDays 
  }) => {
    if (!filtersDef) return (
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{title}</h4>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>{subtitle}</p>
      </div>
    );

    const selectStyle = {
      padding: '4px 24px 4px 10px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#475569',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '6px',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 6px center',
      outline: 'none'
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{title}</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {filtersDef.metric && (
            <select 
              style={selectStyle} 
              value={currentFilters.metric || currentFilters.comparison || currentFilters.view} 
              onChange={(e) => handleFilterChange(chartKey, filtersDef.metric.key || 'metric', e.target.value)}
            >
              {filtersDef.metric.options.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
              ))}
            </select>
          )}
          {filtersDef.period && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select 
                style={selectStyle} 
                value={currentFilters.period} 
                onChange={(e) => handleFilterChange(chartKey, 'period', e.target.value)}
                aria-label="Time Range"
              >
                <option value="all">All Available Data</option>
                {[
                  { label: 'Last 7 Days', value: '7d', days: 7 },
                  { label: 'Last 14 Days', value: '14d', days: 14 },
                  { label: 'Last 30 Days', value: '30d', days: 30 },
                  { label: 'Last 90 Days', value: '90d', days: 90 },
                  { label: 'Last 3 Months', value: '3m', days: 90 },
                  { label: 'Last 6 Months', value: '6m', days: 180 },
                  { label: 'Last 12 Months', value: '12m', days: 365 }
                ].filter(opt => {
                  if (filtersDef.period.options) {
                    const daysOpt = opt.days;
                    // if filtersDef explicitly defined numeric options, only allow those (plus all)
                    if (!filtersDef.period.options.includes(daysOpt)) return false;
                  }
                  return availableDays && opt.days <= availableDays;
                }).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getChartInsight = (type) => {
    switch(type) {
      case 'category': {
        const top = getTopItem(charts.demand_by_category, 'value');
        if (!top) return null;
        return `${top.name} carries the highest demand for the selected time range, making it the primary category to monitor for stock readiness.`;
      }
      case 'store': {
        const top = getTopItem(charts.demand_by_store, 'value');
        if (!top) return null;
        return `Store ${top.name} shows the highest demand concentration in the selected time range.`;
      }
      case 'region': {
        const top = getTopItem(charts.demand_by_region, 'value');
        if (!top) return null;
        return `The ${top.name} region currently drives the highest demand share, indicating stronger replenishment pressure there.`;
      }
      case 'inv_vs_demand': {
        return `Categories where demand approaches or exceeds current stock should be prioritized for immediate replenishment.`;
      }
      case 'seasonality': {
        const top = getTopItem(charts.seasonality_impact, 'value');
        if (!top) return null;
        return `Demand peaks during ${top.name} seasons, highlighting periods that carry stronger supply chain pressure.`;
      }
      case 'weather': {
        const top = getTopItem(charts.weather_impact, 'total_demand');
        if (!top) return null;
        return `${top.name} weather conditions correlate with the highest demand spikes across categories.`;
      }
      case 'price': {
        if (cPrice.metric === 'avgGapPct') {
          return `Above and below competitor buckets show the average pricing gap for the selected period.`;
        }
        if (!dPrice || !dPrice.length) return null;
        const topP = dPrice.reduce((prev, cur) => (cur.value > prev.value ? cur : prev), dPrice[0]);
        if (cPrice.metric === 'sold') {
          return `${topP.name} pricing drives the highest units sold across competitor pricing buckets.`;
        }
        return `${topP.name} pricing correlates with the highest demand across competitor pricing buckets.`;
      }
      case 'promo': {
        const top = getTopItem(charts.promotion_impact, 'avg_sold');
        if (!top) return null;
        return `${top.name} periods show significant increases in demand and should be buffered accordingly.`;
      }
            case 'top_reorder': {
        return topReorderProducts && topReorderProducts.length > 0 
          ? `Low-stock products with the highest suggested reorder quantities require priority replenishment review.` 
          : `No low-stock products currently require AI reorder quantity action in this time range.`;
      }
      case 'critical_risks': {
        return criticalRiskData && criticalRiskData.data.length > 0
          ? `High-priority stock risks should be prioritized first.`
          : `No high-priority stock risks require immediate action in this time range.`;
      }
      case 'stock_coverage': {
        if (!stockCoverageData || !stockCoverageData.length) return null;
        const lowest = stockCoverageData[0];
        if (lowest.coverageDays < forecastDays * 1.5) {
          return `${lowest.name} has the lowest stock coverage and should be reviewed first.`;
        }
        return `All categories show stable stock coverage for the selected demand time range.`;
      }
      default: return null;
    }
  };

  const getReorderAction = (severity, currentStock, forecastDemand, recommendedOrderQty) => {
    const severityLevel = String(severity || '').toUpperCase();
    const stock = Number(currentStock) || 0;
    const demand = Number(forecastDemand) || 0;
    const orderQty = Number(recommendedOrderQty) || 0;
    const demandGap = demand - stock;
    const orderLabel = formatTableWholeNumber(orderQty);

    if (orderQty > 0 && severityLevel === 'CRITICAL') {
      if (stock <= 0) return `Order ${orderLabel} units now - stock is depleted at this store.`;
      return `Order ${orderLabel} units now to cover forecast demand.`;
    }
    if (orderQty > 0 && severityLevel === 'HIGH') {
      return `Order ${orderLabel} units this cycle to avoid a shortage.`;
    }
    if (orderQty > 0 && severityLevel === 'MEDIUM') {
      return `Order ${orderLabel} units in the current replenishment cycle.`;
    }
    if (orderQty > 0) {
      return `Order ${orderLabel} units during the next ordering cycle.`;
    }
    if ((severityLevel === 'CRITICAL' || severityLevel === 'HIGH') && demandGap > 0) {
      return 'Review replenishment now; forecast demand exceeds current stock.';
    }
    if (severityLevel === 'MEDIUM') {
      return 'Monitor closely and replenish in the current cycle.';
    }
    return 'No immediate order needed; monitor demand against current stock.';
  };

  const baseline_q = backtest?.metrics?.q_learning_policy?.baseline || {};
  const learned_q = backtest?.metrics?.q_learning_policy?.q_learning || {};
  const b_cost = baseline_q.estimated_total_cost || 0;
  const q_cost = learned_q.estimated_total_cost || 0;
  const costReduction = b_cost - q_cost;
  const costRedPct = b_cost > 0 ? (costReduction / b_cost * 100) : 0;

  // --- CHART DYNAMIC LOGIC ---
  const histAvail = histAvailDays;

  const metaCategories = results?.historicalAnalytics?.datasetMeta?.categories || [];
  const metaStores = results?.historicalAnalytics?.datasetMeta?.stores || [];
  const metaRegions = results?.historicalAnalytics?.datasetMeta?.regions || [];

  // ==================== SECTION 2 — Decision Support ====================
  // Stock Coverage: uses forecast-window data, NO time filter
  const cCov = chartFilters.stockCoverage;
  const fDefCoverage = {
    metric: {
      key: 'view',
      options: [
        { label: 'Coverage Days', value: 'coverage_days' },
        { label: 'Stock Gap', value: 'stock_gap' },
        { label: 'Coverage Ratio', value: 'coverage_ratio' }
      ]
    }
  };

  const dCov = useMemo(() => {
    let baseData = [];
    const rawCovDetail = results?.coverageDetail || [];

    if (cCov.store === 'all' && cCov.region === 'all' && cCov.category === 'all') {
      baseData = charts.inventory_vs_demand || [];
    } else if (rawCovDetail.length > 0) {
      let filtered = rawCovDetail;
      if (cCov.category !== 'all') filtered = filtered.filter(r => String(r.category) === cCov.category);
      if (cCov.store !== 'all') filtered = filtered.filter(r => String(r.store) === cCov.store);
      if (cCov.region !== 'all') filtered = filtered.filter(r => String(r.region) === cCov.region);

      const grouped = {};
      filtered.forEach(r => {
        const cat = r.category || 'Unknown';
        if (!grouped[cat]) grouped[cat] = { name: cat, stock: 0, demand: 0 };
        grouped[cat].demand += Number(r.demand) || 0;
        grouped[cat].stock += Number(r.stock) || 0;
      });
      baseData = Object.values(grouped).sort((a,b) => b.demand - a.demand);
    } else {
      // fallback
      baseData = charts.inventory_vs_demand || [];
      if (cCov.category !== 'all') {
        baseData = baseData.filter(item => item.name === cCov.category);
      }
    }

    if (!baseData || !baseData.length) return [];

    return baseData.map(item => {
      const demand = Math.max(item.demand || 0, 0);
      const stock = Math.max(item.stock || 0, 0);
      const safeDailyDemand = Math.max(demand / forecastDays, 1);
      const safeDemand = Math.max(demand, 1);

      let val = 0, status = 'Moderate Coverage', fill = '#F59E0B';

      if (cCov.view === 'coverage_days') {
        val = stock / safeDailyDemand;
        if (val < forecastDays) { status = 'Low Coverage'; fill = '#EF4444'; }
        else if (val >= forecastDays * 1.5) { status = 'Healthy Coverage'; fill = '#10B981'; }
      } else if (cCov.view === 'stock_gap') {
        val = stock - demand;
        if (val < 0) { status = 'Shortage Risk'; fill = '#EF4444'; }
        else { status = 'Sufficient'; fill = '#10B981'; }
      } else if (cCov.view === 'coverage_ratio') {
        val = stock / safeDemand;
        if (val < 1) { status = 'Understocked'; fill = '#EF4444'; }
        else if (val > 1.5) { status = 'Overstocked'; fill = '#3B82F6'; }
        else { status = 'Balanced'; fill = '#10B981'; }
      }

      return { name: item.name, coverageDays: Number(val.toFixed(2)), status, fill };
    }).sort((a, b) => a.coverageDays - b.coverageDays);
  }, [charts.inventory_vs_demand, forecastDays, cCov, results?.coverageDetail]);

  let tCov = 'Stock Coverage by Category';
  let lCov = 'Coverage Days';
  let covMsg = 'Estimated stock coverage based on current inventory and forecast demand.';
  if (cCov.view === 'stock_gap') { tCov = 'Stock Gap by Category'; lCov = 'Stock Gap'; covMsg = 'Current stock minus forecast demand.'; }
  else if (cCov.view === 'coverage_ratio') { tCov = 'Coverage Ratio by Category'; lCov = 'Ratio'; covMsg = 'Stock divided by forecast demand.'; }

  // Critical Stock Risks: uses alerts, NO time filter
  const cRisk = chartFilters.criticalRisks;
  const filteredCriticalRiskData = useMemo(() => {
    if (!stockRiskAlerts || !stockRiskAlerts.length) return { data: [], groupType: cRisk.groupBy };

    let filtered = stockRiskAlerts.filter(a => STOCK_RISK_SEVERITIES.has(getAlertSeverity(a)));
    if (cRisk.riskLevel !== 'all') {
      filtered = filtered.filter(a => getAlertSeverity(a) === cRisk.riskLevel.toUpperCase());
    }

    if (cRisk.category !== 'all') {
      filtered = filtered.filter(a => getAlertDimensionLabel(a, 'Category') === cRisk.category);
    }
    if (cRisk.store !== 'all') {
      filtered = filtered.filter(a => getAlertDimensionLabel(a, 'Store') === cRisk.store);
    }
    if (cRisk.region !== 'all') {
      filtered = filtered.filter(a => getAlertDimensionLabel(a, 'Region') === cRisk.region);
    }

    let groupType = cRisk.groupBy;
    if (!['Product', 'Category', 'Store', 'Region'].includes(groupType)) return { data: [], groupType: null };
    if (filtered.length === 0) return { data: [], groupType };

    const grouped = {};
    filtered.forEach(c => {
      const label = getAlertDimensionLabel(c, groupType);
      grouped[label] = (grouped[label] || 0) + 1;
    });

    const data = Object.keys(grouped).map(k => ({ name: k, count: grouped[k] })).sort((a, b) => b.count - a.count);
    return { data, groupType };
  }, [stockRiskAlerts, cRisk.riskLevel, cRisk.groupBy, cRisk.category, cRisk.store, cRisk.region]);

  const criticalRiskEmptyMessage = useMemo(() => (
    cRisk.riskLevel === 'LOW'
      ? 'No low-risk stock items found for the selected filters.'
      : 'No stock risks found for the selected filters.'
  ), [cRisk.riskLevel]);

  // ==================== SECTION 3 — Historical Analytics ====================
  // All Section 3 charts use historicalAnalytics (full dataset)
  const dailyTrend = histAnalytics?.dailyTrend || [];
  const dailyByCat = histAnalytics?.dailyByCategory || [];
  const dailyByStore = histAnalytics?.dailyByStore || [];
  const dailyByRegion = histAnalytics?.dailyByRegion || [];
  const dailyBySeason = histAnalytics?.dailyBySeason || [];
  const dailyByWeather = histAnalytics?.dailyByWeather || [];
  const dailyByPriceGap = histAnalytics?.dailyByPriceGap || [];
  const dailyByPromo = histAnalytics?.dailyByPromo || [];

  // Chart 1 (Section 3): Units Sold Trend
  const fDefInvTrend = {
    period: true,
    metric: {
      key: 'metric',
      options: [
        { label: 'Units Sold', value: 'sold' },
        { label: 'Inventory Level', value: 'stock' },
        { label: 'Units Ordered', value: 'ordered' }
      ]
    }
  };
  const cInvTrend = chartFilters.inventoryTrend;
  const metricMapTrend = { sold: 'sold', stock: 'stock', ordered: 'ordered' };
  const trendFiltered = filterDailyTrend(dailyTrend, cInvTrend.period);
  const dInvTrend = trendFiltered.map(r => ({ date: r.date, inventory: Number((r[metricMapTrend[cInvTrend.metric]] || 0).toFixed(2)) }));
  let tInvTrend = cInvTrend.metric === 'stock' ? 'Inventory Level Trend' : (cInvTrend.metric === 'ordered' ? 'Units Ordered Trend' : 'Units Sold Trend');
  let lInvTrend = cInvTrend.metric === 'stock' ? 'Inventory Level' : (cInvTrend.metric === 'ordered' ? 'Units Ordered' : 'Units Sold');

  // Chart 2 (Section 3): Current Stock by Category
  const fDefCat = {
    period: true,
    metric: {
      key: 'metric',
      options: [
        { label: 'Current Stock', value: 'stock' },
        { label: 'Units Sold', value: 'sold' },
        { label: 'Units Ordered', value: 'ordered' },
        { label: 'Demand', value: 'demand' }
      ]
    }
  };
  const cCat = chartFilters.demandByCategory;
  let dCat, tCat, lCat;
  if (cCat.metric === 'stock') {
    dCat = getLatestStockByGroup(dailyByCat, 'category', cCat.period) || [];
    tCat = 'Current Stock by Category'; lCat = 'Current Stock';
  } else {
    const metricMapCat = { sold: 'sold', ordered: 'ordered', demand: 'demand' };
    dCat = aggregateHistorical(dailyByCat, 'category', metricMapCat[cCat.metric] || 'demand', cCat.period) || [];
    tCat = cCat.metric === 'sold' ? 'Units Sold by Category' : (cCat.metric === 'ordered' ? 'Units Ordered by Category' : 'Demand by Category');
    lCat = cCat.metric === 'sold' ? 'Units Sold' : (cCat.metric === 'ordered' ? 'Units Ordered' : 'Demand');
  }

  // Chart 3 (Section 3): Inventory vs Demand
  const fDefVs = {
    period: true,
    metric: {
      key: 'comparison',
      options: [
        { label: 'Stock vs Demand', value: 'stock_vs_demand' },
        { label: 'Stock vs Units Sold', value: 'stock_vs_sold' },
        { label: 'Stock vs Units Ordered', value: 'stock_vs_ordered' }
      ]
    }
  };
  const cVs = chartFilters.inventoryVsDemand;
  const vsMetricMap = { stock_vs_demand: 'demand', stock_vs_sold: 'sold', stock_vs_ordered: 'ordered' };
  const vsStock = getLatestStockByGroup(dailyByCat, 'category', cVs.period) || [];
  const vsDemand = aggregateHistorical(dailyByCat, 'category', vsMetricMap[cVs.comparison] || 'demand', cVs.period) || [];
  const dVs = useMemo(() => {
    const merged = {};
    vsStock.forEach(s => { merged[s.name] = { name: s.name, stock: s.value, demand: 0 }; });
    vsDemand.forEach(d => {
      if (!merged[d.name]) merged[d.name] = { name: d.name, stock: 0, demand: 0 };
      merged[d.name].demand = d.value;
    });
    return Object.values(merged).sort((a, b) => b.demand - a.demand);
  }, [vsStock, vsDemand]);
  let tVs = 'Inventory vs Demand';
  let lVsDemand = 'Demand';
  if (cVs.comparison === 'stock_vs_sold') { tVs = 'Inventory vs Units Sold'; lVsDemand = 'Units Sold'; }
  else if (cVs.comparison === 'stock_vs_ordered') { tVs = 'Inventory vs Units Ordered'; lVsDemand = 'Units Ordered'; }

  // Chart 4 (Section 3): Demand by Store
  const fDefStore = {
    period: true,
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' },
        { label: 'Units Ordered', value: 'ordered' }
      ]
    }
  };
  const cStore = chartFilters.demandByStore;
  const dStore = (aggregateHistorical(dailyByStore, 'store', cStore.metric, cStore.period) || []).slice(0, 10);
  let tStore = cStore.metric === 'sold' ? 'Units Sold by Store' : (cStore.metric === 'ordered' ? 'Units Ordered by Store' : 'Demand by Store');
  let lStore = cStore.metric === 'sold' ? 'Units Sold' : (cStore.metric === 'ordered' ? 'Units Ordered' : 'Demand');

  // Chart 5 (Section 3): Demand by Region
  const fDefRegion = {
    period: true,
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' },
        { label: 'Units Ordered', value: 'ordered' }
      ]
    }
  };
  const cRegion = chartFilters.demandByRegion;
  const dRegion = aggregateHistorical(dailyByRegion, 'region', cRegion.metric, cRegion.period) || [];
  let tRegion = cRegion.metric === 'sold' ? 'Units Sold by Region' : (cRegion.metric === 'ordered' ? 'Units Ordered by Region' : 'Demand by Region');
  let lRegion = cRegion.metric === 'sold' ? 'Units Sold' : (cRegion.metric === 'ordered' ? 'Units Ordered' : 'Demand');

  // Chart 6 (Section 3): Seasonality Demand Pattern — only 6m, 12m
  const fDefSeason = {
    period: { options: [180, 365] },
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' }
      ]
    }
  };
  const cSeason = chartFilters.seasonality;
  const dSeason = aggregateHistorical(dailyBySeason, 'season', cSeason.metric, cSeason.period) || [];
  let tSeason = cSeason.metric === 'sold' ? 'Seasonality Sales Pattern' : 'Seasonality Demand Pattern';
  let lSeason = cSeason.metric === 'sold' ? 'Units Sold' : 'Total Demand';

  // Chart 7 (Section 3): Weather Demand Impact — 30d, 90d, 3m, 6m, 12m
  const fDefWeather = {
    period: { options: [30, 90, 180, 365] },
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' }
      ]
    }
  };
  const cWeather = chartFilters.weatherImpact;
  const dWeather = aggregateHistorical(dailyByWeather, 'weather', cWeather.metric, cWeather.period) || [];
  let tWeather = cWeather.metric === 'sold' ? 'Weather Sales Impact' : 'Weather Demand Impact';
  let lWeather = cWeather.metric === 'sold' ? 'Units Sold' : 'Demand';

  // Chart 8 (Section 3): Price vs Competitor Gap — 30d, 90d, 3m, 6m, 12m
  const fDefPrice = {
    period: { options: [30, 90, 180, 365] },
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' },
        { label: 'Average Price Gap', value: 'avgGapPct' }
      ]
    }
  };
  const cPrice = chartFilters.priceGap;
  const priceOrder = ['Below Competitor', 'Near Competitor', 'Above Competitor'];
  let dPrice;
  if (cPrice.metric === 'avgGapPct') {
    // Custom aggregation for weighted average — uses getStartDate to avoid timezone bugs
    let rows = dailyByPriceGap;
    if (cPrice.period !== 'all') {
      const startDate = getStartDate(cPrice.period);
      if (startDate) {
        rows = rows.filter(r => parseUTCDate(r.date) >= startDate);
      }
    }
    const grouped = {};
    rows.forEach(r => {
      const key = r.bucket || 'Unknown';
      if (!grouped[key]) grouped[key] = { gapSum: 0, gapCount: 0 };
      grouped[key].gapSum += Number(r.gapSum || 0);
      grouped[key].gapCount += Number(r.gapCount || 0);
    });
    dPrice = Object.keys(grouped).filter(k => k !== 'Unknown').map(k => {
      const g = grouped[k];
      const avg = g.gapCount > 0 ? (g.gapSum / g.gapCount) : 0;
      return { name: k, value: Number((avg * 100).toFixed(2)) };
    });
  } else {
    dPrice = aggregateHistorical(dailyByPriceGap, 'bucket', cPrice.metric, cPrice.period) || [];
  }
  dPrice = dPrice.sort((a, b) => priceOrder.indexOf(a.name) - priceOrder.indexOf(b.name));
  
  let tPrice = 'Price vs Competitor Gap';
  let subPrice = 'Demand sensitivity across competitor pricing buckets.';
  let lPrice = cPrice.metric === 'sold' ? 'Units Sold' : 'Demand';
  
  if (cPrice.metric === 'avgGapPct') {
    tPrice = 'Average Price Gap vs Competitor';
    subPrice = 'Average price difference across competitor pricing buckets.';
    lPrice = 'Avg Price Gap %';
  } else if (cPrice.metric === 'sold') {
    subPrice = 'Units sold across competitor pricing buckets.';
  }

  // Chart 9 (Section 3): Promotion & Event Impact — 30d, 90d, 3m, 6m, 12m
  const fDefPromo = {
    period: { options: [30, 90, 180, 365] },
    metric: {
      key: 'metric',
      options: [
        { label: 'Demand', value: 'demand' },
        { label: 'Units Sold', value: 'sold' },
        { label: 'Units Ordered', value: 'ordered' }
      ]
    }
  };
  const cPromo = chartFilters.promotionImpact;
  const dPromo = aggregateHistorical(dailyByPromo, 'promo', cPromo.metric, cPromo.period) || [];
  let tPromo = 'Promotion & Event Impact';
  let lPromo = cPromo.metric === 'sold' ? 'Units Sold' : (cPromo.metric === 'ordered' ? 'Units Ordered' : 'Demand');
  return (
    <div className="dashboard-content-fade-in" style={{ padding: '1rem 2rem', maxWidth: '1600px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .inventoryChartGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          width: 100%;
          align-items: stretch;
          margin-bottom: 2rem;
        }
        .inventoryChartCard {
          width: 100%;
          height: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .futureForecastCard {
          grid-column: 1 / -1;
        }
        @media (max-width: 900px) {
          .inventoryChartGrid {
            grid-template-columns: 1fr;
          }
          .futureForecastCard {
            grid-column: auto;
          }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .premium-loader {
          width: 54px;
          height: 54px;
          border: 4px solid #E2E8F0;
          border-top-color: #3B82F6;
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .premium-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; }
        .premium-table th {
          padding: 1rem 1.75rem; font-size: 0.75rem; font-weight: 800; color: #64748B; 
          border-bottom: 1px solid #E2E8F0; text-transform: uppercase; letter-spacing: 0.5px;
          background: #F8FAFC; position: sticky; top: 0; z-index: 10;
        }
        .premium-table td {
          padding: 1.1rem 1.75rem; font-size: 0.9rem; border-bottom: 1px solid #F1F5F9; transition: background 0.2s;
        }
        .premium-table tbody tr { background: #ffffff; }
        .premium-table tbody tr:hover td { background: #F8FAFC; }
        .empty-row { padding: 3rem !important; text-align: center; color: #64748B; font-weight: 500; }
        
        .severity-badge {
          padding: 6px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px;
          border: 1px solid; display: inline-block;
        }
        
        .search-container { position: relative; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); }
        .premium-input {
          padding: 0.6rem 1rem 0.6rem 2.5rem; border-radius: 10px; border: 1px solid #CBD5E1;
          font-size: 0.9rem; outline: none; min-width: 280px; background: #F8FAFC; font-weight: 500; color: #0F172A;
          transition: all 0.2s ease;
        }
        .premium-input:focus { background: #ffffff; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        
        .pagination-btn {
          padding: 0.5rem 1.25rem; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 0.85rem; font-weight: 700;
          transition: all 0.2s ease;
        }
        .pagination-btn:not(:disabled) {
          background: #ffffff; color: #0F172A; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .pagination-btn:not(:disabled):hover { background: #F8FAFC; border-color: #CBD5E1; }
        .pagination-btn:disabled { background: #F8FAFC; color: #94A3B8; cursor: not-allowed; }
      `}</style>
      
      <Navbar 
        title="Inventory AI Intelligence" 
        subtitle="Monitor inventory health and optimize reorder decisions using live AI forecasting and optimization models." 
        actions={
          results && (
            <>
              <select style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #CBD5E1', background: 'white', color: '#0F172A', fontSize: '0.85rem', fontWeight: 500, outline: 'none', minWidth: '150px' }} value={selected} onChange={e => setSelected(e.target.value)}>
                {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.dataset_id}</option>)}
              </select>
              <select style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #CBD5E1', background: 'white', color: '#0F172A', fontSize: '0.85rem', fontWeight: 500, outline: 'none', width: '110px' }} value={forecastDays} onChange={(e) => setForecastDays(Number(e.target.value))}>
                {[7, 14, 30].map(d => <option key={d} value={d}>{d} Days</option>)}
              </select>
              <button onClick={handleForecast} disabled={loading} style={{ padding: '0.55rem 1.25rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)' }}>
                {loading ? '⏳...' : <><Play size={14} fill="currentColor" /> Run</>}
              </button>
              <button onClick={() => handleExport('csv')} disabled={exporting} style={{ padding: '0.55rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> CSV
              </button>
              <button onClick={() => handleExport('pdf')} disabled={exporting} style={{ padding: '0.55rem 1rem', background: 'white', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> PDF
              </button>
            </>
          )
        }
      />
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748B', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#3B82F6'} onMouseLeave={e => e.currentTarget.style.color = '#64748B'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {datasets.length === 0 && !isFetching && !loading && <EmptyState moduleName="Inventory AI" />}
      {!results && datasets.length > 0 && !isFetching && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="premium-card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <PackageSearch size={32} color="#3B82F6" />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', fontFamily: "'Manrope', sans-serif", marginBottom: '0.5rem' }}>Start AI Analysis</h3>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '2rem' }}>Identify inventory optimization opportunities through AI forecasting and reinforcement learning.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Select Dataset</label>
                <select
                  style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: '0.9rem', fontWeight: 500, width: '100%', outline: 'none', cursor: 'pointer' }}
                  value={selected}
                  onChange={e => setSelected(e.target.value)}
                >
                  <option value="">-- Select Dataset --</option>
                  {datasets.map(d => <option key={d.dataset_id} value={d.dataset_id}>{d.file_name || d.dataset_id}</option>)}
                </select>
              </div>
              <button onClick={handleForecast} disabled={!selected} style={{ padding: '0.85rem', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem', width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
                <Play size={16} fill="currentColor" /> Run Prediction
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem 1.5rem', background: '#FEF2F2', borderLeft: '4px solid #EF4444', color: '#991B1B', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, animation: 'fadeIn 0.3s ease-out', boxShadow: '0 4px 12px rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {loading && (
        <DashboardLoadingState
          title="Analyzing Inventory Risk"
          subtitle="Please wait while we process inventory data and generate AI reorder recommendations."
          statusText="CALCULATING INVENTORY SIGNALS..."
        />
      )}

      {results && !loading && (
        <div style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          
          <div style={{ padding: '1rem 1.5rem', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '2rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
              <Zap size={14} color="white" />
            </div>
            <div>
              <p style={{ fontSize: '0.95rem', color: '#1E3A8A', margin: '0 0 4px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                AI System Summary
                <span style={{ padding: '2px 8px', background: '#10B981', color: 'white', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>AI ENGINE ACTIVE</span>
              </p>
              <p style={{ fontSize: '0.85rem', color: '#3B82F6', margin: 0, lineHeight: 1.5 }}>
                Live AI forecasts future demand from historical sales, while the AI optimization engine recommends lean reorder quantities to reduce overstock risk and protect service levels. Urgent low-stock alerts remain separate from broader AI reorder recommendations.
              </p>
            </div>
          </div>

          {/* Row 1 — Executive Decision KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <MetricCard icon={PackageCheck} label="Current Stock" value={getCompactFormatter(kpis.current_stock || 0)} color="#64748B" microcopy="Latest inventory level" />
            <MetricCard icon={TrendingUp} label="AI Forecasted Demand" value={getCompactFormatter(aiForecastedDemand)} color="#8B5CF6" microcopy={`Next ${kpis.forecast_days || forecastDays} days`} />
            <MetricCard icon={Target} label="Recommended Order Qty" value={getCompactFormatter(recommendedOrderQty)} color="#8B5CF6" microcopy="Live reorder units" />
            <MetricCard icon={AlertTriangle} label="High-Priority Stock Risks" value={highPriorityStockRisks} color="#EF4444" microcopy="Critical + high items" />
          </div>

          {/* Row 2 — Business Context & Impact KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            <MetricCard icon={DollarSign} label="Estimated Cost Saving" value={formatPercent(costRedPct)} color="#10B981" microcopy="Projected reduction in inventory cost" />
            <MetricCard icon={ShoppingCart} label="Total Units Sold" value={totalUnitsSold != null ? getCompactFormatter(totalUnitsSold) : "—"} color="#0EA5E9" microcopy="Full dataset sales volume" />
            <MetricCard icon={Box} label="Total Units Ordered" value={totalUnitsOrdered != null ? getCompactFormatter(totalUnitsOrdered) : "—"} color="#0EA5E9" microcopy="Full dataset order volume" />
            <MetricCard icon={ShieldCheck} label="Net Sales Value" value={netSalesValue != null ? getCompactFormatter(netSalesValue) : "—"} color="#10B981" microcopy="Full dataset net revenue" />
          </div>

          {/* SECTION 1 - AI FORECAST */}
          <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>AI Forecast</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0 }}>Projected demand for upcoming inventory planning.</p>
          </div>
          <div className="inventoryChartGrid" style={{ marginBottom: '2rem' }}>
            
            {/* 1. FUTURE AI FORECAST - FULL WIDTH */}
            <div className="premium-card inventoryChartCard futureForecastCard capture-chart" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                {aggregatedFuture.length > 0 ? (
                  <FutureAIForecastChart data={aggregatedFuture} forecastDays={kpis.forecast_days || forecastDays} />
                ) : <EmptyChartState />}
              </div>
            </div>
          </div>

          {/* SECTION 2 - INVENTORY DECISION SUPPORT */}
          <div style={{ marginBottom: '1.5rem', marginTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>Inventory Decision Support</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', margin: '0 0 0.75rem 0' }}>Stock coverage and high-priority risk signals for action planning.</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#0369A1' }}>
                Planning Horizon: Next {kpis.forecast_days || forecastDays} Days
              </span>
              <span style={{ padding: '4px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#15803D' }}>
                Stock Snapshot: {results?.metadata?.latest_date ? new Date(results.metadata.latest_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
          <div className="inventoryChartGrid" style={{ marginBottom: '2rem' }}>

            {/* STOCK COVERAGE BY CATEGORY */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{tCov}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>{covMsg}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cCov.view}
                    onChange={(e) => handleFilterChange('stockCoverage', 'view', e.target.value)}
                  >
                    <option value="coverage_days">Coverage Days</option>
                    <option value="stock_gap">Stock Gap</option>
                    <option value="coverage_ratio">Coverage Ratio</option>
                  </select>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cCov.category}
                    onChange={(e) => handleFilterChange('stockCoverage', 'category', e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {metaCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cCov.store}
                    onChange={(e) => handleFilterChange('stockCoverage', 'store', e.target.value)}
                  >
                    <option value="all">All Stores</option>
                    {metaStores.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cCov.region}
                    onChange={(e) => handleFilterChange('stockCoverage', 'region', e.target.value)}
                  >
                    <option value="all">All Regions</option>
                    {metaRegions.map(rg => <option key={rg} value={rg}>{rg}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {dCov?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dCov} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }} width={80} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="coverageDays" name={lCov} radius={[0, 4, 4, 0]} barSize={20}>
                        {dCov.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState message="No stock coverage data found for the selected filters." />}
              </div>
              <ChartInsight>{getChartInsight('stock_coverage')}</ChartInsight>
            </div>

            {/* CRITICAL STOCK RISKS */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>
                    {filteredCriticalRiskData.groupType ? `Stock Risks by ${filteredCriticalRiskData.groupType}` : 'Critical Stock Risks'}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
                    {filteredCriticalRiskData.groupType ? `Stock risks grouped by ${filteredCriticalRiskData.groupType.toLowerCase()}.` : 'Stock risks requiring attention.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cRisk.riskLevel}
                    onChange={(e) => handleFilterChange('criticalRisks', 'riskLevel', e.target.value)}
                  >
                    <option value="all">All Risks</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <select
                    style={{ padding: '4px 24px 4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', outline: 'none' }}
                    value={cRisk.groupBy}
                    onChange={(e) => handleFilterChange('criticalRisks', 'groupBy', e.target.value)}
                  >
                    <option value="Product">Product</option>
                    <option value="Category">Category</option>
                    <option value="Store">Store</option>
                    <option value="Region">Region</option>
                  </select>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {filteredCriticalRiskData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredCriticalRiskData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Risk Items" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={criticalRiskEmptyMessage} />
                )}
              </div>
              <ChartInsight>{getChartInsight('critical_risks')}</ChartInsight>
            </div>
          </div>

          {/* SECTION 3 - INVENTORY & DEMAND ANALYTICS */}
          <div style={{ marginBottom: '1.5rem', marginTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Inventory & Demand Analytics</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0 }}>Historical inventory, demand, pricing, weather, and promotion insights.</p>
          </div>
          <div className="inventoryChartGrid" style={{ marginBottom: '2rem' }}>

            {/* 2. INVENTORY LEVEL TREND - FULL WIDTH AS REQUESTED */}
            <div className="premium-card inventoryChartCard futureForecastCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tInvTrend} subtitle="Historical trends over time." chartKey="inventoryTrend" filtersDef={fDefInvTrend} currentFilters={cInvTrend} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dInvTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dInvTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Line type="stepAfter" dataKey="inventory" name={lInvTrend} stroke="#3B82F6" strokeWidth={2} dot={false} fillOpacity={0.1} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>Historical tracking helps visualize broader fulfillment capability.</ChartInsight>
            </div>

            {/* 3. DEMAND BY CATEGORY */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tCat} subtitle="Distribution across product categories." chartKey="demandByCategory" filtersDef={fDefCat} currentFilters={cCat} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dCat?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dCat} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }} width={80} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lCat} fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('category')}</ChartInsight>
            </div>

            {/* 4. INVENTORY VS DEMAND */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tVs} subtitle="Comparison of current stock against demand." chartKey="inventoryVsDemand" filtersDef={fDefVs} currentFilters={cVs} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dVs?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dVs} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }} width={80} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} />
                      <Bar dataKey="stock" name="Current Stock" fill="#10B981" radius={[0, 4, 4, 0]} barSize={12} />
                      <Bar dataKey="demand" name={lVsDemand} fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('inv_vs_demand')}</ChartInsight>
            </div>

            {/* 5. DEMAND BY STORE */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tStore} subtitle="Top stores by demand volume." chartKey="demandByStore" filtersDef={fDefStore} currentFilters={cStore} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dStore?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dStore} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lStore} fill="#0EA5E9" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('store')}</ChartInsight>
            </div>

            {/* 6. DEMAND BY REGION */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tRegion} subtitle="Regional demand breakdown." chartKey="demandByRegion" filtersDef={fDefRegion} currentFilters={cRegion} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dRegion?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dRegion} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lRegion} fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('region')}</ChartInsight>
            </div>

            {/* 9. SEASONALITY DEMAND PATTERN */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tSeason} subtitle="Historical demand pattern by season." chartKey="seasonality" filtersDef={fDefSeason} currentFilters={cSeason} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dSeason?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dSeason} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey={cSeason.period !== 'all' ? "value" : "value"} name={lSeason} fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('seasonality')}</ChartInsight>
            </div>

            {/* 10. WEATHER DEMAND IMPACT */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tWeather} subtitle="Historical demand impact by weather condition." chartKey="weatherImpact" filtersDef={fDefWeather} currentFilters={cWeather} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dWeather?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dWeather} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lWeather} fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('weather')}</ChartInsight>
            </div>

            {/* 11. PRICE VS COMPETITOR GAP */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tPrice} subtitle={subPrice} chartKey="priceGap" filtersDef={fDefPrice} currentFilters={cPrice} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dPrice?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dPrice} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lPrice} fill="#14B8A6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('price')}</ChartInsight>
            </div>

            {/* 12. PROMOTION IMPACT */}
            <div className="premium-card inventoryChartCard" style={{ padding: '1.5rem', height: '440px', display: 'flex', flexDirection: 'column' }}>
              <ChartHeader title={tPromo} subtitle="Sales performance during promotions." chartKey="promotionImpact" filtersDef={fDefPromo} currentFilters={cPromo} availableDays={histAvail} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {dPromo?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dPromo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} tickMargin={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={getCompactFormatter} />
                      <RechartsTooltip cursor={{ fill: '#F8FAFC' }} content={<CustomTooltip />} />
                      <Bar dataKey="value" name={lPromo} fill="#F97316" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChartState />}
              </div>
              <ChartInsight>{getChartInsight('promo')}</ChartInsight>
            </div>
          </div>

          <div className="premium-card" style={{ marginBottom: '2rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #F1F5F9', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>AI Reorder Intelligence</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>Live reorder recommendations for inventory planning.</p>
              </div>
              <div style={{ padding: '0.5rem 1rem', background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#D97706" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#D97706' }}>{alerts.length} reorder recommendations</span>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Store</th>
                    <th>Current Stock</th>
                    <th>Forecast Demand</th>
                    <th>Recommended Order Qty</th>
                    <th>Severity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDecisionData.length > 0 ? (
                    currentDecisionData.map((alert, i) => {
                      const currentStock = alert.current_qty || 0;
                      const recommendedOrderQty = alert.q_reorder_suggestion || 0;
                      const predictedDemand = alert.demand_forecast !== undefined && alert.demand_forecast !== "N/A" ? alert.demand_forecast : (currentStock + recommendedOrderQty); 
                      
                      let severityStr = alert.severity || 'LOW';
                      let color = '#64748B'; let bg = '#F1F5F9'; let border = '#E2E8F0';
                      if (severityStr === 'CRITICAL' || severityStr === 'HIGH') {
                        color = '#DC2626'; bg = '#FEF2F2'; border = '#FEE2E2';
                      } else if (severityStr === 'MEDIUM') {
                        color = '#D97706'; bg = '#FFFBEB'; border = '#FEF3C7';
                      }

                      let actionText = getReorderAction(severityStr, currentStock, predictedDemand, recommendedOrderQty);

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>{alert.product || '-'}</td>
                          <td style={{ fontWeight: 500, color: '#475569' }}>{alert.store || '-'}</td>
                          <td style={{ fontWeight: 700, color: '#0F172A' }}>{formatTableWholeNumber(currentStock)}</td>
                          <td style={{ fontWeight: 700, color: '#0F172A' }}>{formatTableDemandNumber(predictedDemand)}</td>
                          <td style={{ color: '#10B981', fontWeight: 800 }}>{formatTableWholeNumber(recommendedOrderQty)}</td>
                          <td>
                            <span className="severity-badge" style={{ background: bg, color: color, borderColor: border }}>
                              {severityStr}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500, maxWidth: '240px', lineHeight: 1.4 }}>{actionText}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="7" className="empty-row">No low stock alerts detected.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {alerts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
                  Showing {(decisionPage - 1) * decisionPageSize + 1} to {Math.min(decisionPage * decisionPageSize, alerts.length)} of {alerts.length} recommendations
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setDecisionPage(p => Math.max(1, p - 1))} disabled={decisionPage === 1} className="pagination-btn">Previous</button>
                  <button onClick={() => setDecisionPage(p => Math.min(totalDecisionPages, p + 1))} disabled={decisionPage === totalDecisionPages || totalDecisionPages === 0} className="pagination-btn">Next</button>
                </div>
              </div>
            )}
          </div>

          <div className="premium-card" style={{ marginBottom: '2rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #F1F5F9', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Operational Inventory Detail</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>{formatChartNumber(inventoryDetail.length)} records in the selected planning window.</p>
              </div>
              <div className="search-container">
                <Search size={16} color="#64748B" className="search-icon" />
                <input type="text" placeholder="Search product, store, category, region..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} className="premium-input" />
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    {OPERATIONAL_INVENTORY_COLUMNS.map((column) => (
                      <th key={column.label} style={column.nowrap ? { whiteSpace: 'nowrap' } : undefined}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentTableData.map((row, i) => (
                    <tr key={i}>
                      {OPERATIONAL_INVENTORY_COLUMNS.map((column) => {
                        const value = row[column.field];
                        const displayValue = column.format ? column.format(value) : (value || '—');

                        return (
                        <td key={column.label} style={{ color: '#334155', fontWeight: 500, whiteSpace: column.nowrap ? 'nowrap' : undefined }}>
                          {displayValue}
                        </td>
                        );
                      })}
                    </tr>
                  ))}
                  {currentTableData.length === 0 && (
                    <tr><td colSpan={OPERATIONAL_INVENTORY_COLUMNS.length} className="empty-row">No records match search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
                Showing {filteredDetail.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredDetail.length)} of {filteredDetail.length} records
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="pagination-btn">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="pagination-btn">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryForecast;

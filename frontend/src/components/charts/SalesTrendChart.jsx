import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
      }}>
        <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginBottom: '6px', fontWeight: 600 }}>{label}</p>
        <p style={{ color: '#2563EB', fontSize: '1rem', fontWeight: 800 }}>
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const SalesTrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)' }}>
        No trend data available.
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map(item => ({
    date: item.date || item.ds,
    revenue: item.revenue || item.yhat || 0
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis 
          dataKey="date" 
          stroke="var(--text-muted)" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(val) => {
            if (!val) return '';
            // If it's a full date string, maybe just show month/day
            if (typeof val === 'string' && val.includes('-')) {
              const parts = val.split('-');
              if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
            }
            return val;
          }}
        />
        <YAxis 
          stroke="var(--text-muted)" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false}
          tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke="#2563EB" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorRevenue)" 
          activeDot={{ r: 6, fill: '#2563EB', stroke: 'white', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default SalesTrendChart;

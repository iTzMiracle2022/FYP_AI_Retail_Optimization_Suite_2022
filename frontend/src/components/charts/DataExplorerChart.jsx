import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import ReactECharts from 'echarts-for-react';

// Helper to format numbers cleanly: integers stay integers, floats max 2 decimals
const formatNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : parseFloat(value.toFixed(2));
  }
  return value;
};

const isNumericSeries = (data, key) => (
  Boolean(key) && data?.some(item => item[key] !== null && item[key] !== undefined && item[key] !== '') &&
  data.every(item => {
    const value = item[key];
    if (value === null || value === undefined || value === '') return true;
    return Number.isFinite(Number(value));
  })
);

const DataExplorerChart = React.memo(({ data, xAxis, yAxis, chartType }) => {
  const validationMessage = useMemo(() => {
    if (!xAxis || !yAxis) return null;
    if (!data || !data.length) return null;

    const yIsNumeric = isNumericSeries(data, yAxis);
    if (!yIsNumeric) return 'Please select a numeric Y-axis value for this chart type.';

    if (chartType === 'scatter' && !isNumericSeries(data, xAxis)) {
      return 'Please select numeric X-axis and Y-axis values for a scatter plot.';
    }

    return null;
  }, [data, xAxis, yAxis, chartType]);

  const chartData = useMemo(() => {
    if (!data || !xAxis || !yAxis || validationMessage) return [];
    
    if (chartType === 'scatter') {
      // Return mapped data where values are properly formatted
      return data.map(item => ({
        ...item,
        [xAxis]: formatNumber(Number(item[xAxis])),
        [yAxis]: formatNumber(Number(item[yAxis]))
      }));
    }

    const grouped = {};
    data.forEach(item => {
      let xVal = item[xAxis];
      if (xVal === undefined || xVal === null) xVal = 'Unknown';
      if (typeof xVal === 'number') {
        xVal = Number.isInteger(xVal) ? xVal : parseFloat(xVal.toFixed(2));
      }
      
      const yVal = Number(item[yAxis]);
      if (!Number.isFinite(yVal)) return;
      
      if (!grouped[xVal]) {
        grouped[xVal] = { sum: 0, count: 0 };
      }
      grouped[xVal].sum += yVal;
      grouped[xVal].count += 1;
    });

    return Object.keys(grouped).map(key => ({
      [xAxis]: key,
      [yAxis]: formatNumber(grouped[key].sum / grouped[key].count)
    }));
  }, [data, xAxis, yAxis, chartType, validationMessage]);

  const scatterSeries = useMemo(() => {
    if (chartType !== 'scatter' || !chartData.length) return [];
    return [{
      name: yAxis,
      data: chartData.map(item => [item[xAxis], item[yAxis]])
    }];
  }, [chartData, chartType, xAxis, yAxis]);

  const echartsOption = useMemo(() => {
    if (chartType !== 'scatter' || !chartData.length) return {};
    
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: function (params) {
          const point = params.data;
          return `
            <div style="font-weight:800;margin-bottom:6px;">Custom Explorer</div>
            <div>${xAxis}: ${formatNumber(point.value[0])}</div>
            <div>${yAxis}: ${formatNumber(point.value[1])}</div>
          `;
        }
      },
      grid: {
        top: 20,
        right: 40,
        bottom: 50,
        left: 55,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: xAxis,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#f59e0b', fontWeight: 700 },
        axisLabel: {
          color: '#94a3b8',
          fontWeight: 600,
          formatter: (val) => formatNumber(val)
        },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.05)' } }
      },
      yAxis: {
        type: 'value',
        name: yAxis,
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#f59e0b', fontWeight: 700 },
        axisLabel: {
          color: '#94a3b8',
          fontWeight: 600,
          formatter: (val) => formatNumber(val)
        },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(255,255,255,0.05)' } }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: [0], filterMode: 'filter' },
        { type: 'inside', yAxisIndex: [0], filterMode: 'filter' }
      ],
      series: [{
        name: yAxis,
        type: 'scatter',
        data: chartData.map(item => ({
          value: [item[xAxis], item[yAxis]]
        })),
        symbolSize: 6,
        itemStyle: {
          color: '#f59e0b',
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
      }]
    };
  }, [chartData, chartType, xAxis, yAxis]);

  if (!xAxis || !yAxis) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Please select both X and Y axes to render the chart.
      </div>
    );
  }

  if (validationMessage) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
        {validationMessage}
      </div>
    );
  }

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxis} stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} tickFormatter={formatNumber} label={{ value: xAxis, position: 'insideBottom', offset: -20, fill: '#8b5cf6', fontSize: 13, fontWeight: 600 }} />
            <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} tickFormatter={formatNumber} label={{ value: yAxis, angle: -90, position: 'insideLeft', offset: -15, fill: '#8b5cf6', fontSize: 13, fontWeight: 600, style: { textAnchor: 'middle' } }} />
            <Tooltip 
              formatter={(value) => [formatNumber(value), yAxis]}
              labelFormatter={(label) => `${xAxis}: ${formatNumber(label)}`}
              contentStyle={{ backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
              itemStyle={{ color: 'var(--primary)' }}
            />
            <Bar name={yAxis} dataKey={yAxis} fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxis} stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} tickFormatter={formatNumber} label={{ value: xAxis, position: 'insideBottom', offset: -20, fill: '#10b981', fontSize: 13, fontWeight: 600 }} />
            <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} tickFormatter={formatNumber} label={{ value: yAxis, angle: -90, position: 'insideLeft', offset: -15, fill: '#10b981', fontSize: 13, fontWeight: 600, style: { textAnchor: 'middle' } }} />
            <Tooltip 
              formatter={(value) => [formatNumber(value), yAxis]}
              labelFormatter={(label) => `${xAxis}: ${formatNumber(label)}`}
              contentStyle={{ backgroundColor: 'var(--bg-card-solid)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
              itemStyle={{ color: 'var(--primary)' }}
            />
            <Line name={yAxis} type="monotone" dataKey={yAxis} stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={700} animationEasing="ease-out" />
          </LineChart>
        );
      case 'scatter': {
        return (
          <div style={{ height: 350, width: '100%' }}>
            <ReactECharts 
              option={echartsOption} 
              style={{ height: '100%', width: '100%' }} 
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      {renderChart()}
    </ResponsiveContainer>
  );
});

export default DataExplorerChart;

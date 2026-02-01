import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

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

const formatNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number.isInteger(number) ? number : parseFloat(number.toFixed(2));
};

const MarketingChart = ({ data = [] }) => {
  const safeData = Array.isArray(data) ? data : [];

  const series = useMemo(() => {
    if (!safeData.length) return [];
    const groups = {};
    safeData.forEach(item => {
      const segmentName = item.segment_display_name || item.segment_name || item.segment_family || 'Unknown Segment';
      const recency = formatNumber(item.recency);
      const spend = formatNumber(item.total_spend);
      if (recency === null || spend === null) return;
      if (!groups[segmentName]) {
        groups[segmentName] = {
          name: segmentName,
          data: []
        };
      }
      groups[segmentName].data.push({
        value: [recency, spend],
        customer_id: item.customer_id,
        segment: segmentName,
        total_purchases: formatNumber(item.total_purchases),
        sentiment_score: Number.isFinite(Number(item.sentiment)) ? (((Number(item.sentiment) + 1) / 2) * 100).toFixed(0) + '%' : 'N/A'
      });
    });

    return Object.values(groups).map(g => ({
      name: g.name,
      type: 'scatter',
      data: g.data,
      symbolSize: 6,
      itemStyle: {
        color: getSegmentColor(g.name),
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
  }, [safeData]);

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12
        },
        formatter: function (params) {
          const point = params.data;
          return `
            <div style="font-weight:800;margin-bottom:6px;">Customer ${point.customer_id ?? 'N/A'}</div>
            <div>Segment: ${point.segment ?? 'N/A'}</div>
            <div>Total Spend: $${point.value[1] ?? 'N/A'}</div>
            <div>Recency: ${point.value[0] ?? 'N/A'} days</div>
            <div>Total Purchases: ${point.total_purchases ?? 'N/A'}</div>
            <div>Sentiment Score: ${point.sentiment_score ?? 'N/A'}</div>
          `;
        }
      },
      grid: {
        top: 20,
        right: 40,
        bottom: 50,
        left: 45,
        containLabel: true
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          fontWeight: 600,
          color: '#475569',
          fontSize: 12
        }
      },
      xAxis: {
        type: 'value',
        name: 'Recency (days)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: {
          color: '#334155',
          fontWeight: 700
        },
        axisLabel: {
          color: '#475569',
          fontWeight: 600
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#E2E8F0'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Total Spend ($)',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: '#334155',
          fontWeight: 700
        },
        axisLabel: {
          color: '#475569',
          fontWeight: 600
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#E2E8F0'
          }
        }
      },
      dataZoom: [
        {
          type: 'inside', // enables mouse scroll zoom
          xAxisIndex: [0],
          filterMode: 'filter'
        },
        {
          type: 'inside',
          yAxisIndex: [0],
          filterMode: 'filter'
        }
      ],
      series: series
    };
  }, [series]);

  if (!safeData.length) return null;

  return (
    <div style={{ height: 480, width: '100%' }}>
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }} 
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export default React.memo(MarketingChart);

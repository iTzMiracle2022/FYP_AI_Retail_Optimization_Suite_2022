import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { DownloadCloud, FileText, Filter, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { exportReport } from '../api/reportAPI';
import ErrorMessage from '../components/common/ErrorMessage';

const AnalyticsPage = () => {
  const { salesState, inventoryState, marketingState, churnState } = useApp();
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const triggerExport = async (analysisType, format, payload, id) => {
    try {
      setDownloading(id);
      setError(null);
      await exportReport(analysisType, format, payload.data, payload.dataset_id, payload.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(null);
    }
  };

  const availableReports = [
    {
      id: 'sales-pdf',
      title: 'Sales Performance Report',
      desc: 'Comprehensive PDF detailing revenue trends and top products.',
      lockedMsg: 'Run the Sales Analysis module to generate this report.',
      route: '/sales',
      type: 'PDF',
      isReady: !!salesState.results,
      onDownload: () => triggerExport('sales', 'pdf', {
        dataset_id: salesState.selectedDs,
        data: salesState.results.charts?.revenue_trend || [],
        summary: {
          total_revenue: `$${salesState.results.kpis?.total_revenue?.toLocaleString()}`,
          total_transactions: salesState.results.kpis?.total_transactions,
          top_category: salesState.results.kpis?.top_category || 'N/A'
        }
      }, 'sales-pdf')
    },
    {
      id: 'churn-csv',
      title: 'High-Risk Customers Export',
      desc: 'Raw CSV file containing detailed customer churn probabilities.',
      lockedMsg: 'Run the Churn Prediction module to generate this export.',
      route: '/churn',
      type: 'CSV',
      isReady: !!churnState.results,
      onDownload: () => triggerExport('churn', 'csv', {
        dataset_id: churnState.selectedDataset,
        data: churnState.results.predictions,
        summary: {
          total_customers: churnState.results.total_customers,
          at_risk_customers: churnState.results.at_risk_customers,
          accuracy: `${(churnState.results.model_accuracy * 100).toFixed(1)}%`
        }
      }, 'churn-csv')
    },
    {
      id: 'churn-pdf',
      title: 'Customer Churn Executive Summary',
      desc: 'Professional PDF report identifying at-risk customers and ML metrics.',
      lockedMsg: 'Run the Churn Prediction module to generate this report.',
      route: '/churn',
      type: 'PDF',
      isReady: !!churnState.results,
      onDownload: () => triggerExport('churn', 'pdf', {
        dataset_id: churnState.selectedDataset,
        data: churnState.results.predictions,
        summary: {
          total_customers: churnState.results.total_customers,
          at_risk_customers: churnState.results.at_risk_customers,
          accuracy: `${(churnState.results.model_accuracy * 100).toFixed(1)}%`
        }
      }, 'churn-pdf')
    },
    {
      id: 'inventory-pdf',
      title: 'Inventory Replenishment Alert',
      desc: 'Actionable PDF listing items requiring immediate restock.',
      lockedMsg: 'Run the Inventory Forecast module to generate this report.',
      route: '/inventory',
      type: 'PDF',
      isReady: !!inventoryState.results,
      onDownload: () => triggerExport('inventory', 'pdf', {
        dataset_id: inventoryState.selected,
        data: inventoryState.results.low_stock_alerts,
        summary: {
          total_products_analyzed: inventoryState.results.total_products,
          forecast_horizon_days: inventoryState.days,
          items_need_restock: inventoryState.results.low_stock_alerts?.length || 0
        }
      }, 'inventory-pdf')
    },
    {
      id: 'marketing-pdf',
      title: 'Audience Segmentation Report',
      desc: 'PDF containing NLP-enhanced customer cohorts and spending traits.',
      lockedMsg: 'Run the Marketing Analysis module to generate this report.',
      route: '/marketing',
      type: 'PDF',
      isReady: !!marketingState.results,
      onDownload: () => triggerExport('marketing', 'pdf', {
        dataset_id: marketingState.selected,
        data: marketingState.results.clusters,
        summary: {
          total_customers: marketingState.results.total_customers,
          segments_created: marketingState.results.n_clusters
        }
      }, 'marketing-pdf')
    }
  ];

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Reports & Export" subtitle="Download comprehensive AI analysis reports." />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      <ErrorMessage message={error} />

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '60vh', marginTop: '1rem' }}>
        <div className="premium-card" style={{ maxWidth: '850px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif" }}>Available Reports</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary-button" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} /> Filter
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availableReports.map((report) => (
              <div key={report.id} style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                padding: '1.5rem', border: '1px solid',
                borderColor: report.isReady ? 'var(--border)' : '#E2E8F0',
                borderRadius: '16px',
                background: report.isReady ? 'var(--bg-main)' : 'var(--bg-secondary)', 
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                if (report.isReady) {
                  e.currentTarget.style.borderColor = '#2563EB';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.08)';
                }
              }}
              onMouseLeave={e => {
                if (report.isReady) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '12px', background: report.isReady ? '#F0F4FF' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={24} color={report.isReady ? "#2563EB" : "#94A3B8"} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: report.isReady ? 'var(--text-main)' : '#475569', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {report.title} {!report.isReady && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '12px' }}><Lock size={10} /> LOCKED</span>}
                    </h4>
                    <p style={{ color: report.isReady ? 'var(--text-light)' : '#64748B', fontSize: '0.85rem', fontWeight: report.isReady ? 500 : 600 }}>
                      {report.isReady ? report.desc : report.lockedMsg}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '6px' }}>
                    {report.type}
                  </span>
                  
                  {report.isReady ? (
                    <button 
                      onClick={report.onDownload}
                      disabled={downloading === report.id}
                      style={{ 
                        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#2563EB', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      {downloading === report.id ? <span style={{ fontSize: '12px' }}>⏳</span> : <DownloadCloud size={18} />}
                    </button>
                  ) : (
                    <button 
                      onClick={() => navigate(report.route)}
                      style={{ 
                        background: 'transparent', border: '1px solid #CBD5E1', borderRadius: '8px',
                        padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '6px',
                        color: '#475569', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}
                    >
                      Go to Module <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;

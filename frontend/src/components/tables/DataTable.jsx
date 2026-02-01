import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';

/**
 * Highly reusable, glass-morphic Data Table.
 * Supports: Dynamic Headers, Pagination, Search, and Themed Styling.
 */
const DataTable = ({ data, title, onExport, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No data records available for this analysis.
      </div>
    );
  }

  // 1. Filtering
  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // 2. Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // 3. Dynamic Headers
  const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') && k !== 'dataset_id');

  const formatHeader = (h) => h.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Table Header / Toolbar */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{title || 'Analysis Results'}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} records</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search records..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.4rem 0.75rem 0.4rem 2.25rem', fontSize: '0.85rem', width: '200px' }}
            />
          </div>
          {onExport && (
            <button className="btn-secondary" onClick={onExport} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={14} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
              {headers.map((h) => (
                <th key={h} style={thStyle}>{formatHeader(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentItems.map((row, i) => (
              <tr key={i} style={trStyle}>
                {headers.map((h) => (
                  <td key={h} style={tdStyle}>
                    {renderCell(h, row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <button 
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
          style={pageBtnStyle}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Page {currentPage} of {totalPages || 1}
        </span>
        <button 
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage(prev => prev + 1)}
          style={pageBtnStyle}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Helper to style specific cell types
const renderCell = (key, value) => {
  if (value === null || value === undefined) return '—';
  
  if (key.includes('prediction') || key.includes('risk')) {
    const isRisk = value === 1 || String(value).toUpperCase() === 'HIGH';
    return (
      <span style={{ 
        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
        backgroundColor: isRisk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        color: isRisk ? '#f87171' : '#34d399',
        border: `1px solid ${isRisk ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
      }}>
        {isRisk ? 'ALERT/RISK' : 'OPTIMAL'}
      </span>
    );
  }

  if (typeof value === 'number') {
    if (key.includes('probability') || key.includes('score')) return (value * 100).toFixed(1) + '%';
    if (key.includes('revenue') || key.includes('spend')) return '$' + value.toLocaleString();
    return value.toLocaleString();
  }

  return String(value);
};

const thStyle = { padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' };
const tdStyle = { padding: '1rem 1.5rem', color: '#e2e8f0', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.03)' };
const trStyle = { transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } };
const pageBtnStyle = { padding: '0.4rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: '#fff', cursor: 'pointer' };

export default DataTable;

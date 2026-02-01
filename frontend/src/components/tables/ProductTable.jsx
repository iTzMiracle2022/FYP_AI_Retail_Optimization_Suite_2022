import React from 'react';
import DataTable from './DataTable';
import { Package, TrendingDown, Check } from 'lucide-react';

/**
 * Specialized table for Inventory and Product-based results.
 */
const ProductTable = ({ products, type = 'inventory' }) => {
  if (!products || products.length === 0) return null;

  const title = type === 'inventory' ? 'Inventory Demand Forecast' : 'Top Selling Products';

  return (
    <div style={{ marginTop: '2rem' }}>
      <DataTable 
        data={products} 
        title={title}
        itemsPerPage={8}
      />
      
      {/* Legend / Key for Inventory specific logic */}
      {type === 'inventory' && (
        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Package size={14} color="#3b82f6" />
            <span>Demand Prediction: Ridge Regression (GPU Accelerated)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <TrendingDown size={14} color="#f87171" />
            <span>Risk: Low stock predicted within 7 days</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductTable;

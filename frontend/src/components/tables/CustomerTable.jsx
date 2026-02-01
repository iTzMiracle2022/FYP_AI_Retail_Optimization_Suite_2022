import React from 'react';
import DataTable from './DataTable';

/**
 * Professional wrapper for Customer-specific data (Churn/Marketing).
 * Leverages the unified DataTable for consistent UI/UX.
 */
const CustomerTable = ({ customers, title = "Customer Analysis Results" }) => {
  return (
    <DataTable 
      data={customers} 
      title={title}
      itemsPerPage={10}
    />
  );
};

export default CustomerTable;

import API from './index';

/**
 * Export analysis results as CSV or PDF
 * Implements UML Sequence Diagram 4.3.1.5 — Export Reports flow
 *
 * @param {string} analysisType - 'churn' | 'inventory' | 'marketing' | 'sales'
 * @param {string} format       - 'csv' | 'pdf'
 * @param {Array}  data         - Array of result objects to export
 * @param {string} datasetId    - Dataset ID for metadata
 * @param {Object} summary      - Key-value summary shown in PDF header
 */
export const exportReport = async (analysisType, format, data, datasetId, summary = {}, charts = []) => {
  const response = await fetch(`/api/reports/export/${analysisType}/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, dataset_id: datasetId, summary, charts })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }));
    throw err.error || 'Export failed';
  }

  // Backend returns JSON with the filename, then trigger native download via hidden iframe
  const result = await response.json();
  if (result.download_file) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `/api/reports/download/${result.download_file}`;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 30000);
  }
};

export const listReports = (datasetId) => {
  const params = datasetId ? `?dataset_id=${datasetId}` : '';
  return API.get(`/reports/list${params}`);
};

export const getMlHistory = (datasetId) => {
  const params = datasetId ? `?dataset_id=${datasetId}` : '';
  return API.get(`/reports/ml-history${params}`);
};

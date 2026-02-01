import API from './index';

export const forecastInventory = (datasetId, days = 30, email) => 
  API.post('/inventory/forecast', { dataset_id: datasetId, forecast_days: days, email });

export const getInventoryHistory = (datasetId, email) => 
  API.get(`/inventory/history/${datasetId}${email ? `?email=${email}` : ''}`);

export const getInventoryAlerts = () => API.get('/inventory/alerts');

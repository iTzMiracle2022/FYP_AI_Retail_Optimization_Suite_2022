import API from './index';

export const predictChurn = (datasetId, email) => 
  API.post('/churn/predict', { dataset_id: datasetId, email });

export const getChurnHistory = (datasetId, email) => 
  API.get(`/churn/history/${datasetId}${email ? `?email=${email}` : ''}`);

export const getChurnStats = () => API.get('/churn/stats');

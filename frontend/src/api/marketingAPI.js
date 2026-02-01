import API from './index';

export const analyzeMarketing = (datasetId, clusters = 4, email) =>
  API.post('/marketing/analyze', { dataset_id: datasetId, n_clusters: clusters, email });

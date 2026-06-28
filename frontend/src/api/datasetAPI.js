import API from './index';

// ── Logical Multi-Tenancy: Extract & provide user_email ──
export const uploadDataset = (file, email) => {
  const formData = new FormData();
  formData.append('file', file);
  if (email) formData.append('email', email);

  // Override Content-Type so Axios sets multipart boundary correctly
  return API.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const listDatasets = (email) => 
  API.get(`/datasets${email ? `?email=${email}` : ''}`);

export const deleteDataset = (datasetId, email) => 
  API.delete(`/datasets/${datasetId}${email ? `?email=${email}` : ''}`);

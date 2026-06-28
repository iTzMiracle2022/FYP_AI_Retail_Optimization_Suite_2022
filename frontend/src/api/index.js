import axios from 'axios';

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (envUrl && envUrl !== "auto") {
    return envUrl.replace(/\/$/, "");
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5000/api`;
};

export const API_URL = getApiBaseUrl();

// Base Axios instance matching the backend Flask port (5000)
const API = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach user context headers
API.interceptors.request.use((config) => {
  const savedUser = sessionStorage.getItem('retail_ai_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user.email) config.headers['X-User-Email'] = user.email;
      if (user.role) config.headers['X-User-Role'] = user.role;
    } catch (e) {}
  }
  return config;
});

// Generic error interceptor
API.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Session expired or unauthorized on backend -> redirect to login
    if (error.response?.status === 401) {
      sessionStorage.removeItem('retail_ai_user');
      window.location.href = '/login';
      return Promise.reject('Session expired');
    }

    // Better fallback for network/CORS errors
    const message = error.response?.data?.message || 
                    error.response?.data?.error || 
                    (error.message === "Network Error" ? "Backend Server is Offline or Network Error" : error.message) || 
                    'An unexpected error occurred';
    console.error('API Error:', message);
    return Promise.reject(message);
  }
);

// Health Check API
export const checkHealth = () => API.get('/health');

// Dataset APIs (Isolated by user email)
export const fetchDatasets = (email) => 
  API.get(`/datasets${email ? `?email=${email}` : ''}`);

export const getDatasetInfo = (datasetId, email) => 
  API.get(`/datasets/${datasetId}${email ? `?email=${email}` : ''}`);

export const registerDatasetLocal = (data) => 
  API.post('/datasets/upload', data); // 'email' should be inside 'data' FormData

export default API;

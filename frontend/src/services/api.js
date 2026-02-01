import axios from 'axios';
import { API_URL } from '../api/index';

// Base URL - backend ka address
const API_BASE_URL = API_URL;

// Axios instance with default config
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
});

// Error handling interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// ===== CHURN PREDICTION APIs =====
export const churnAPI = {
    predict: async (datasetId, customerIds = null) => {
        try {
            const response = await apiClient.post('/churn/predict', {
                dataset_id: datasetId,
                customer_ids: customerIds,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    getStats: async () => {
        try {
            const response = await apiClient.get('/churn/stats');
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },
};

// ===== INVENTORY FORECASTING APIs =====
export const inventoryAPI = {
    forecast: async (datasetId, forecastDays = 30, productIds = null) => {
        try {
            const response = await apiClient.post('/inventory/forecast', {
                dataset_id: datasetId,
                forecast_days: forecastDays,
                product_ids: productIds,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    getAlerts: async () => {
        try {
            const response = await apiClient.get('/inventory/alerts');
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },
};

// ===== MARKETING ANALYSIS APIs =====
export const marketingAPI = {
    analyze: async (datasetId, numClusters = 4) => {
        try {
            const response = await apiClient.post('/marketing/analyze', {
                dataset_id: datasetId,
                n_clusters: numClusters,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },
};

// ===== HEALTH CHECK =====
export const healthCheck = async () => {
    try {
        const response = await apiClient.get('/health');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export default apiClient;
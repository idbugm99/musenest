const axios = require('axios');
const https = require('https');

// Create default axios instance with SSL verification disabled for internal calls
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 10000 // 10 second timeout
});

// Add request interceptor for debugging
axiosInstance.interceptors.request.use(
    (config) => {
        // Only disable SSL for localhost calls
        if (config.url && (config.url.includes('localhost') || config.url.includes('127.0.0.1'))) {
            if (!config.httpsAgent) {
                config.httpsAgent = new https.Agent({
                    rejectUnauthorized: false
                });
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
            error.code === 'CERT_HAS_EXPIRED' || 
            error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
            console.warn(`SSL Warning for ${error.config?.url}: ${error.message}`);
        }
        return Promise.reject(error);
    }
);

module.exports = axiosInstance;
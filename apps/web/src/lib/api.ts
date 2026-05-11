import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    // Only inject stored token if no Authorization header is already set
    if (!config.headers.Authorization) {
        const token = localStorage.getItem('agro_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

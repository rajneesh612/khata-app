import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
});

// Request interceptor: Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401 errors (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and reload or let app handle it
      localStorage.removeItem('token');
      localStorage.removeItem('shop');
      // No redirect, App.tsx will see shop is null and show Auth
      window.location.reload(); 
    }
    return Promise.reject(error);
  }
);

export default api;

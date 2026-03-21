// src/utils/api.ts — axios (used by src/pages/*). App routes use utils/apiFetch.ts.
import axios from 'axios';
import { API_BASE_URL } from '@/config/apiBase';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente a todas las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export { api };
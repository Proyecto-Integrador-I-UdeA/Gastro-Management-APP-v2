// src/utils/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001', // URL de tu backend (cambia a producción cuando subas)
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
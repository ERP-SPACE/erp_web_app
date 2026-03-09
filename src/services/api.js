// src/services/api.js
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://stage.backend.livesocial.in/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("erp_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Pass-through; downstream services can shape the data as needed
    return response.data;
  },
  (error) => {
    const message =
      error.response?.data?.error?.message || "Something went wrong";
    const code = error.response?.data?.error?.code || "ERROR";

    return Promise.reject({
      message,
      code,
      status: error.response?.status,
    });
  }
);

export default api;

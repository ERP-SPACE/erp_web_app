// src/services/api.js
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL;
const ACCESS_TOKEN_KEY = "erp_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";

if (!API_BASE_URL) {
  console.error(
    "[api.js] REACT_APP_API_URL is not set. " +
    "Create a .env.development (for npm start) or .env.production (for npm run build) file."
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

const refreshAccessToken = async () => {
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!storedRefreshToken) {
    throw new Error("No refresh token available");
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken: storedRefreshToken },
        {
          headers: { "Content-Type": "application/json" },
        }
      )
      .then((response) => {
        const payload = response.data;
        if (payload?.accessToken) {
          localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
        }
        if (payload?.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
        }
        if (payload?.user) {
          localStorage.setItem("erp_user", JSON.stringify(payload.user));
        }
        return payload?.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
  async (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error?.message || "Something went wrong";
    const code = error.response?.data?.error?.code || "ERROR";

    const isAuthEndpoint = error.config?.url?.startsWith("/auth/");
    const originalRequest = error.config;

    if (
      status === 401 &&
      !isAuthEndpoint &&
      !originalRequest?._retry &&
      localStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      try {
        originalRequest._retry = true;
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          const retryResponse = await api(originalRequest);
          return retryResponse;
        }
      } catch (refreshError) {
        // fall through to auth-expired signal
      }
    }

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent("erp:auth:expired"));
    }

    return Promise.reject({
      message,
      code,
      status,
    });
  }
);

export default api;

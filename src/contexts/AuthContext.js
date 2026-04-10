import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import authService from "../services/authService";
import { useApp } from "./AppContext";

const AuthContext = createContext();
const ACCESS_TOKEN_KEY = "erp_token";
const REFRESH_TOKEN_KEY = "erp_refresh_token";
const USER_KEY = "erp_user";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState(() =>
    localStorage.getItem(REFRESH_TOKEN_KEY)
  );
  const { showNotification } = useApp();

  useEffect(() => {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }, [refreshToken]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const handleAuthSuccess = useCallback(
    ({ token: tk, accessToken, refreshToken: nextRefreshToken, user: usr }) => {
      setToken(accessToken || tk);
      setRefreshToken(nextRefreshToken || null);
      setUser(usr);
      showNotification("Signed in successfully", "success");
    },
    [showNotification]
  );

  const register = useCallback(
    async (payload) => {
      const res = await authService.register(payload);
      handleAuthSuccess(res);
      return res;
    },
    [handleAuthSuccess]
  );

  const login = useCallback(
    async (payload) => {
      const res = await authService.login(payload);
      handleAuthSuccess(res);
      return res;
    },
    [handleAuthSuccess]
  );

  const clearAuthState = useCallback((message = "Logged out") => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    showNotification(message, "info");
  }, [showNotification]);

  const logout = useCallback(
    async (message = "Logged out") => {
      const currentRefreshToken =
        localStorage.getItem(REFRESH_TOKEN_KEY) || refreshToken;

      try {
        if (currentRefreshToken && token) {
          await authService.logout(currentRefreshToken);
        }
      } catch (error) {
        // Best-effort revocation; still clear local auth state.
      } finally {
        clearAuthState(message);
      }
    },
    [clearAuthState, refreshToken, token]
  );

  // When the API signals an expired/invalid token, force a logout so
  // ProtectedRoute automatically redirects the user to /login.
  useEffect(() => {
    const handleSessionExpired = () => {
      clearAuthState("Session expired. Please log in again.");
    };
    window.addEventListener("erp:auth:expired", handleSessionExpired);
    return () => {
      window.removeEventListener("erp:auth:expired", handleSessionExpired);
    };
  }, [clearAuthState]);

  const updateProfile = useCallback(
    async (payload) => {
      const res = await authService.updateProfile(payload);
      setUser(res.user || res);
      showNotification("Profile updated successfully", "success");
      return res;
    },
    [showNotification]
  );

  const changePassword = useCallback(
    async (payload) => {
      await authService.changePassword(payload);
      showNotification("Password changed successfully", "success");
    },
    [showNotification]
  );

  const value = {
    user,
    token,
    refreshToken,
    isAuthenticated: !!token,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};


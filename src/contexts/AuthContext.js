import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import authService from "../services/authService";
import { useApp } from "./AppContext";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("erp_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("erp_token"));
  const { showNotification } = useApp();

  useEffect(() => {
    if (token) {
      localStorage.setItem("erp_token", token);
    } else {
      localStorage.removeItem("erp_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("erp_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("erp_user");
    }
  }, [user]);

  const handleAuthSuccess = useCallback(
    ({ token: tk, user: usr }) => {
      setToken(tk);
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

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    showNotification("Logged out", "info");
  }, [showNotification]);

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


import api from "./api";

const authService = {
  register: async (payload) => {
    return await api.post("/auth/register", payload);
  },
  login: async (payload) => {
    return await api.post("/auth/login", payload);
  },
  updateProfile: async (payload) => {
    return await api.put("/auth/profile", payload);
  },
  changePassword: async (payload) => {
    return await api.put("/auth/change-password", payload);
  },
};

export default authService;


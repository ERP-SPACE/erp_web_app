// src/services/accountingService.js
import api from "./api";

const accountingService = {
  // ── Payments ──────────────────────────────────────────────────────────────
  getPayments: async (params = {}) => {
    return await api.get("/payments", { params });
  },

  getPayment: async (id) => {
    return await api.get(`/payments/${id}`);
  },

  createPayment: async (data) => {
    return await api.post("/payments", data);
  },

  postPayment: async (id) => {
    return await api.post(`/payments/${id}/post`);
  },

  // ── Ledgers ───────────────────────────────────────────────────────────────
  getLedgers: async (params = {}) => {
    return await api.get("/ledgers", { params });
  },

  getLedger: async (id) => {
    return await api.get(`/ledgers/${id}`);
  },

  createLedger: async (data) => {
    return await api.post("/ledgers", data);
  },

  updateLedger: async (id, data) => {
    return await api.put(`/ledgers/${id}`, data);
  },

  // Ledger statement — transactions for a given ledger + optional date range
  getLedgerTransactions: async (id, params = {}) => {
    return await api.get(`/ledgers/${id}/transactions`, { params });
  },

  // Alias used by Ledgers.js; delegates to the transactions endpoint
  getLedgerEntries: async (id, params = {}) => {
    return await api.get(`/ledgers/${id}/transactions`, { params });
  },

  // Running balance summary for a ledger
  getLedgerBalance: async (id, params = {}) => {
    return await api.get(`/ledgers/${id}/balance`, { params });
  },

  // ── Vouchers ──────────────────────────────────────────────────────────────
  getVouchers: async (params = {}) => {
    return await api.get("/vouchers", { params });
  },

  getVoucher: async (id) => {
    return await api.get(`/vouchers/${id}`);
  },

  createVoucher: async (data) => {
    return await api.post("/vouchers", data);
  },

  updateVoucher: async (id, data) => {
    return await api.put(`/vouchers/${id}`, data);
  },

  deleteVoucher: async (id) => {
    return await api.delete(`/vouchers/${id}`);
  },

  postVoucher: async (id) => {
    return await api.post(`/vouchers/${id}/post`);
  },
};

export default accountingService;

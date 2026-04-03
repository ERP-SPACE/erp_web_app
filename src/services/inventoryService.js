// src/services/inventoryService.js
import api from "./api";

const inventoryService = {
  // Rolls
  getRolls: async (params = {}) => {
    const res = await api.get("/rolls", { params });
    const rollSource =
      res?.data ||
      res?.rolls ||
      res?.rows ||
      res?.result ||
      res?.data?.rolls ||
      [];
    const rolls = Array.isArray(rollSource)
      ? rollSource
      : rollSource?.data || [];
    return {
      rolls,
      pagination: res.pagination || res.data?.pagination || {},
    };
  },

  getRoll: async (id) => {
    const res = await api.get(`/rolls/${id}`);
    return res.data;
  },

  getRollByBarcode: async (barcode) => {
    const res = await api.get(`/rolls/barcode/${barcode}`);
    return res.data;
  },

  createRolls: async (data) => {
    const res = await api.post("/rolls", data);
    return res.data;
  },

  updateRoll: async (id, data) => {
    const res = await api.patch(`/rolls/${id}`, data);
    return res.data;
  },

  // Unmapped Rolls Management
  getUnmappedRolls: async () => {
    const res = await api.get("/rolls/unmapped");
    return res.data || [];
  },

  mapUnmappedRolls: async (mappings) => {
    const res = await api.post("/rolls/map", { mappings });
    return res.data; // { success:[], failed:[] }
  },

  // Roll Allocation
  allocateRolls: async (soLineId, quantity) => {
    const res = await api.post("/rolls/allocate", { soLineId, quantity });
    return res.data;
  },

  deallocateRolls: async (soLineId) => {
    const res = await api.post("/rolls/deallocate", { soLineId });
    return res.data;
  },

  // Roll Dispatch
  dispatchRolls: async (dcId, rollIds) => {
    const res = await api.post("/rolls/dispatch", { dcId, rollIds });
    return res.data;
  },

  // Returns
  handleReturn: async (rollId, remainingMeters, reason) => {
    const res = await api.post("/rolls/return", {
      rollId,
      remainingMeters,
      reason,
    });
    return res.data;
  },

  // Scrap
  markAsScrap: async (rollId, reason) => {
    const res = await api.patch(`/rolls/${rollId}/scrap`, { reason });
    return res.data;
  },

  // Stock Summary & Reports
  getStockSummary: async (params = {}) => {
    const res = await api.get("/rolls/summary", { params });
    return res.data;
  },

  getInventorySummary: async () => {
    const res = await api.get("/rolls/summary");
    return res.data;
  },

  // Stock Movement History
  getStockMovement: async (params = {}) => {
    // erp_api currently doesn't expose `/inventory/stock-movement`.
    // Route `/reports` exists (placeholder) under `/api/v1/reports`.
    const res = await api.get("/reports", { params });
    return res.data || [];
  },

  getRollHistory: async (id) => {
    const res = await api.get(`/rolls/${id}/history`);
    return res.data || [];
  },

  // Batch Management
  getBatches: async (params = {}) => {
    const res = await api.get("/batches", { params });
    return res.data || [];
  },

  getBatch: async (id) => {
    const res = await api.get(`/batches/${id}`);
    return res.data;
  },

  createBatch: async (data) => {
    const res = await api.post("/batches", data);
    return res.data;
  },
};

export default inventoryService;

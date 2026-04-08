// src/services/purchaseService.js
import api from "./api";

const purchaseService = {
  // Purchase Orders
  getPurchaseOrders: async (params = {}) => {
    return await api.get("/purchase-orders", { params });
  },

  getPurchaseOrder: async (id) => {
    return await api.get(`/purchase-orders/${id}`);
  },

  createPurchaseOrder: async (data) => {
    return await api.post("/purchase-orders", data);
  },

  updatePurchaseOrder: async (id, data) => {
    return await api.put(`/purchase-orders/${id}`, data);
  },

  approvePurchaseOrder: async (id) => {
    return await api.post(`/purchase-orders/${id}/approve`);
  },

  closePurchaseOrder: async (id) => {
    return await api.post(`/purchase-orders/${id}/close`);
  },

  cancelPurchaseOrder: async (id) => {
    return await api.post(`/purchase-orders/${id}/cancel`);
  },

  remindPurchaseOrder: async (id, data = {}) => {
    return await api.post(`/purchase-orders/${id}/remind`, data);
  },

  // Purchase Invoices
  getPurchaseInvoices: async (params = {}) => {
    return await api.get("/purchase-invoices", { params });
  },

  getPurchaseInvoice: async (id) => {
    return await api.get(`/purchase-invoices/${id}`);
  },

  createPurchaseInvoice: async (data) => {
    return await api.post("/purchase-invoices", data);
  },

  updatePurchaseInvoice: async (id, data) => {
    return await api.put(`/purchase-invoices/${id}`, data);
  },

  postPurchaseInvoice: async (id) => {
    return await api.post(`/purchase-invoices/${id}/post`);
  },

  allocateLandedCost: async (id, data) => {
    return await api.post(
      `/purchase-invoices/${id}/allocate-landed-cost`,
      data
    );
  },

  // Batches
  getBatches: async (params = {}) => {
    return await api.get("/batches", { params });
  },

  createBatch: async (data) => {
    return await api.post("/batches", data);
  },

  // GRNs (Goods Received Notes)
  getGRNs: async (params = {}) => {
    return await api.get("/grns", { params });
  },

  getGRN: async (id) => {
    return await api.get(`/grns/${id}`);
  },

  createGRN: async (data) => {
    return await api.post("/grns", data);
  },

  postGRN: async (id) => {
    return await api.post(`/grns/${id}/post`);
  },
};

export default purchaseService;

// src/services/masterService.js
import api from "./api";

const masterService = {
  // Categories
  getCategories: async (params = {}) => {
    const res = await api.get("/categories", { params });
    return res;
  },

  getCategory: async (id) => {
    const res = await api.get(`/categories/${id}`);
    return res.data;
  },

  createCategory: async (data) => {
    const res = await api.post("/categories", data);
    return res.data;
  },

  updateCategory: async (id, data) => {
    const res = await api.patch(`/categories/${id}`, data);
    return res.data;
  },

  toggleCategoryStatus: async (id) => {
    const res = await api.patch(`/categories/${id}/toggle-status`);
    return res.data;
  },

  deleteCategory: async (id) => {
    const res = await api.delete(`/categories/${id}`);
    return res;
  },

  // Products
  getProducts: async (params = {}) => {
    const res = await api.get("/products", { params });
    return {
      products: res.products || [],
      pagination: res.pagination || {},
    };
  },

  getProduct: async (id) => {
    const res = await api.get(`/products/${id}`);
    return res.data;
  },

  createProduct: async (data) => {
    const res = await api.post("/products", data);
    return res.data;
  },

  updateProduct: async (id, data) => {
    const res = await api.patch(`/products/${id}`, data);
    return res.data;
  },

  deleteProduct: async (id) => {
    const res = await api.delete(`/products/${id}`);
    return res;
  },

  toggleProductStatus: async (id) => {
    const res = await api.patch(`/products/${id}/toggle-status`);
    return res.data;
  },

  bulkCreateProducts: async (products) => {
    const res = await api.post("/products/bulk", { products });
    return res.data; // { success:[], failed:[] }
  },

  getProductsByCategoryAndGSM: async (categoryId, gsm) => {
    const res = await api.get(`/products/category/${categoryId}/gsm/${gsm}`);
    return res.data || [];
  },

  // GSM
  getGSMs: async (params = {}) => {
    const res = await api.get("/gsms", { params });
    const dataSource =
      res?.data ||
      res?.gsms ||
      res?.rows ||
      res?.results ||
      res?.data?.data ||
      res;
    return Array.isArray(dataSource) ? dataSource : dataSource?.data || [];
  },

  createGSM: async (data) => {
    const res = await api.post("/gsms", data);
    return res.data || res;
  },

  updateGSM: async (id, data) => {
    const res = await api.patch(`/gsms/${id}`, data);
    return res.data || res;
  },

  toggleGSMStatus: async (id) => {
    const res = await api.patch(`/gsms/${id}/toggle-status`);
    return res.data || res;
  },

  deleteGSM: async (id) => {
    const res = await api.delete(`/gsms/${id}`);
    return res.data || res;
  },

  // Qualities
  getQualities: async (params = {}) => {
    const res = await api.get("/qualities", { params });
    const dataSource =
      res?.data ||
      res?.qualities ||
      res?.rows ||
      res?.results ||
      res?.data?.data ||
      res;
    return Array.isArray(dataSource) ? dataSource : dataSource?.data || [];
  },

  createQuality: async (data) => {
    const res = await api.post("/qualities", data);
    return res.data || res;
  },

  updateQuality: async (id, data) => {
    const res = await api.patch(`/qualities/${id}`, data);
    return res.data || res;
  },

  toggleQualityStatus: async (id) => {
    const res = await api.patch(`/qualities/${id}/toggle-status`);
    return res.data || res;
  },

  deleteQuality: async (id) => {
    const res = await api.delete(`/qualities/${id}`);
    return res.data || res;
  },

  // SKUs
  getSKUs: async (params = {}) => {
    const res = await api.get("/skus", { params });
    const dataSource =
      res?.data ||
      res?.skus ||
      res?.rows ||
      res?.results ||
      res?.data?.data ||
      [];
    const skus = Array.isArray(dataSource)
      ? dataSource
      : dataSource?.data || [];
    return {
      skus,
      pagination: res.pagination || res.data?.pagination || {},
    };
  },

  getSKU: async (id) => {
    const res = await api.get(`/skus/${id}`);
    return res.data;
  },

  getAvailableSKUs: async () => {
    const res = await api.get("/skus/available");
    return res.data || [];
  },

  getSKUByCode: async (code) => {
    const res = await api.get(`/skus/code/${code}`);
    return res.data;
  },

  createSKU: async (data) => {
    const res = await api.post("/skus", data);
    return res.data;
  },

  updateSKU: async (id, data) => {
    const res = await api.patch(`/skus/${id}`, data);
    return res.data;
  },

  deleteSKU: async (id) => {
    const res = await api.delete(`/skus/${id}`);
    return res;
  },

  bulkCreateSKUs: async (productId, widths) => {
    const res = await api.post("/skus/bulk", { productId, widths });
    return res.data; // { success:[], failed:[] }
  },

  toggleSKUStatus: async (id) => {
    const res = await api.patch(`/skus/${id}/toggle-status`);
    return res.data;
  },

  // Suppliers
  getSuppliers: async (params = {}) => {
    const res = await api.get("/suppliers", { params });
    return {
      suppliers: res.suppliers || [],
      pagination: res.pagination || {},
    };
  },

  getNextSupplierCode: async () => {
    const res = await api.get("/suppliers/next-code");
    return res.data?.supplierCode || res.supplierCode || "";
  },

  getSupplier: async (id) => {
    const res = await api.get(`/suppliers/${id}`);
    return res.data;
  },

  getSupplierByCode: async (code) => {
    const res = await api.get(`/suppliers/code/${code}`);
    return res.data;
  },

  createSupplier: async (data) => {
    const res = await api.post("/suppliers", data);
    return res.data;
  },

  updateSupplier: async (id, data) => {
    const res = await api.patch(`/suppliers/${id}`, data);
    return res.data;
  },

  toggleSupplierStatus: async (id) => {
    const res = await api.patch(`/suppliers/${id}/toggle-status`);
    return res.data;
  },

  updateSupplierRating: async (id, rating, notes) => {
    const res = await api.patch(`/suppliers/${id}/rating`, { rating, notes });
    return res.data;
  },

  getSuppliersByProduct: async (productId) => {
    const res = await api.get(`/suppliers/product/${productId}`);
    return res.data || [];
  },

  deleteSupplier: async (id) => {
    const res = await api.delete(`/suppliers/${id}`);
    return res;
  },

  // Supplier Base Rates
  getSupplierBaseRates: async (supplierId) => {
    const res = await api.get(`/suppliers/${supplierId}/base-rates`);
    return res.data || [];
  },

  upsertSupplierBaseRate: async (supplierId, skuId, rate) => {
    const res = await api.post(`/suppliers/${supplierId}/base-rates`, {
      skuId,
      rate,
    });
    return res.data || res;
  },

  deleteSupplierBaseRate: async (supplierId, baseRateId) => {
    const res = await api.delete(
      `/suppliers/${supplierId}/base-rates/${baseRateId}`
    );
    return res.data || res;
  },

  bulkUpsertSupplierBaseRates: async (supplierId, rates) => {
    const res = await api.post(`/suppliers/${supplierId}/base-rates/bulk`, {
      rates,
    });
    return res.data || res;
  },

  getSupplierBaseRateHistory: async (supplierId, baseRateId) => {
    const res = await api.get(
      `/suppliers/${supplierId}/base-rates/${baseRateId}/history`
    );
    return res.data || [];
  },

  getAllSupplierRateHistory: async (supplierId) => {
    const res = await api.get(`/suppliers/${supplierId}/rate-history`);
    return res.data || [];
  },

  // Supplier Contact Persons
  getSupplierContactPersons: async (supplierId) => {
    const res = await api.get(`/suppliers/${supplierId}/contact-persons`);
    return res.data || [];
  },

  createSupplierContactPerson: async (supplierId, data) => {
    const res = await api.post(`/suppliers/${supplierId}/contact-persons`, data);
    return res.data || res;
  },

  updateSupplierContactPerson: async (supplierId, contactPersonId, data) => {
    const res = await api.patch(
      `/suppliers/${supplierId}/contact-persons/${contactPersonId}`,
      data
    );
    return res.data || res;
  },

  deleteSupplierContactPerson: async (supplierId, contactPersonId) => {
    const res = await api.delete(
      `/suppliers/${supplierId}/contact-persons/${contactPersonId}`
    );
    return res.data || res;
  },

  setSupplierContactPersonPrimary: async (supplierId, contactPersonId) => {
    const res = await api.patch(
      `/suppliers/${supplierId}/contact-persons/${contactPersonId}/set-primary`
    );
    return res.data || res;
  },

  // Customers
  getCustomers: async (params = {}) => {
    const res = await api.get("/customers", { params });
    return {
      data: res.data || res.customers || [],
      customers: res.data || res.customers || [],
      pagination: res.pagination || {},
    };
  },

  getCustomer: async (id) => {
    const res = await api.get(`/customers/${id}`);
    return res.data || res; // Returns customer data
  },

  createCustomer: async (data) => {
    const res = await api.post("/customers", data);
    return res.data || res;
  },

  updateCustomer: async (id, data) => {
    const res = await api.patch(`/customers/${id}`, data);
    return res.data || res;
  },

  updateCreditPolicy: async (id, creditPolicy) => {
    const res = await api.patch(`/customers/${id}/credit-policy`, creditPolicy);
    return res.data;
  },

  checkCredit: async (id) => {
    const res = await api.get(`/customers/${id}/credit-check`);
    return res.data?.data || res.data || res;
  },

  checkCreditLimit: async (id) => {
    const res = await api.get(`/customers/${id}/credit-check`);
    return res.data?.data || res.data || res;
  },

  blockCustomer: async (id, reason) => {
    const res = await api.post(`/customers/${id}/block`, { reason });
    return res.data;
  },

  unblockCustomer: async (id, notes) => {
    const res = await api.post(`/customers/${id}/unblock`, { notes });
    return res.data;
  },

  deleteCustomer: async (id) => {
    const res = await api.delete(`/customers/${id}`);
    return res;
  },

  // Customer Rates
  getCustomerRates: async (customerId) => {
    const res = await api.get(`/customers/${customerId}/rates`);
    return res.data || [];
  },

  setCustomerRate: async (customerId, rateData) => {
    const res = await api.post(`/customers/${customerId}/rates`, rateData);
    return res.data;
  },

  bulkUpdateCustomerRates: async (customerId, rateUpdates) => {
    const res = await api.post(`/customers/${customerId}/bulk-rates`, {
      rateUpdates,
    });
    return res.data;
  },

  getCustomerRateHistory: async (customerId, productId = null, limit = 50) => {
    const params = { limit };
    if (productId) params.productId = productId;
    const res = await api.get(`/customers/${customerId}/rate-history`, {
      params,
    });
    return res.data?.data || res.data || [];
  },

  // Customer Groups
  getCustomerGroups: async (params = {}) => {
    const res = await api.get("/customer-groups", { params });
    return {
      data: res.data || res.customerGroups || [],
      customerGroups: res.data || res.customerGroups || [],
    };
  },

  getCustomerGroup: async (id) => {
    const res = await api.get(`/customer-groups/${id}`);
    return res.data || res;
  },

  createCustomerGroup: async (data) => {
    const res = await api.post("/customer-groups", data);
    return res.data || res;
  },

  updateCustomerGroup: async (id, data) => {
    const res = await api.patch(`/customer-groups/${id}`, data);
    return res.data || res;
  },

  toggleCustomerGroupStatus: async (id) => {
    const res = await api.patch(`/customer-groups/${id}/toggle-status`);
    return res.data || res;
  },

  deleteCustomerGroup: async (id) => {
    const res = await api.delete(`/customer-groups/${id}`);
    return res;
  },

  // Agents
  getAgents: async (params = {}) => {
    const res = await api.get("/agents", { params });
    return {
      agents: res.agents || res.data || [],
      pagination: res.pagination || {},
    };
  },

  getAgent: async (id) => {
    const res = await api.get(`/agents/${id}`);
    return res.data || res;
  },

  createAgent: async (data) => {
    const res = await api.post("/agents", data);
    return res.data || res;
  },

  updateAgent: async (id, data) => {
    const res = await api.patch(`/agents/${id}`, data);
    return res.data || res;
  },

  toggleAgentStatus: async (id) => {
    const res = await api.patch(`/agents/${id}/status`);
    return res.data || res;
  },

  upsertAgentPartyCommission: async (id, commissionData) => {
    const res = await api.post(`/agents/${id}/party-commissions`, commissionData);
    return res.data || res;
  },

  removeAgentPartyCommission: async (id, customerId, notes) => {
    const res = await api.delete(
      `/agents/${id}/party-commissions/${customerId}`,
      {
        data: { notes },
      }
    );
    return res.data || res;
  },

  addAgentCommissionPayout: async (id, payoutData) => {
    const res = await api.post(`/agents/${id}/commission-payouts`, payoutData);
    return res.data || res;
  },

  updateAgentCommissionPayout: async (id, payoutId, updateData) => {
    const res = await api.patch(
      `/agents/${id}/commission-payouts/${payoutId}`,
      updateData
    );
    return res.data || res;
  },

  addAgentKycDocument: async (id, kycData) => {
    const res = await api.post(`/agents/${id}/kyc-documents`, kycData);
    return res.data || res;
  },

  removeAgentKycDocument: async (id, documentId) => {
    const res = await api.delete(`/agents/${id}/kyc-documents/${documentId}`);
    return res.data || res;
  },
};

export default masterService;

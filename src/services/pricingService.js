// src/services/pricingService.js
import api from "./api";

const pricingService = {
  // Price Calculation (44" Benchmark)
  calculatePrice: async (
    customerId,
    productId,
    widthInches,
    quantityRolls,
    lengthMeters = 1000
  ) => {
    const res = await api.post("/pricing/calculate", {
      customerId,
      productId,
      widthInches,
      quantityRolls,
      lengthMeters,
    });
    return res.data;
  },

  // Override Price
  applyOverride: async (originalPrice, overrideRate44, widthInches, reason) => {
    const res = await api.post("/pricing/override", {
      originalPrice,
      overrideRate44,
      widthInches,
      reason,
    });
    return res.data;
  },

  // Price Matrix
  getCustomerPriceMatrix: async (customerId) => {
    const res = await api.get(`/pricing/matrix/${customerId}`);
    return res.data || [];
  },

  // Deal Rates
  calculateDealRate: async (customerId, items, dealDiscount) => {
    const res = await api.post("/pricing/deal-rate", {
      customerId,
      items,
      dealDiscount,
    });
    return res.data;
  },

  // Bulk Rate Revision
  bulkRateRevision: async (
    customerId,
    revisionType,
    value,
    productIds = null
  ) => {
    const res = await api.post("/pricing/bulk-revision", {
      customerId,
      revisionType,
      value,
      productIds,
    });
    return res.data;
  },

  // Rate Calculator Helper
  calculateWidthRate: (benchmarkRate44, widthInches) => {
    return Math.round(benchmarkRate44 * (widthInches / 44));
  },

  // Format Price for Display
  formatPrice: (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  },
};

export default pricingService;

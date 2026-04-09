export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (number) => {
  if (number === null || number === undefined) return "0";
  return new Intl.NumberFormat("en-IN").format(number);
};

export const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatInches = (value, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (raw === "-") return raw;
  if (raw.includes('"')) return raw;
  return `${raw}"`;
};

export const getStatusColor = (status) => {
  const statusColors = {
    Draft: "default",
    Approved: "primary",
    Posted: "success",
    Cancelled: "error",
    Closed: "default",
    Open: "info",
    Confirmed: "primary",
    OnHold: "warning",
    PartiallyReceived: "warning",
    PartiallyFulfilled: "warning",
    Paid: "success",
    Unpaid: "error",
    PartiallyPaid: "warning",
    Unmapped: "error",
    Mapped: "info",
    Allocated: "warning",
    Dispatched: "success",
    Returned: "warning",
    Scrap: "error",
  };
  return statusColors[status] || "default";
};

export const getRollStatusColor = (status) => {
  const colors = {
    Unmapped: "#f44336",
    Mapped: "#2196f3",
    Allocated: "#ff9800",
    Dispatched: "#4caf50",
    Returned: "#ff9800",
    Scrap: "#757575",
  };
  return colors[status] || "#9e9e9e";
};

import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "../components/common/Layout";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

// Lazy load components
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Categories = lazy(() => import("../pages/masters/Categories"));
const GSMs = lazy(() => import("../pages/masters/GSMs"));
const Qualities = lazy(() => import("../pages/masters/Qualities"));
const Products = lazy(() => import("../pages/masters/Products"));
const SKUs = lazy(() => import("../pages/masters/SKUs"));
const Suppliers = lazy(() => import("../pages/masters/Suppliers"));
const Customers = lazy(() => import("../pages/masters/Customers"));
const Agents = lazy(() => import("../pages/masters/Agents"));
const PurchaseOrders = lazy(() => import("../pages/purchase/PurchaseOrders"));
const PurchaseInvoices = lazy(() =>
  import("../pages/purchase/PurchaseInvoices")
);
const Rolls = lazy(() => import("../pages/inventory/Rolls"));
const UnmappedRolls = lazy(() => import("../pages/inventory/UnmappedRolls"));
const StockSummary = lazy(() => import("../pages/inventory/StockSummary"));
const SalesOrders = lazy(() => import("../pages/sales/SalesOrders"));
const DeliveryChallans = lazy(() => import("../pages/sales/DeliveryChallans"));
const SalesInvoices = lazy(() => import("../pages/sales/SalesInvoices"));
const Payments = lazy(() => import("../pages/accounting/Payments"));
const Vouchers = lazy(() => import("../pages/accounting/Vouchers"));
const Ledgers = lazy(() => import("../pages/accounting/Ledgers"));
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const Profile = lazy(() => import("../pages/profile/Profile"));
const Settings = lazy(() => import("../pages/settings/Settings"));
// const TrialBalance = lazy(() => import("../pages/reports/TrialBalance"));
// const ProfitLoss = lazy(() => import("../pages/reports/ProfitLoss"));
// const BalanceSheet = lazy(() => import("../pages/reports/BalanceSheet"));
// const ARAgingReport = lazy(() => import("../pages/reports/ARAgingReport"));
// const StockReport = lazy(() => import("../pages/reports/StockReport"));

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="gsms" element={<GSMs />} />
          <Route path="qualities" element={<Qualities />} />
          <Route path="categories" element={<Categories />} />
          <Route path="products" element={<Products />} />
          <Route path="skus" element={<SKUs />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="agents" element={<Agents />} />

          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="purchase-invoices" element={<PurchaseInvoices />} />

          <Route path="rolls" element={<Rolls />} />
          <Route path="unmapped-rolls" element={<UnmappedRolls />} />
          <Route path="stock-summary" element={<StockSummary />} />

          <Route path="sales-orders" element={<SalesOrders />} />
          <Route path="delivery-challans" element={<DeliveryChallans />} />
          <Route path="sales-invoices" element={<SalesInvoices />} />

          <Route path="payments" element={<Payments />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="ledgers" element={<Ledgers />} />

          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />

          {/* <Route path="reports">
            <Route path="trial-balance" element={<TrialBalance />} />
            <Route path="profit-loss" element={<ProfitLoss />} />
            <Route path="balance-sheet" element={<BalanceSheet />} />
            <Route path="ar-aging" element={<ARAgingReport />} />
            <Route path="stock" element={<StockReport />} />
          </Route> */}
        </Route>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

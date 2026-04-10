import React, { Suspense, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  useTheme,
  useMediaQuery,
  Avatar,
  Stack,
  Badge,
  Breadcrumbs,
  Menu,
  MenuItem,
  ListItemAvatar,
  Popover,
  InputBase,
  Tooltip,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  Category,
  Inventory,
  People,
  Business,
  ShoppingCart,
  LocalShipping,
  Receipt,
  AccountBalance,
  Assessment,
  ExpandLess,
  ExpandMore,
  Assignment,
  ListAlt,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Lock as LockIcon,
  Help as HelpIcon,
  KeyboardArrowDown as ChevronDownIcon,
  Search as SearchIcon,
  Inventory2 as Inventory2Icon,
  BarChart as BarChartIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  ReportProblem as LowStockIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import ConfirmDialog from "./ConfirmDialog";

const drawerWidth = 260;

// ─── Helper: get user initials ───────────────────────────────────────────────
const getInitials = (username) => {
  if (!username) return "AD";
  return username
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
};

// ─── Navigation menu structure ────────────────────────────────────────────────
const menuItems = [
  {
    title: "Dashboard",
    path: "/",
    icon: <Dashboard />,
  },
  {
    sectionLabel: "Operations",
  },
  {
    title: "Purchase",
    icon: <ShoppingCart />,
    children: [
      { title: "Purchase Orders", path: "/purchase-orders", icon: <Assignment /> },
      { title: "Purchase Invoices", path: "/purchase-invoices", icon: <Receipt /> },
      { title: "Purchase Returns", path: "/purchase-returns", icon: <Receipt /> },
    ],
  },
  {
    title: "Inventory",
    icon: <Inventory />,
    children: [
      // { title: "Rolls", path: "/rolls", icon: <Inventory2Icon /> },
      { title: "Unmapped Rolls", path: "/unmapped-rolls", icon: <LowStockIcon /> },
      { title: "Stock Summary", path: "/stock-summary", icon: <BarChartIcon /> },
    ],
  },
  {
    title: "Sales",
    icon: <LocalShipping />,
    children: [
      { title: "Sales Orders", path: "/sales-orders", icon: <Assignment /> },
      { title: "Delivery Challans", path: "/delivery-challans", icon: <LocalShipping /> },
      { title: "Sales Invoices", path: "/sales-invoices", icon: <Receipt /> },
      { title: "Sales Returns", path: "/sales-returns", icon: <Receipt /> },
    ],
  },
  {
    title: "Accounting",
    icon: <AccountBalance />,
    children: [
      { title: "Payments", path: "/payments", icon: <PaymentIcon /> },
      { title: "Vouchers", path: "/vouchers", icon: <Assignment /> },
      { title: "Ledgers", path: "/ledgers", icon: <ListAlt /> },
    ],
  },
  {
    sectionLabel: "Configuration",
  },
  {
    title: "Masters",
    icon: <Category />,
    children: [
      { title: "Categories", path: "/categories", icon: <Category /> },
      { title: "Quality", path: "/qualities", icon: <CheckCircleIcon /> },
      { title: "GSM", path: "/gsms", icon: <ListAlt /> },
      { title: "Products", path: "/products", icon: <ListAlt /> },
      { title: "SKUs", path: "/skus", icon: <Assignment /> },
      { title: "Suppliers", path: "/suppliers", icon: <Business /> },
      { title: "Customers", path: "/customers", icon: <People /> },
      { title: "Agents / Brokers", path: "/agents", icon: <People /> },
    ],
  },
  {
    sectionLabel: "Analytics",
  },
  {
    title: "Reports",
    icon: <Assessment />,
    disabled: true,
    comingSoon: true,
    children: [
      { title: "Trial Balance", path: "/reports/trial-balance", icon: <Assessment />, disabled: true },
      { title: "Profit & Loss", path: "/reports/profit-loss", icon: <Assessment />, disabled: true },
      { title: "Balance Sheet", path: "/reports/balance-sheet", icon: <Assessment />, disabled: true },
      { title: "AR Aging", path: "/reports/ar-aging", icon: <Assessment />, disabled: true },
      { title: "Stock Report", path: "/reports/stock", icon: <Assessment />, disabled: true },
    ],
  },
];

// ─── Breadcrumb trail builder ─────────────────────────────────────────────────
const getBreadcrumbTrail = (items, path) => {
  for (const item of items) {
    if (item.sectionLabel) continue;
    if (item.path === path) return [item];
    if (item.children) {
      for (const child of item.children) {
        if (child.path === path) return [item, child];
      }
    }
  }
  if (path === "/profile") return [{ title: "My Profile" }];
  if (path === "/settings") return [{ title: "Settings" }];
  return [{ title: "Dashboard", path: "/" }];
};

// ─── Notification data ────────────────────────────────────────────────────────
const NOTIFICATIONS = [
  {
    id: 1,
    icon: <LowStockIcon fontSize="small" />,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.1)",
    title: "Low Stock Alert",
    message: "A4 White 75 GSM is below reorder level",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    icon: <PaymentIcon fontSize="small" />,
    iconColor: "#ef4444",
    iconBg: "rgba(239,68,68,0.1)",
    title: "Payment Overdue",
    message: "Ravi Textiles — ₹45,000 due 3 days ago",
    time: "2 hrs ago",
    unread: true,
  },
  {
    id: 3,
    icon: <CheckCircleIcon fontSize="small" />,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.1)",
    title: "PO Approved",
    message: "Purchase Order #PO-0234 has been approved",
    time: "Yesterday",
    unread: false,
  },
];

// ─── Layout Component ─────────────────────────────────────────────────────────
const Layout = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const { user, logout } = useAuth();
  const breadcrumbTrail = getBreadcrumbTrail(menuItems, location.pathname);
  const activeTitle = breadcrumbTrail[breadcrumbTrail.length - 1]?.title || "Dashboard";

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleExpandClick = (title) => {
    setExpandedItems((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleProfileOpen = (e) => setProfileAnchorEl(e.currentTarget);
  const handleProfileClose = () => setProfileAnchorEl(null);

  const handleNotifOpen = (e) => setNotifAnchorEl(e.currentTarget);
  const handleNotifClose = () => setNotifAnchorEl(null);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleLogoutClick = () => {
    handleProfileClose();
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutConfirmOpen(false);
    logout();
  };

  // Filter sidebar items by search
  const filteredSearch = sidebarSearch.trim().toLowerCase();
  const matchesSearch = (item) => {
    if (!filteredSearch) return true;
    if (item.title?.toLowerCase().includes(filteredSearch)) return true;
    if (item.children?.some((c) => c.title?.toLowerCase().includes(filteredSearch))) return true;
    return false;
  };

  // ─── Sidebar menu item renderer ─────────────────────────────────────────────
  const renderMenuItem = (item, depth = 0) => {
    if (item.sectionLabel) {
      if (filteredSearch) return null;
      return (
        <Typography
          key={item.sectionLabel}
          variant="caption"
          sx={{
            display: "block",
            px: 2,
            pt: 2,
            pb: 0.5,
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "grey.400",
          }}
        >
          {item.sectionLabel}
        </Typography>
      );
    }

    if (!matchesSearch(item)) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = filteredSearch ? true : expandedItems[item.title];
    const isActive = location.pathname === item.path;
    const isChildActive =
      hasChildren && item.children.some((child) => child.path === location.pathname);
    const isDisabled = item.disabled;

    return (
      <React.Fragment key={item.title}>
        <ListItem disablePadding sx={{ pl: depth * 1.5, mb: 0.5 }}>
          <ListItemButton
            onClick={() => {
              if (isDisabled) return;
              if (hasChildren) handleExpandClick(item.title);
              else if (item.path) handleNavigate(item.path);
            }}
            selected={isActive}
            disabled={isDisabled}
            sx={{
              minHeight: depth === 0 ? 44 : 38,
              borderRadius: 1.5,
              mx: 0.5,
              px: 1.5,
              opacity: isDisabled ? 0.5 : 1,
              "&.Mui-selected": {
                backgroundColor: "primary.50",
                color: "primary.main",
                fontWeight: 600,
                "& .MuiListItemIcon-root": { color: "primary.main" },
              },
              ...(isChildActive && depth === 0 && { backgroundColor: "grey.50" }),
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 36,
                color: isActive || isChildActive ? "primary.main" : "grey.500",
                "& .MuiSvgIcon-root": { fontSize: depth === 0 ? "1.25rem" : "1.1rem" },
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              primaryTypographyProps={{
                fontSize: depth === 0 ? "0.875rem" : "0.8125rem",
                fontWeight: isActive || isChildActive ? 600 : 500,
              }}
            />
            {item.comingSoon && (
              <Chip
                label="Soon"
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  bgcolor: "grey.100",
                  color: "grey.500",
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            )}
            {hasChildren && !item.comingSoon && (
              <Box sx={{ color: "grey.400", display: "flex", alignItems: "center" }}>
                {isExpanded ? (
                  <ExpandLess sx={{ fontSize: "1.2rem" }} />
                ) : (
                  <ExpandMore sx={{ fontSize: "1.2rem" }} />
                )}
              </Box>
            )}
          </ListItemButton>
        </ListItem>
        {hasChildren && !isDisabled && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 1 }}>
              {item.children.map((child) => renderMenuItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  // ─── Sidebar drawer content ──────────────────────────────────────────────────
  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Branding */}
      <Box
        sx={{
          height: "70px",
          minHeight: "70px",
          px: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: "1.25rem",
            flexShrink: 0,
          }}
        >
          P
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2, color: "grey.900" }}
          >
            {process.env.REACT_APP_COMPANY_NAME || "Paper ERP"}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.500", fontSize: "0.7rem" }}>
            Enterprise Edition
          </Typography>
        </Box>
      </Box>

      {/* Search bar */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 34,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: sidebarSearch ? "primary.main" : "grey.200",
            bgcolor: sidebarSearch ? "primary.50" : "grey.50",
            transition: "all 0.15s",
          }}
        >
          <SearchIcon sx={{ fontSize: "1rem", color: sidebarSearch ? "primary.main" : "grey.400" }} />
          <InputBase
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Quick search…"
            sx={{ flex: 1, fontSize: "0.8125rem", "& input": { p: 0 } }}
          />
          {!sidebarSearch && (
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6rem",
                color: "grey.400",
                bgcolor: "grey.200",
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                fontFamily: "monospace",
                lineHeight: 1.6,
              }}
            >
              ⌘K
            </Typography>
          )}
        </Box>
      </Box>

      {/* Nav list */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "scroll",
          px: 1,
          py: 1,
          scrollbarGutter: "stable",
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "grey.300",
            borderRadius: "2px",
            "&:hover": { backgroundColor: "grey.400" },
          },
          scrollbarWidth: "thin",
          scrollbarColor: "#d1d5db transparent",
        }}
      >
        <List sx={{ p: 0 }}>
          {menuItems.map((item, idx) => (
            <React.Fragment key={item.sectionLabel || item.title || idx}>
              {renderMenuItem(item)}
            </React.Fragment>
          ))}
        </List>
      </Box>

      {/* Sidebar user section */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: 1, flexShrink: 0 }}>
        <Box
          onClick={() => handleNavigate("/profile")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 1.5,
            py: 1,
            borderRadius: 1.5,
            cursor: "pointer",
            "&:hover": { bgcolor: "grey.100" },
            transition: "background 0.15s",
          }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: "primary.main",
              fontSize: "0.8rem",
              flexShrink: 0,
            }}
          >
            {getInitials(user?.username)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: "grey.900", lineHeight: 1.3, fontSize: "0.8125rem" }}
              noWrap
            >
              {user?.username || "Admin"}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "grey.500", fontSize: "0.7rem", display: "block" }}
              noWrap
            >
              {user?.role || "Administrator"}
            </Typography>
          </Box>
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleProfileOpen(e);
              }}
              sx={{ color: "grey.400", "&:hover": { color: "grey.700" }, flexShrink: 0 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "background.default" }}>
      {/* ── AppBar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: "white",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }}>
          <IconButton
            color="primary"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page title + date */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="h5"
              component="div"
              sx={{ fontWeight: 700, color: "grey.900", fontSize: "1.25rem" }}
            >
              {activeTitle}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "grey.500", fontSize: "0.8rem", display: "block", mt: 0.25 }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {/* Notifications bell */}
            <Tooltip title="Notifications">
              <IconButton
                size="medium"
                onClick={handleNotifOpen}
                sx={{ color: "grey.600", "&:hover": { bgcolor: "grey.100" } }}
              >
                <Badge badgeContent={unreadCount || null} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Profile trigger */}
            <Box
              onClick={handleProfileOpen}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                cursor: "pointer",
                "&:hover": { bgcolor: "grey.100" },
                transition: "background 0.15s",
              }}
            >
              <Avatar
                sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: "0.85rem" }}
              >
                {getInitials(user?.username)}
              </Avatar>
              <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: "grey.900", lineHeight: 1.3, fontSize: "0.875rem" }}
                >
                  {user?.username || "Admin"}
                </Typography>
                <Typography variant="caption" sx={{ color: "grey.500", fontSize: "0.75rem" }}>
                  {user?.role || "Administrator"}
                </Typography>
              </Box>
              <ChevronDownIcon sx={{ fontSize: "1.1rem", color: "grey.400", display: { xs: "none", sm: "block" } }} />
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ── Profile Dropdown Menu ── */}
      <Menu
        anchorEl={profileAnchorEl}
        open={Boolean(profileAnchorEl)}
        onClose={handleProfileClose}
        PaperProps={{
          elevation: 4,
          sx: {
            width: 260,
            borderRadius: 2,
            mt: 1,
            overflow: "visible",
            border: "1px solid",
            borderColor: "divider",
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        {/* Dropdown header */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            px: 2.5,
            pt: 2,
            pb: 2,
            position: "relative",
            overflow: "hidden",
            "&::after": {
              content: '""',
              position: "absolute",
              top: -16,
              right: -16,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            },
          }}
        >
          <Avatar
            sx={{
              width: 44,
              height: 44,
              bgcolor: "rgba(255,255,255,0.2)",
              border: "2px solid rgba(255,255,255,0.4)",
              fontSize: "1rem",
              mb: 1,
            }}
          >
            {getInitials(user?.username)}
          </Avatar>
          <Typography sx={{ fontWeight: 700, color: "white", fontSize: "0.9375rem", lineHeight: 1.2 }}>
            {user?.username || "Admin"}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem", mt: 0.25 }}>
            {user?.email || ""}
          </Typography>
          <Chip
            label={user?.role || "Administrator"}
            size="small"
            sx={{
              mt: 0.75,
              height: 20,
              fontSize: "0.65rem",
              fontWeight: 600,
              bgcolor: "rgba(255,255,255,0.2)",
              color: "white",
              "& .MuiChip-label": { px: 1 },
            }}
          />
        </Box>

        <Box sx={{ py: 0.5 }}>
          <MenuItem
            onClick={() => { handleProfileClose(); navigate("/profile"); }}
            sx={{ py: 1.25, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5 }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "primary.50", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PersonIcon sx={{ fontSize: "1.1rem", color: "primary.main" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>My Profile</Typography>
              <Typography variant="caption" sx={{ color: "grey.500", fontSize: "0.75rem" }}>View & edit account details</Typography>
            </Box>
          </MenuItem>

          <MenuItem
            onClick={() => { handleProfileClose(); navigate("/settings"); }}
            sx={{ py: 1.25, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5 }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SettingsIcon sx={{ fontSize: "1.1rem", color: "grey.600" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>Settings</Typography>
              <Typography variant="caption" sx={{ color: "grey.500", fontSize: "0.75rem" }}>Preferences & appearance</Typography>
            </Box>
          </MenuItem>

          <MenuItem
            onClick={() => { handleProfileClose(); navigate("/profile?tab=security"); }}
            sx={{ py: 1.25, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5 }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LockIcon sx={{ fontSize: "1.1rem", color: "grey.600" }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>Change Password</Typography>
              <Typography variant="caption" sx={{ color: "grey.500", fontSize: "0.75rem" }}>Update your credentials</Typography>
            </Box>
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem
            onClick={() => { handleProfileClose(); }}
            sx={{ py: 1, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5 }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NotificationsIcon sx={{ fontSize: "1.1rem", color: "grey.600" }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.875rem", flex: 1 }}>Notifications</Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount}
                size="small"
                color="error"
                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
          </MenuItem>

          <MenuItem
            component="a"
            href="mailto:support@paperco.in"
            onClick={handleProfileClose}
            sx={{ py: 1, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5, textDecoration: "none" }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HelpIcon sx={{ fontSize: "1.1rem", color: "grey.600" }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.875rem" }}>Help & Support</Typography>
          </MenuItem>

          <Divider sx={{ my: 0.5 }} />

          <MenuItem
            onClick={handleLogoutClick}
            sx={{
              py: 1, px: 2, gap: 1.5, borderRadius: 1, mx: 0.5,
              color: "error.main",
              "&:hover": { bgcolor: "error.50" },
            }}
          >
            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "error.50", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogoutIcon sx={{ fontSize: "1.1rem", color: "error.main" }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem", color: "error.main" }}>Sign Out</Typography>
          </MenuItem>
        </Box>
      </Menu>

      {/* ── Notifications Popover ── */}
      <Popover
        open={Boolean(notifAnchorEl)}
        anchorEl={notifAnchorEl}
        onClose={handleNotifClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          elevation: 4,
          sx: { width: 360, borderRadius: 2, mt: 1, border: "1px solid", borderColor: "divider" },
        }}
      >
        {/* Notif header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.9375rem" }}>
              Notifications
            </Typography>
            <Typography variant="caption" sx={{ color: "grey.500" }}>
              {unreadCount} unread
            </Typography>
          </Box>
          <Typography
            variant="caption"
            onClick={handleMarkAllRead}
            sx={{
              color: "primary.main",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.8rem",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Mark all read
          </Typography>
        </Box>

        {/* Notif items */}
        <List disablePadding>
          {notifications.map((n, idx) => (
            <React.Fragment key={n.id}>
              <ListItem
                alignItems="flex-start"
                sx={{
                  px: 2.5,
                  py: 1.5,
                  bgcolor: n.unread ? "primary.50" : "transparent",
                  cursor: "pointer",
                  "&:hover": { bgcolor: n.unread ? "#e0e7ff" : "grey.50" },
                  transition: "background 0.15s",
                }}
                onClick={() =>
                  setNotifications((prev) =>
                    prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item))
                  )
                }
              >
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: n.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: n.iconColor,
                    }}
                  >
                    {n.icon}
                  </Box>
                </ListItemAvatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontWeight: n.unread ? 700 : 500, fontSize: "0.875rem" }}>
                      {n.title}
                    </Typography>
                    {n.unread && (
                      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0, mt: 0.5, ml: 1 }} />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: "grey.600", display: "block", lineHeight: 1.5 }}>
                    {n.message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "grey.400", fontSize: "0.7rem", mt: 0.25, display: "block" }}>
                    {n.time}
                  </Typography>
                </Box>
              </ListItem>
              {idx < notifications.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>

        <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography
            variant="body2"
            sx={{
              textAlign: "center",
              color: "primary.main",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.8125rem",
              py: 0.5,
              borderRadius: 1,
              "&:hover": { bgcolor: "primary.50" },
            }}
          >
            View all notifications
          </Typography>
        </Box>
      </Popover>

      {/* ── Sidebar Drawer ── */}
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* ── Main Content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }} />
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Breadcrumbs */}
          <Breadcrumbs
            separator="›"
            aria-label="breadcrumb"
            sx={{ color: "grey.600", fontSize: "0.875rem", mb: 2.5 }}
          >
            {breadcrumbTrail.map((crumb, index) => {
              const isLast = index === breadcrumbTrail.length - 1;
              return isLast || !crumb.path ? (
                <Typography
                  key={crumb.path || crumb.title}
                  color={isLast ? "grey.900" : "grey.500"}
                  fontWeight={isLast ? 600 : 400}
                  fontSize="0.875rem"
                >
                  {crumb.title}
                </Typography>
              ) : (
                <Typography
                  key={crumb.path}
                  component={Link}
                  to={crumb.path}
                  sx={{
                    fontSize: "0.875rem",
                    fontWeight: 400,
                    color: "grey.500",
                    textDecoration: "none",
                    "&:hover": { color: "primary.main", textDecoration: "underline" },
                  }}
                >
                  {crumb.title}
                </Typography>
              );
            })}
          </Breadcrumbs>

          <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>

      {/* ── Logout Confirmation ── */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sign Out"
        message="Are you sure you want to sign out of Paper ERP?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleLogoutConfirm}
        onClose={() => setLogoutConfirmOpen(false)}
      />
    </Box>
  );
};

export default Layout;

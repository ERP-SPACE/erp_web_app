import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Button,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  Palette as PaletteIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  CalendarToday as CalendarIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Payment as PaymentIcon,
  LocalShipping as ShippingIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";

// ─── Settings storage helper ───────────────────────────────────────────────────
const STORAGE_KEY = "erp_settings";

const defaultSettings = {
  darkMode: false,
  accentColor: "#6366f1",
  sidebarWidth: "260",
  language: "en-IN",
  dateFormat: "DD/MM/YYYY",
  currencySymbol: "₹",
  fiscalYearStart: "april",
  notifLowStock: true,
  notifPaymentDue: true,
  notifOrderStatus: false,
  notifNewInvoice: true,
  notifDelivery: false,
};

const loadSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

const saveSettings = (settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // Notify App.js (and any listener) that theme settings changed
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
};

// ─── Sidebar navigation groups ────────────────────────────────────────────────
const settingsNav = [
  {
    group: "General",
    items: [
      { id: "appearance", label: "Appearance", icon: <PaletteIcon fontSize="small" /> },
      { id: "language", label: "Language", icon: <LanguageIcon fontSize="small" /> },
      { id: "datetime", label: "Date & Currency", icon: <CalendarIcon fontSize="small" /> },
    ],
  },
  {
    group: "Notifications",
    items: [
      { id: "notifications", label: "Alert Preferences", icon: <NotificationsIcon fontSize="small" /> },
    ],
  },
  {
    group: "System",
    items: [
      { id: "data", label: "Data & Export", icon: <StorageIcon fontSize="small" /> },
      { id: "about", label: "About", icon: <InfoIcon fontSize="small" /> },
    ],
  },
];

// ─── Toggle Row Component ─────────────────────────────────────────────────────
const ToggleRow = ({ icon, iconBg, iconColor, label, description, checked, onChange }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      py: 1.5,
      borderBottom: "1px solid",
      borderColor: "grey.100",
      "&:last-child": { borderBottom: "none" },
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: iconBg || "grey.100",
        color: iconColor || "grey.600",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
        {label}
      </Typography>
      {description && (
        <Typography variant="caption" sx={{ color: "grey.500", lineHeight: 1.5 }}>
          {description}
        </Typography>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      size="small"
    />
  </Box>
);

// ─── Accent Color Picker ──────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Pink" },
];

// ─── Settings Page ────────────────────────────────────────────────────────────
const Settings = () => {
  const [activeSection, setActiveSection] = useState("appearance");
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Section renderers ───────────────────────────────────────────────────────

  const renderAppearance = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>Appearance</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>Customize how Paper ERP looks for you.</Typography>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
            Theme
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {[
              { label: "Light", icon: <LightModeIcon />, value: false },
              { label: "Dark", icon: <DarkModeIcon />, value: true },
            ].map((opt) => (
              <Box
                key={opt.label}
                onClick={() => updateSetting("darkMode", opt.value)}
                sx={{
                  flex: 1,
                  py: 2,
                  px: 2,
                  border: "2px solid",
                  borderColor: settings.darkMode === opt.value ? "primary.main" : "grey.200",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  cursor: "pointer",
                  bgcolor: settings.darkMode === opt.value ? "primary.50" : "transparent",
                  transition: "all 0.15s",
                  "&:hover": { borderColor: "primary.light" },
                }}
              >
                <Box sx={{ color: settings.darkMode === opt.value ? "primary.main" : "grey.500" }}>
                  {opt.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: settings.darkMode === opt.value ? "primary.main" : "grey.700" }}>
                  {opt.label}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" sx={{ color: "grey.400", mt: 1.5, display: "block" }}>
            Note: Dark mode will be applied on next app reload.
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
            Accent Color
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {ACCENT_COLORS.map((color) => (
              <Tooltip key={color.value} title={color.label} placement="top">
                <Box
                  onClick={() => updateSetting("accentColor", color.value)}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    bgcolor: color.value,
                    cursor: "pointer",
                    border: settings.accentColor === color.value ? `3px solid ${color.value}` : "3px solid transparent",
                    outline: settings.accentColor === color.value ? `2px solid white` : "none",
                    boxShadow: settings.accentColor === color.value ? `0 0 0 2px ${color.value}` : "none",
                    transition: "all 0.15s",
                    "&:hover": { transform: "scale(1.1)" },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
            Layout
          </Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Sidebar Width</InputLabel>
            <Select
              label="Sidebar Width"
              value={settings.sidebarWidth}
              onChange={(e) => updateSetting("sidebarWidth", e.target.value)}
            >
              <MenuItem value="220">220px — Compact</MenuItem>
              <MenuItem value="260">260px — Default</MenuItem>
              <MenuItem value="280">280px — Wide</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>
    </Box>
  );

  const renderLanguage = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>Language</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>Set your preferred language for the interface.</Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <FormControl size="small" fullWidth sx={{ maxWidth: 320 }}>
            <InputLabel>Display Language</InputLabel>
            <Select
              label="Display Language"
              value={settings.language}
              onChange={(e) => updateSetting("language", e.target.value)}
            >
              <MenuItem value="en-IN">English (India)</MenuItem>
              <MenuItem value="en-US">English (US)</MenuItem>
              <MenuItem value="hi">Hindi</MenuItem>
              <MenuItem value="gu">Gujarati</MenuItem>
              <MenuItem value="mr">Marathi</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: "grey.400", mt: 2, display: "block" }}>
            More language options coming soon.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const renderDateTime = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>Date & Currency</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>Configure how dates and currency are displayed across the app.</Typography>
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
                Date Format
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Date Format</InputLabel>
                <Select
                  label="Date Format"
                  value={settings.dateFormat}
                  onChange={(e) => updateSetting("dateFormat", e.target.value)}
                >
                  <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (31/03/2026)</MenuItem>
                  <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (03/31/2026)</MenuItem>
                  <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (2026-03-31)</MenuItem>
                  <MenuItem value="DD MMM YYYY">DD MMM YYYY (31 Mar 2026)</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
                Currency Symbol
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  label="Currency"
                  value={settings.currencySymbol}
                  onChange={(e) => updateSetting("currencySymbol", e.target.value)}
                >
                  <MenuItem value="₹">₹ — Indian Rupee (INR)</MenuItem>
                  <MenuItem value="$">$ — US Dollar (USD)</MenuItem>
                  <MenuItem value="€">€ — Euro (EUR)</MenuItem>
                  <MenuItem value="£">£ — British Pound (GBP)</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
                Fiscal Year Start
              </Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Starts From</InputLabel>
                <Select
                  label="Starts From"
                  value={settings.fiscalYearStart}
                  onChange={(e) => updateSetting("fiscalYearStart", e.target.value)}
                >
                  <MenuItem value="april">April (Indian FY)</MenuItem>
                  <MenuItem value="january">January (Calendar Year)</MenuItem>
                  <MenuItem value="july">July</MenuItem>
                  <MenuItem value="october">October</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderNotifications = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>Alert Preferences</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>Choose which in-app alerts you want to receive.</Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
            Inventory & Operations
          </Typography>
          <ToggleRow
            icon={<InventoryIcon fontSize="small" />}
            iconBg="rgba(245,158,11,0.1)"
            iconColor="#f59e0b"
            label="Low Stock Alert"
            description="Notify when stock falls below reorder level"
            checked={settings.notifLowStock}
            onChange={(v) => updateSetting("notifLowStock", v)}
          />
          <ToggleRow
            icon={<ShippingIcon fontSize="small" />}
            iconBg="rgba(59,130,246,0.1)"
            iconColor="#3b82f6"
            label="Order Status Changes"
            description="Notify when purchase or sales order status updates"
            checked={settings.notifOrderStatus}
            onChange={(v) => updateSetting("notifOrderStatus", v)}
          />
          <ToggleRow
            icon={<ReceiptIcon fontSize="small" />}
            iconBg="rgba(99,102,241,0.1)"
            iconColor="#6366f1"
            label="New Invoice Created"
            description="Alert when a new sales or purchase invoice is generated"
            checked={settings.notifNewInvoice}
            onChange={(v) => updateSetting("notifNewInvoice", v)}
          />
          <ToggleRow
            icon={<ShippingIcon fontSize="small" />}
            iconBg="rgba(16,185,129,0.1)"
            iconColor="#10b981"
            label="Delivery Dispatched"
            description="Notify when a delivery challan is issued"
            checked={settings.notifDelivery}
            onChange={(v) => updateSetting("notifDelivery", v)}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: "0.875rem", color: "grey.700" }}>
            Finance
          </Typography>
          <ToggleRow
            icon={<PaymentIcon fontSize="small" />}
            iconBg="rgba(239,68,68,0.1)"
            iconColor="#ef4444"
            label="Payment Due Reminder"
            description="Alert for overdue or upcoming customer payments"
            checked={settings.notifPaymentDue}
            onChange={(v) => updateSetting("notifPaymentDue", v)}
          />
        </CardContent>
      </Card>
    </Box>
  );

  const renderData = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>Data & Export</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>Manage your data exports and backup options.</Typography>
      <Grid container spacing={2.5}>
        {[
          { label: "Export to Excel", icon: <DownloadIcon />, desc: "Download all data as .xlsx", color: "#10b981" },
          { label: "Export to PDF", icon: <DownloadIcon />, desc: "Download reports as PDF", color: "#3b82f6" },
        ].map((item) => (
          <Grid item xs={12} sm={6} key={item.label}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: item.color, flexShrink: 0 }}>
                    {item.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{item.label}</Typography>
                    <Typography variant="caption" sx={{ color: "grey.500" }}>{item.desc}</Typography>
                    <Button variant="outlined" size="small" sx={{ mt: 1.5, display: "block", textTransform: "none" }} disabled>
                      Coming Soon
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderAbout = () => (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>About Paper ERP</Typography>
      <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>System information and version details.</Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "1.5rem", fontWeight: 700 }}>
              P
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {process.env.REACT_APP_COMPANY_NAME || "Paper ERP"}
              </Typography>
              <Typography variant="body2" sx={{ color: "grey.500" }}>Enterprise Edition</Typography>
            </Box>
            <Chip label="v1.0.0" size="small" sx={{ ml: "auto", bgcolor: "primary.50", color: "primary.dark", fontWeight: 600 }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          {[
            ["React Version", "18.x"],
            ["MUI Version", "5.x"],
            ["API Base URL", process.env.REACT_APP_API_URL || "http://localhost:5000/api"],
            ["Environment", process.env.NODE_ENV || "development"],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: "flex", py: 1, borderBottom: "1px solid", borderColor: "grey.100", "&:last-child": { borderBottom: "none" } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "grey.600", width: 180, flexShrink: 0 }}>{label}</Typography>
              <Typography variant="body2" sx={{ color: "grey.800", fontFamily: "monospace" }}>{value}</Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );

  const sectionMap = {
    appearance: renderAppearance,
    language: renderLanguage,
    datetime: renderDateTime,
    notifications: renderNotifications,
    data: renderData,
    about: renderAbout,
  };

  return (
    <Box>
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
          Settings saved automatically.
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* Settings sidebar */}
        <Card sx={{ width: 220, flexShrink: 0 }}>
          <CardContent sx={{ p: 1.5 }}>
            {settingsNav.map((group) => (
              <Box key={group.group} sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    px: 1.5,
                    pt: 1.5,
                    pb: 0.5,
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "grey.400",
                  }}
                >
                  {group.group}
                </Typography>
                <List disablePadding>
                  {group.items.map((item) => (
                    <ListItemButton
                      key={item.id}
                      selected={activeSection === item.id}
                      onClick={() => setActiveSection(item.id)}
                      sx={{
                        borderRadius: 1.5,
                        mb: 0.25,
                        minHeight: 40,
                        px: 1.5,
                        "&.Mui-selected": {
                          bgcolor: "primary.50",
                          color: "primary.main",
                          "& .MuiListItemIcon-root": { color: "primary.main" },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: "grey.500" }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: "0.8125rem", fontWeight: activeSection === item.id ? 600 : 500 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* Settings content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {(sectionMap[activeSection] || sectionMap.appearance)()}
        </Box>
      </Box>
    </Box>
  );
};

export default Settings;

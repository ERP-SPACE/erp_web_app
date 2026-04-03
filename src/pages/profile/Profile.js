import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  Avatar,
  Chip,
  Divider,
  Tab,
  Tabs,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  AccountCircle as AccountCircleIcon,
  Visibility,
  VisibilityOff,
  Edit as EditIcon,
  Shield as ShieldIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";

// ─── Tab Panel ────────────────────────────────────────────────────────────────
const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </Box>
);

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "grey.100" }}>
    <Box sx={{ color: "grey.400", display: "flex", alignItems: "center" }}>{icon}</Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" sx={{ color: "grey.500", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.7rem", fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, color: "grey.800", mt: 0.25 }}>
        {value || "—"}
      </Typography>
    </Box>
  </Box>
);

// ─── Profile Page ─────────────────────────────────────────────────────────────
const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "security" ? 1 : 0;
  const [tabValue, setTabValue] = useState(defaultTab);

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: profileDirty },
    reset: resetProfile,
  } = useForm({
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch,
  } = useForm();

  const newPassword = watch("newPassword");

  useEffect(() => {
    if (user) {
      resetProfile({
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user, resetProfile]);

  const onProfileSubmit = async (data) => {
    setProfileLoading(true);
    try {
      await updateProfile(data);
      resetProfile(data);
    } catch {
      // error is shown via snackbar in context
    } finally {
      setProfileLoading(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    setPasswordError("");
    if (data.newPassword !== data.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      resetPassword();
    } catch (err) {
      setPasswordError(err?.response?.data?.message || "Failed to change password. Check your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "AD";
    return name.split(" ").map((p) => p[0]?.toUpperCase()).join("").slice(0, 2);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <Box>
      {/* ── Profile Banner Card ── */}
      <Card sx={{ mb: 3, overflow: "visible" }}>
        {/* Banner */}
        <Box
          sx={{
            height: 120,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #3b82f6 100%)",
            borderRadius: "12px 12px 0 0",
            position: "relative",
          }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, mt: -5, mb: 2 }}>
            <Box sx={{ position: "relative" }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "primary.main",
                  border: "4px solid white",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {getInitials(user?.username)}
              </Avatar>
              <Box
                sx={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  border: "2px solid white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <EditIcon sx={{ fontSize: "0.75rem", color: "white" }} />
              </Box>
            </Box>
            <Box sx={{ flex: 1, pb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "grey.900", fontSize: "1.375rem" }}>
                {user?.username || "Admin User"}
              </Typography>
              <Typography variant="body2" sx={{ color: "grey.500", mt: 0.25 }}>
                {user?.email || ""}
              </Typography>
            </Box>
            <Box sx={{ pb: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                label={user?.role || "Administrator"}
                size="small"
                sx={{ bgcolor: "primary.50", color: "primary.dark", fontWeight: 600, fontSize: "0.75rem" }}
              />
              <Chip
                label="Active"
                size="small"
                sx={{ bgcolor: "success.50", color: "success.dark", fontWeight: 600, fontSize: "0.75rem" }}
              />
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              "& .MuiTab-root": { fontWeight: 500, fontSize: "0.875rem", textTransform: "none", minHeight: 44 },
            }}
          >
            <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Personal Info" />
            <Tab icon={<LockIcon fontSize="small" />} iconPosition="start" label="Security" />
            <Tab icon={<ShieldIcon fontSize="small" />} iconPosition="start" label="Account Details" />
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Tab 0: Personal Info ── */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>
                  Edit Personal Information
                </Typography>
                <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>
                  Update your name, email address, and contact details.
                </Typography>
                <Box component="form" onSubmit={handleProfileSubmit(onProfileSubmit)}>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                      <TextField
                        label="Full Name / Username"
                        fullWidth
                        {...registerProfile("username", { required: "Name is required" })}
                        error={!!profileErrors.username}
                        helperText={profileErrors.username?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <AccountCircleIcon sx={{ color: "grey.400", fontSize: "1.1rem" }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Email Address"
                        type="email"
                        fullWidth
                        {...registerProfile("email", {
                          required: "Email is required",
                          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                        })}
                        error={!!profileErrors.email}
                        helperText={profileErrors.email?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon sx={{ color: "grey.400", fontSize: "1.1rem" }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Phone Number"
                        fullWidth
                        {...registerProfile("phone")}
                        placeholder="+91 98765 43210"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon sx={{ color: "grey.400", fontSize: "1.1rem" }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 3, display: "flex", gap: 1.5 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={profileLoading || !profileDirty}
                      startIcon={profileLoading ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      {profileLoading ? "Saving…" : "Save Changes"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => resetProfile()}
                      disabled={profileLoading || !profileDirty}
                    >
                      Discard
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: "1rem" }}>
                  Quick Info
                </Typography>
                <InfoRow icon={<AccountCircleIcon fontSize="small" />} label="Username" value={user?.username} />
                <InfoRow icon={<EmailIcon fontSize="small" />} label="Email" value={user?.email} />
                <InfoRow icon={<PhoneIcon fontSize="small" />} label="Phone" value={user?.phone} />
                <InfoRow icon={<BusinessIcon fontSize="small" />} label="Company" value={user?.company || process.env.REACT_APP_COMPANY_NAME || "Paper Co."} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ── Tab 1: Security ── */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem" }}>
                  Change Password
                </Typography>
                <Typography variant="body2" sx={{ color: "grey.500", mb: 3 }}>
                  Choose a strong password with at least 8 characters.
                </Typography>

                {passwordError && (
                  <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setPasswordError("")}>
                    {passwordError}
                  </Alert>
                )}

                <Box component="form" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <TextField
                      label="Current Password"
                      type={showCurrentPw ? "text" : "password"}
                      fullWidth
                      {...registerPassword("currentPassword", { required: "Current password is required" })}
                      error={!!passwordErrors.currentPassword}
                      helperText={passwordErrors.currentPassword?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                              {showCurrentPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Divider />
                    <TextField
                      label="New Password"
                      type={showNewPw ? "text" : "password"}
                      fullWidth
                      {...registerPassword("newPassword", {
                        required: "New password is required",
                        minLength: { value: 8, message: "Password must be at least 8 characters" },
                      })}
                      error={!!passwordErrors.newPassword}
                      helperText={passwordErrors.newPassword?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowNewPw(!showNewPw)}>
                              {showNewPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      label="Confirm New Password"
                      type={showConfirmPw ? "text" : "password"}
                      fullWidth
                      {...registerPassword("confirmPassword", {
                        required: "Please confirm your new password",
                        validate: (v) => v === newPassword || "Passwords do not match",
                      })}
                      error={!!passwordErrors.confirmPassword}
                      helperText={passwordErrors.confirmPassword?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                              {showConfirmPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                  <Button
                    type="submit"
                    variant="contained"
                    color="inherit"
                    fullWidth
                    sx={{ mt: 3, bgcolor: "grey.800", color: "white", "&:hover": { bgcolor: "grey.900" } }}
                    disabled={passwordLoading}
                    startIcon={passwordLoading ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
                  >
                    {passwordLoading ? "Updating…" : "Update Password"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: "1rem" }}>
                  Password Tips
                </Typography>
                {[
                  "At least 8 characters long",
                  "Mix uppercase and lowercase letters",
                  "Include numbers and special characters",
                  "Don't reuse a recent password",
                  "Never share your password with others",
                ].map((tip, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 1.5, mb: 1.5, alignItems: "flex-start" }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        bgcolor: "primary.50",
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    >
                      {i + 1}
                    </Box>
                    <Typography variant="body2" sx={{ color: "grey.600", lineHeight: 1.6 }}>
                      {tip}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ── Tab 2: Account Details ── */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: "1rem" }}>
                  Account Information
                </Typography>
                <InfoRow icon={<ShieldIcon fontSize="small" />} label="Role" value={user?.role || "Administrator"} />
                <InfoRow icon={<BusinessIcon fontSize="small" />} label="Company" value={user?.company || process.env.REACT_APP_COMPANY_NAME || "Paper Co."} />
                <InfoRow icon={<CalendarIcon fontSize="small" />} label="Member Since" value={formatDate(user?.createdAt)} />
                <InfoRow icon={<AccessTimeIcon fontSize="small" />} label="Last Login" value={user?.lastLogin ? formatDate(user.lastLogin) : "Today"} />
                <InfoRow icon={<AccountCircleIcon fontSize="small" />} label="User ID" value={user?.id || user?._id || "—"} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ border: "1px solid", borderColor: "error.200", bgcolor: "error.50" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: "1rem", color: "error.main" }}>
                  Danger Zone
                </Typography>
                <Typography variant="body2" sx={{ color: "error.600", mb: 2.5 }}>
                  These actions are irreversible. Please proceed with caution.
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled
                  sx={{ textTransform: "none" }}
                >
                  Request Account Deletion
                </Button>
                <Typography variant="caption" sx={{ display: "block", color: "grey.500", mt: 1 }}>
                  Contact your system administrator to delete this account.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default Profile;

import React from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Link as MuiLink,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useApp } from "../../contexts/AppContext";

const Register = () => {
  const { register: registerUser } = useAuth();
  const { setLoading, showNotification } = useApp();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      pincode: "",
      state: "",
      country: "",
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        address: {
          line1: data.addressLine1,
          line2: data.addressLine2,
          city: data.city,
          pincode: data.pincode,
        },
        state: data.state,
        country: data.country,
      });
      navigate("/", { replace: true });
    } catch (error) {
      showNotification(error.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 480,
          width: "100%",
          p: 4,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "grey.200",
          boxShadow:
            "0px 10px 30px rgba(99, 102, 241, 0.08), 0px 6px 16px rgba(0,0,0,0.04)",
        }}
      >
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Create your account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Register your account to access the dashboard.
        </Typography>

        <Stack spacing={2.5} component="form" onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="username"
            control={control}
            rules={{ required: "Username is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Username"
                error={!!errors.username}
                helperText={errors.username?.message}
              />
            )}
          />

          <Controller
            name="email"
            control={control}
            rules={{
              required: "Email is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email",
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Email"
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />

          <Controller
            name="password"
            control={control}
            rules={{ required: "Password is required", minLength: 8 }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                type="password"
                label="Password"
                error={!!errors.password}
                helperText={
                  errors.password?.message ||
                  (errors.password?.type === "minLength" &&
                    "Minimum 8 characters")
                }
              />
            )}
          />

          <Controller
            name="addressLine1"
            control={control}
            rules={{ required: "Address line 1 is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Address Line 1"
                error={!!errors.addressLine1}
                helperText={errors.addressLine1?.message}
              />
            )}
          />

          <Controller
            name="addressLine2"
            control={control}
            render={({ field }) => (
              <TextField {...field} fullWidth label="Address Line 2 (optional)" />
            )}
          />

          <Controller
            name="city"
            control={control}
            rules={{ required: "City is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="City"
                error={!!errors.city}
                helperText={errors.city?.message}
              />
            )}
          />

          <Controller
            name="pincode"
            control={control}
            rules={{ required: "Pincode is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Pincode"
                error={!!errors.pincode}
                helperText={errors.pincode?.message}
              />
            )}
          />

          <Controller
            name="state"
            control={control}
            rules={{ required: "State is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="State"
                error={!!errors.state}
                helperText={errors.state?.message}
              />
            )}
          />

          <Controller
            name="country"
            control={control}
            rules={{ required: "Country is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Country"
                error={!!errors.country}
                helperText={errors.country?.message}
              />
            )}
          />

          <Button type="submit" variant="contained" size="large" fullWidth>
            Register & Sign In
          </Button>
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 3, textAlign: "center" }}
        >
          Already have an account?{" "}
          <MuiLink component={Link} to="/login" underline="hover">
            Sign in
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
};

export default Register;


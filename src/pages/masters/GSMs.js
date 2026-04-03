import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import {
  Add,
  Delete,
  Edit,
  Refresh,
  Save,
  Cancel,
  ToggleOn,
  ToggleOff,
} from "@mui/icons-material";
import masterService from "../../services/masterService";

const initialForm = { name: "", value: "", active: true };

const GSMs = () => {
  const [form, setForm] = useState(initialForm);
  const [gsms, setGSMs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const orderedGSMs = useMemo(
    () => [...gsms].sort((a, b) => Number(a.value) - Number(b.value)),
    [gsms]
  );

  const fetchGSMs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await masterService.getGSMs();
      setGSMs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load GSMs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGSMs();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = form.name.trim();
    const valueNum = Number(form.value);

    if (!trimmedName) {
      setError("GSM name is required");
      return;
    }
    if (Number.isNaN(valueNum) || valueNum <= 0) {
      setError("GSM value must be a positive number");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: trimmedName,
        value: valueNum,
        active: form.active,
      };

      if (editingId) {
        await masterService.updateGSM(editingId, payload);
      } else {
        await masterService.createGSM(payload);
      }

      setForm(initialForm);
      setEditingId(null);
      await fetchGSMs();
    } catch (err) {
      setError(err.message || "Failed to save GSM");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (gsm) => {
    setEditingId(gsm._id);
    setForm({
      name: gsm.name || "",
      value: gsm.value || "",
      active: typeof gsm.active === "boolean" ? gsm.active : true,
    });
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setError("");
  };

  const handleToggleStatus = async (gsm) => {
    setSaving(true);
    setError("");
    try {
      await masterService.toggleGSMStatus(gsm._id);
      await fetchGSMs();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (gsm) => {
    const confirmed = window.confirm(
      `Delete ${gsm.name || gsm.value + " GSM"}? This cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await masterService.deleteGSM(gsm._id);
      await fetchGSMs();
    } catch (err) {
      setError(err.message || "Failed to delete GSM");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title={editingId ? "Edit GSM" : "Add GSM"}
              subheader="Create and manage GSM values"
              action={
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchGSMs} disabled={loading || saving}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              }
            />
            <Divider />
            {loading && <LinearProgress />}
            <CardContent>
              {error && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  onClose={() => setError("")}
                >
                  {error}
                </Alert>
              )}
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  label="Name"
                  fullWidth
                  margin="normal"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., 55 GSM"
                  required
                />
                <TextField
                  label="Value"
                  fullWidth
                  margin="normal"
                  type="number"
                  value={form.value}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, value: e.target.value }))
                  }
                  placeholder="Numeric GSM value"
                  required
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.active}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          active: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Active"
                  sx={{ mt: 1 }}
                />
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <LoadingButton
                    type="submit"
                    variant="contained"
                    loading={saving}
                    startIcon={editingId ? <Save /> : <Add />}
                    fullWidth
                  >
                    {editingId ? "Update GSM" : "Add GSM"}
                  </LoadingButton>
                  {editingId && (
                    <LoadingButton
                      variant="outlined"
                      color="inherit"
                      onClick={handleCancelEdit}
                      startIcon={<Cancel />}
                      loading={saving}
                    >
                      Cancel
                    </LoadingButton>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="GSM List"
              subheader="Existing GSM values in the system"
              action={
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchGSMs} disabled={loading || saving}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              }
            />
            <Divider />
            {(loading || saving) && <LinearProgress />}
            <CardContent sx={{ pt: 0 }}>
              {orderedGSMs.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No GSM values found. Add one using the form.
                </Typography>
              ) : (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderedGSMs.map((gsm) => (
                      <TableRow key={gsm._id}>
                        <TableCell>{gsm.name}</TableCell>
                        <TableCell>{gsm.value}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={gsm.active ? "Active" : "Inactive"}
                            color={gsm.active ? "success" : "default"}
                            variant={gsm.active ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(gsm)}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={gsm.active ? "Deactivate" : "Activate"}
                            >
                              <IconButton
                                size="small"
                                color={gsm.active ? "success" : "error"}
                                onClick={() => handleToggleStatus(gsm)}
                              >
                                {gsm.active ? (
                                  <ToggleOn fontSize="small" />
                                ) : (
                                  <ToggleOff fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(gsm)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GSMs;


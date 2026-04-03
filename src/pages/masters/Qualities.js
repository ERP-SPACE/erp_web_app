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
import { Add, Cancel, Delete, Edit, Refresh, Save, ToggleOff, ToggleOn } from "@mui/icons-material";
import masterService from "../../services/masterService";

const initialForm = { name: "", active: true };

const Qualities = () => {
  const [form, setForm] = useState(initialForm);
  const [qualities, setQualities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const orderedQualities = useMemo(
    () =>
      [...qualities].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      ),
    [qualities]
  );

  const fetchQualities = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await masterService.getQualities();
      setQualities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load qualities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualities();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setError("Quality name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = { name: trimmedName, active: form.active };

      if (editingId) {
        await masterService.updateQuality(editingId, payload);
      } else {
        await masterService.createQuality(payload);
      }

      setForm(initialForm);
      setEditingId(null);
      await fetchQualities();
    } catch (err) {
      setError(err.message || "Failed to save quality");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (quality) => {
    setEditingId(quality._id);
    setForm({
      name: quality.name || "",
      active: typeof quality.active === "boolean" ? quality.active : true,
    });
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setError("");
  };

  const handleToggleStatus = async (quality) => {
    setSaving(true);
    setError("");
    try {
      await masterService.toggleQualityStatus(quality._id);
      await fetchQualities();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quality) => {
    const confirmed = window.confirm(
      `Delete quality "${quality.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await masterService.deleteQuality(quality._id);
      await fetchQualities();
    } catch (err) {
      setError(err.message || "Failed to delete quality");
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
              title={editingId ? "Edit Quality" : "Add Quality"}
              subheader="Create and manage quality values"
              action={
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchQualities} disabled={loading || saving}>
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
                  placeholder="e.g., Premium"
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
                    {editingId ? "Update Quality" : "Add Quality"}
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
              title="Quality List"
              subheader="Existing qualities in the system"
              action={
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchQualities} disabled={loading || saving}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              }
            />
            <Divider />
            {(loading || saving) && <LinearProgress />}
            <CardContent sx={{ pt: 0 }}>
              {orderedQualities.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  No qualities found. Add one using the form.
                </Typography>
              ) : (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderedQualities.map((quality) => (
                      <TableRow key={quality._id}>
                        <TableCell>{quality.name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={quality.active ? "Active" : "Inactive"}
                            color={quality.active ? "success" : "default"}
                            variant={quality.active ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(quality)}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={quality.active ? "Deactivate" : "Activate"}
                            >
                              <IconButton
                                size="small"
                                color={quality.active ? "success" : "error"}
                                onClick={() => handleToggleStatus(quality)}
                              >
                                {quality.active ? (
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
                                onClick={() => handleDelete(quality)}
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

export default Qualities;


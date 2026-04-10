import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Checkbox,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { CheckCircle as PostIcon } from "@mui/icons-material";
import { Controller, useForm } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import purchaseService from "../../services/purchaseService";
import inventoryService from "../../services/inventoryService";
import { formatCurrency, formatDate, getStatusColor } from "../../utils/formatters";

const normalizeId = (value) => {
  if (value && typeof value === "object") {
    return value._id || value.id || value.value || "";
  }
  return value || "";
};

const toNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

const PurchaseReturns = () => {
  const { showNotification, setLoading } = useApp();
  const [returns, setReturns] = useState([]);
  const [postedInvoices, setPostedInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [eligibleRolls, setEligibleRolls] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);

  const invoiceOptions = useMemo(
    () =>
      (postedInvoices || []).map((pi) => ({
        value: pi._id,
        label: `${pi.piNumber} - ${pi.supplierName}`,
      })),
    [postedInvoices]
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      purchaseInvoiceId: "",
      prDate: new Date(),
      reason: "",
      selectedRollIds: [],
    },
  });

  const watchPurchaseInvoiceId = watch("purchaseInvoiceId");
  const watchSelectedRollIds = watch("selectedRollIds");

  const fetchPurchaseReturns = async () => {
    setLoading(true);
    try {
      const res = await purchaseService.getPurchaseReturns();
      setReturns(res.data);
    } catch (e) {
      showNotification("Failed to fetch purchase returns", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPostedPurchaseInvoices = async () => {
    try {
      const res = await purchaseService.getPurchaseInvoices({ status: "Posted" });
      setPostedInvoices(res.data || []);
    } catch (e) {
      setPostedInvoices([]);
    }
  };

  const loadInvoiceDetailsAndRolls = async (piId) => {
    try {
      const invRes = await purchaseService.getPurchaseInvoice(piId);
      const pi = invRes.data || invRes;
      setSelectedInvoice(pi);

      // Eligible rolls are the ones created from this PI and still in internal stock.
      // Fetch Mapped and Unmapped separately (API filter currently supports single status value).
      const [mapped, unmapped] = await Promise.all([
        inventoryService.getRolls({ purchaseInvoiceId: piId, status: "Mapped", limit: 500 }),
        inventoryService.getRolls({ purchaseInvoiceId: piId, status: "Unmapped", limit: 500 }),
      ]);

      const merged = [...(mapped.rolls || []), ...(unmapped.rolls || [])];
      merged.sort((a, b) => String(a.rollNumber || "").localeCompare(String(b.rollNumber || "")));
      setEligibleRolls(merged);
      setValue("selectedRollIds", []);
    } catch (e) {
      setSelectedInvoice(null);
      setEligibleRolls([]);
      showNotification("Failed to load purchase invoice / rolls", "error");
    }
  };

  useEffect(() => {
    fetchPurchaseReturns();
    fetchPostedPurchaseInvoices();
  }, []);

  useEffect(() => {
    const id = normalizeId(watchPurchaseInvoiceId);
    if (id) loadInvoiceDetailsAndRolls(id);
  }, [watchPurchaseInvoiceId]);

  const totals = useMemo(() => {
    const idSet = new Set((watchSelectedRollIds || []).map(String));
    let subtotal = 0;
    let taxAmount = 0;

    // The exact tax reversal is enforced in the API. UI shows an estimate based on roll landed cost as a proxy if rate is unknown.
    // We still show totals based on PI gstMode and line tax rate is not reliably derivable in UI without API matching.
    // So: show inventory-value estimate for selection feedback; server is source of truth.
    (eligibleRolls || []).forEach((r) => {
      const rid = normalizeId(r._id);
      if (!rid || !idSet.has(String(rid))) return;
      subtotal += toNumber(r.landedCostPerRoll || (toNumber(r.landedCostPerMeter) * toNumber(r.currentLengthMeters)));
    });

    const gstMode = selectedInvoice?.gstMode || "intra";
    const effectiveTaxRate = gstMode === "inter" ? 0.18 : 0.18;
    taxAmount = subtotal * effectiveTaxRate;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [eligibleRolls, watchSelectedRollIds, selectedInvoice]);

  const handleAdd = () => {
    setSelectedReturn(null);
    setSelectedInvoice(null);
    setEligibleRolls([]);
    reset({
      purchaseInvoiceId: "",
      prDate: new Date(),
      reason: "",
      selectedRollIds: [],
    });
    setOpenDialog(true);
  };

  const handleView = (row) => {
    setSelectedReturn(row);
    reset({
      purchaseInvoiceId: normalizeId(row.purchaseInvoiceId),
      prDate: row.prDate ? new Date(row.prDate) : new Date(),
      reason: row.reason || "",
      selectedRollIds: (row.lines || []).map((l) => normalizeId(l.rollId)).filter(Boolean),
    });
    setOpenDialog(true);
    const piId = normalizeId(row.purchaseInvoiceId);
    if (piId) loadInvoiceDetailsAndRolls(piId);
  };

  const handlePost = (row) => {
    if (row.status !== "Draft") {
      showNotification("Return is already posted", "warning");
      return;
    }
    setSelectedReturn(row);
    setConfirmPost(true);
  };

  const confirmPostReturn = async () => {
    try {
      const id = normalizeId(selectedReturn?._id);
      if (!id) {
        showNotification("Missing return id. Cannot post.", "error");
        setConfirmPost(false);
        return;
      }
      await purchaseService.postPurchaseReturn(id);
      showNotification("Purchase return posted successfully", "success");
      fetchPurchaseReturns();
    } catch (e) {
      showNotification("Failed to post purchase return", "error");
    } finally {
      setConfirmPost(false);
    }
  };

  const toggleRoll = (rollId) => {
    const current = (watchSelectedRollIds || []).map(String);
    const idStr = String(rollId);
    const exists = current.includes(idStr);
    const next = exists ? current.filter((x) => x !== idStr) : [...current, idStr];
    setValue("selectedRollIds", next);
  };

  const onSubmit = async (data) => {
    try {
      if (selectedReturn) {
        showNotification("Editing returns is not supported", "warning");
        return;
      }
      const purchaseInvoiceId = normalizeId(data.purchaseInvoiceId);
      if (!purchaseInvoiceId) {
        showNotification("Select a posted purchase invoice", "error");
        return;
      }
      if (!data.selectedRollIds?.length) {
        showNotification("Select at least one roll to return", "error");
        return;
      }

      await purchaseService.createPurchaseReturn({
        purchaseInvoiceId,
        rollIds: data.selectedRollIds,
        prDate: data.prDate,
        reason: data.reason,
      });

      showNotification("Purchase return created successfully", "success");
      setOpenDialog(false);
      fetchPurchaseReturns();
    } catch (e) {
      showNotification(e?.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "prNumber", headerName: "PR Number" },
    { field: "piNumber", headerName: "PI Number" },
    { field: "supplierName", headerName: "Supplier", flex: 1 },
    {
      field: "prDate",
      headerName: "Date",
      renderCell: (params) => formatDate(params.value),
    },
    {
      field: "status",
      headerName: "Status",
      renderCell: (params) => (
        <Chip label={params.value} color={getStatusColor(params.value)} size="small" />
      ),
    },
    {
      field: "total",
      headerName: "Return Amount",
      renderCell: (params) => formatCurrency(params.value || 0),
    },
  ];

  const customActions = [
    {
      icon: <PostIcon />,
      label: "Post Return",
      onClick: handlePost,
      show: (row) => row.status === "Draft",
    },
  ];

  return (
    <Box>
      <DataTable
        title="Purchase Returns"
        columns={columns}
        rows={returns}
        onAdd={handleAdd}
        onView={handleView}
        customActions={customActions}
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedReturn ? `Purchase Return: ${selectedReturn.prNumber}` : "Create Purchase Return"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="purchaseInvoiceId"
                  control={control}
                  rules={{ required: "Purchase invoice is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        invoiceOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      disabled={!!selectedReturn}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Posted Purchase Invoice"
                          error={!!errors.purchaseInvoiceId}
                          helperText={errors.purchaseInvoiceId?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Controller
                  name="prDate"
                  control={control}
                  rules={{ required: "Return date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Return Date"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.prDate,
                          helperText: errors.prDate?.message,
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => <TextField {...field} fullWidth label="Reason" />}
                />
              </Grid>
            </Grid>

            {selectedInvoice && (
              <Alert severity="info" sx={{ mb: 2 }}>
                PI: {selectedInvoice.piNumber} | Supplier: {selectedInvoice.supplierName} | GST:{" "}
                {selectedInvoice.gstMode || "intra"} | Rolls eligible: {eligibleRolls.length}
              </Alert>
            )}

            {selectedInvoice && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Select Rolls to Return (from this PI)
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                {eligibleRolls.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No eligible rolls found (already returned/dispatched/scrap or not created from this PI).
                  </Typography>
                )}

                {eligibleRolls.map((r, idx) => {
                  const rollId = normalizeId(r._id);
                  const checked = (watchSelectedRollIds || []).map(String).includes(String(rollId));
                  const meters = toNumber(r.currentLengthMeters ?? r.originalLengthMeters);
                  const estValue = toNumber(r.landedCostPerRoll) || toNumber(r.landedCostPerMeter) * meters;
                  return (
                    <Box
                      key={`${rollId || idx}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 0.75,
                        borderBottom: idx === eligibleRolls.length - 1 ? "none" : "1px solid",
                        borderColor: "divider",
                        gap: 2,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={() => toggleRoll(rollId)}
                            disabled={!rollId || !!selectedReturn}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {r.rollNumber} ({r.status})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.qualityName || ""} {r.gsm || ""} GSM | {meters} m | Est value:{" "}
                              {formatCurrency(estValue)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(estValue)}
                      </Typography>
                    </Box>
                  );
                })}
              </Paper>
            )}

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} md={8} />
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Est. Subtotal: {formatCurrency(totals.subtotal)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Est. Tax: {formatCurrency(totals.taxAmount)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6">Est. Total: {formatCurrency(totals.total)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Server will compute exact reversal from PI line rates & tax.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Close</Button>
            {!selectedReturn && (
              <Button type="submit" variant="contained">
                Create
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        onConfirm={confirmPostReturn}
        title="Post Purchase Return"
        message="Are you sure you want to post this purchase return? This will update roll statuses and create accounting entries."
        confirmColor="primary"
      />
    </Box>
  );
};

export default PurchaseReturns;


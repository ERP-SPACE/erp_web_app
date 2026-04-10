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
import salesService from "../../services/salesService";
import { formatCurrency, formatDate, getStatusColor } from "../../utils/formatters";
import {
  toNumber,
  computeInvoiceRollLineAmounts,
  deriveRatePerRollFromTaxInclusiveLineTotal,
} from "../../utils/salesLinePricing";

const normalizeId = (value) => {
  if (value && typeof value === "object") {
    return value._id || value.id || value.value || "";
  }
  return value || "";
};

const computeSiLineAmounts = (siLine) => {
  let rate = toNumber(siLine?.ratePerRoll);
  if (rate <= 0) rate = deriveRatePerRollFromTaxInclusiveLineTotal(siLine);
  return computeInvoiceRollLineAmounts({
    ...siLine,
    qtyRolls: 1,
    ratePerRoll: rate,
  });
};

const SalesReturns = () => {
  const { showNotification, setLoading } = useApp();
  const [returns, setReturns] = useState([]);
  const [postedInvoices, setPostedInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);

  const invoiceOptions = useMemo(
    () =>
      (postedInvoices || []).map((si) => ({
        value: normalizeId(si),
        label: `${si.siNumber} - ${si.customerName}`,
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
      salesInvoiceId: "",
      srDate: new Date(),
      reason: "",
      selectedRollIds: [],
    },
  });

  const watchSalesInvoiceId = watch("salesInvoiceId");
  const watchSelectedRollIds = watch("selectedRollIds");

  const fetchSalesReturns = async () => {
    setLoading(true);
    try {
      const res = await salesService.getSalesReturns();
      setReturns(res.data);
    } catch (e) {
      showNotification("Failed to fetch sales returns", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPostedSalesInvoices = async () => {
    try {
      const res = await salesService.getSalesInvoices({ status: "Posted" });
      setPostedInvoices(res.data || []);
    } catch (e) {
      setPostedInvoices([]);
    }
  };

  const loadInvoiceDetails = async (siId) => {
    try {
      const res = await salesService.getSalesInvoice(siId);
      const si = res.data;
      setSelectedInvoice(si);
      setValue("selectedRollIds", []);
    } catch (e) {
      setSelectedInvoice(null);
      showNotification("Failed to load sales invoice", "error");
    }
  };

  useEffect(() => {
    fetchSalesReturns();
    fetchPostedSalesInvoices();
  }, []);

  useEffect(() => {
    const id = normalizeId(watchSalesInvoiceId);
    if (id) loadInvoiceDetails(id);
  }, [watchSalesInvoiceId]);

  const totals = useMemo(() => {
    const idSet = new Set((watchSelectedRollIds || []).map(String));
    let subtotal = 0;
    let discountTotal = 0;
    let taxAmount = 0;
    let total = 0;

    (selectedInvoice?.lines || []).forEach((l) => {
      const rollId = normalizeId(l.rollId);
      if (!rollId || !idSet.has(String(rollId))) return;

      const amounts = computeSiLineAmounts(l);
      subtotal += amounts.lineSubtotal;
      discountTotal += amounts.lineDiscount;
      taxAmount += amounts.lineTax;
      total += amounts.lineTotal;
    });

    return { subtotal, discountTotal, taxAmount, total };
  }, [selectedInvoice, watchSelectedRollIds]);

  const handleAdd = () => {
    setSelectedReturn(null);
    setSelectedInvoice(null);
    reset({
      salesInvoiceId: "",
      srDate: new Date(),
      reason: "",
      selectedRollIds: [],
    });
    setOpenDialog(true);
  };

  const handleView = (row) => {
    setSelectedReturn(row);
    reset({
      salesInvoiceId: normalizeId(row.salesInvoiceId),
      srDate: row.srDate ? new Date(row.srDate) : new Date(),
      reason: row.reason || "",
      selectedRollIds: (row.lines || []).map((l) => normalizeId(l.rollId)).filter(Boolean),
    });
    setOpenDialog(true);
    // Load full SI for line display if possible
    const siId = normalizeId(row.salesInvoiceId);
    if (siId) loadInvoiceDetails(siId);
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
      await salesService.postSalesReturn(id);
      showNotification("Sales return posted successfully", "success");
      fetchSalesReturns();
    } catch (e) {
      showNotification("Failed to post sales return", "error");
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
      const salesInvoiceId = normalizeId(data.salesInvoiceId);
      if (!salesInvoiceId) {
        showNotification("Select a posted sales invoice", "error");
        return;
      }
      if (!data.selectedRollIds?.length) {
        showNotification("Select at least one roll to return", "error");
        return;
      }

      await salesService.createSalesReturn({
        salesInvoiceId,
        rollIds: data.selectedRollIds,
        srDate: data.srDate,
        reason: data.reason,
      });

      showNotification("Sales return created successfully", "success");
      setOpenDialog(false);
      fetchSalesReturns();
    } catch (e) {
      showNotification(e?.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "srNumber", headerName: "SR Number" },
    { field: "siNumber", headerName: "SI Number" },
    { field: "customerName", headerName: "Customer", flex: 1 },
    {
      field: "srDate",
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
        title="Sales Returns"
        columns={columns}
        rows={returns}
        onAdd={handleAdd}
        onView={handleView}
        customActions={customActions}
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedReturn ? `Sales Return: ${selectedReturn.srNumber}` : "Create Sales Return"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="salesInvoiceId"
                  control={control}
                  rules={{ required: "Sales invoice is required" }}
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
                          label="Select Posted Sales Invoice"
                          error={!!errors.salesInvoiceId}
                          helperText={errors.salesInvoiceId?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Controller
                  name="srDate"
                  control={control}
                  rules={{ required: "Return date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Return Date"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.srDate,
                          helperText: errors.srDate?.message,
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
                SI: {selectedInvoice.siNumber} | Customer: {selectedInvoice.customerName} | Rolls:{" "}
                {(selectedInvoice.lines || []).length}
              </Alert>
            )}

            {selectedInvoice && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Select Rolls to Return
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                {(selectedInvoice.lines || []).map((l, idx) => {
                  const rollId = normalizeId(l.rollId);
                  const checked = (watchSelectedRollIds || []).map(String).includes(String(rollId));
                  const amounts = computeSiLineAmounts(l);

                  return (
                    <Box
                      key={`${rollId || idx}`}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 0.75,
                        borderBottom: idx === (selectedInvoice.lines || []).length - 1 ? "none" : "1px solid",
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
                              {l.rollNumber} ({l.qualityName || ""} {l.gsm || ""} GSM)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Disc: {toNumber(l.discountLine)}% | Tax:{" "}
                              {toNumber(l.taxRate)}%
                            </Typography>
                          </Box>
                        }
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(amounts.lineTotal)}
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
                    Subtotal: {formatCurrency(totals.subtotal)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Discount: {formatCurrency(totals.discountTotal)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Tax: {formatCurrency(totals.taxAmount)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6">Total: {formatCurrency(totals.total)}</Typography>
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
        title="Post Sales Return"
        message="Are you sure you want to post this sales return? This will update roll statuses and create accounting entries."
        confirmColor="primary"
      />
    </Box>
  );
};

export default SalesReturns;


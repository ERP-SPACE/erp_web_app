import React, { useState, useEffect } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Chip,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as PostIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import accountingService from "../../services/accountingService";
import masterService from "../../services/masterService";
import { formatCurrency, formatDate, getStatusColor } from "../../utils/formatters";

const Vouchers = () => {
  const { showNotification, setLoading } = useApp();
  const [vouchers, setVouchers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const voucherTypeOptions = [
    { value: "Journal", label: "Journal Voucher" },
    { value: "Contra", label: "Contra Voucher" },
    { value: "Payment", label: "Payment Voucher" },
    { value: "Receipt", label: "Receipt Voucher" },
  ];
  const ledgerOptions = [
    { value: "", label: "Select Ledger" },
    ...ledgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
  ];
  const entryTypeOptions = [
    { value: "Debit", label: "Debit" },
    { value: "Credit", label: "Credit" },
  ];

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "entries",
  });

  const watchEntries = watch("entries");

  useEffect(() => {
    fetchVouchers();
    fetchLedgers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getVouchers();
      setVouchers(response.data);
    } catch (error) {
      showNotification("Failed to fetch vouchers", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await accountingService.getLedgers();
      setLedgers(response.data);
    } catch (error) {
      console.error("Failed to fetch ledgers:", error);
    }
  };

  const calculateTotals = () => {
    let debitTotal = 0;
    let creditTotal = 0;

    watchEntries?.forEach((entry) => {
      if (entry.type === "Debit") {
        debitTotal += parseFloat(entry.amount || 0);
      } else {
        creditTotal += parseFloat(entry.amount || 0);
      }
    });

    return { debitTotal, creditTotal };
  };

  const handleAdd = () => {
    setSelectedVoucher(null);
    reset({
      voucherType: "Journal",
      date: new Date(),
      entries: [
        { ledgerId: "", ledgerName: "", type: "Debit", amount: 0, narration: "" },
        { ledgerId: "", ledgerName: "", type: "Credit", amount: 0, narration: "" },
      ],
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    if (row.status !== "Draft") {
      showNotification("Can only edit draft vouchers", "warning");
      return;
    }
    setSelectedVoucher(row);
    reset({
      voucherType: row.voucherType,
      date: new Date(row.date),
      entries: row.entries || [],
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const handleView = async (row) => {
    try {
      const response = await accountingService.getVoucher(row._id);
      setSelectedVoucher(response.data);
      setOpenViewDialog(true);
    } catch (error) {
      showNotification("Failed to fetch voucher details", "error");
    }
  };

  const handleDelete = async (row) => {
    if (row.status !== "Draft") {
      showNotification("Can only delete draft vouchers", "warning");
      return;
    }
    setSelectedVoucher(row);
    setConfirmAction({
      type: "delete",
      message: "Are you sure you want to delete this voucher?",
    });
  };

  const handlePost = (row) => {
    setSelectedVoucher(row);
    setConfirmAction({
      type: "post",
      message: "Are you sure you want to post this voucher? This will create ledger entries.",
    });
  };

  const handleLedgerChange = (index, ledgerId) => {
    const ledger = ledgers.find((l) => l._id === ledgerId);
    if (ledger) {
      setValue(`entries.${index}.ledgerId`, ledgerId);
      setValue(`entries.${index}.ledgerName`, ledger.name);
    }
  };

  const confirmActionHandler = async () => {
    try {
      switch (confirmAction.type) {
        case "post":
          await accountingService.postVoucher(selectedVoucher._id);
          showNotification("Voucher posted successfully", "success");
          break;
        case "delete":
          await accountingService.deleteVoucher(selectedVoucher._id);
          showNotification("Voucher deleted successfully", "success");
          break;
      }
      fetchVouchers();
    } catch (error) {
      showNotification(`Failed to ${confirmAction.type} voucher`, "error");
    }
    setConfirmAction(null);
  };

  const onSubmit = async (data) => {
    const totals = calculateTotals();
    if (totals.debitTotal !== totals.creditTotal) {
      showNotification("Debit and Credit totals must match", "error");
      return;
    }

    try {
      if (selectedVoucher) {
        await accountingService.updateVoucher(selectedVoucher._id, data);
        showNotification("Voucher updated successfully", "success");
      } else {
        await accountingService.createVoucher(data);
        showNotification("Voucher created successfully", "success");
      }
      setOpenDialog(false);
      fetchVouchers();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "voucherNumber", headerName: "Voucher No." },
    {
      field: "voucherType",
      headerName: "Type",
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" />
      ),
    },
    {
      field: "date",
      headerName: "Date",
      renderCell: (params) => formatDate(params.value),
    },
    {
      field: "debitTotal",
      headerName: "Debit",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "creditTotal",
      headerName: "Credit",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "status",
      headerName: "Status",
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: "entries",
      headerName: "Entries",
      renderCell: (params) => params.value?.length || 0,
    },
  ];

  const customActions = [
    {
      icon: <PostIcon />,
      label: "Post",
      onClick: handlePost,
      show: (row) => row.status === "Draft",
    },
    {
      icon: <PrintIcon />,
      label: "Print",
      onClick: (row) => console.log("Print Voucher", row),
    },
  ];

  const totals = calculateTotals();

  return (
    <Box>
      <DataTable
        title="Vouchers"
        columns={columns}
        rows={vouchers}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        customActions={customActions}
      />

      {/* Create/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedVoucher
              ? `Edit Voucher: ${selectedVoucher.voucherNumber}`
              : "Create Voucher"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="voucherType"
                  control={control}
                  rules={{ required: "Voucher Type is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        voucherTypeOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Voucher Type"
                          error={!!errors.voucherType}
                          helperText={errors.voucherType?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: "Date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Voucher Date"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.date}
                          helperText={errors.date?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
              Voucher Entries
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ledger</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Controller
                          name={`entries.${index}.ledgerId`}
                          control={control}
                          render={({ field }) => (
                            <Autocomplete
                              {...buildSingleSelectAutocompleteProps(
                                ledgerOptions,
                                field.value,
                                (value) => handleLedgerChange(index, value)
                              )}
                              size="small"
                              fullWidth
                              renderInput={(params) => <TextField {...params} />}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`entries.${index}.type`}
                          control={control}
                          render={({ field }) => (
                            <Autocomplete
                              {...buildSingleSelectAutocompleteProps(
                                entryTypeOptions,
                                field.value,
                                field.onChange
                              )}
                              size="small"
                              sx={{ width: 100 }}
                              renderInput={(params) => <TextField {...params} />}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`entries.${index}.amount`}
                          control={control}
                          render={({ field }) => (
                            <NumericFormat
                              {...field}
                              customInput={TextField}
                              size="small"
                              thousandSeparator=","
                              decimalScale={2}
                              sx={{ width: 120 }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`entries.${index}.narration`}
                          control={control}
                          render={({ field }) => (
                            <TextField {...field} size="small" fullWidth />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        {fields.length > 2 && (
                          <IconButton
                            size="small"
                            onClick={() => remove(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button
              startIcon={<AddIcon />}
              onClick={() =>
                append({
                  ledgerId: "",
                  ledgerName: "",
                  type: "Debit",
                  amount: 0,
                  narration: "",
                })
              }
              sx={{ mt: 1 }}
            >
              Add Entry
            </Button>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2">Debit Total:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right">
                        {formatCurrency(totals.debitTotal)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">Credit Total:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" align="right">
                        {formatCurrency(totals.creditTotal)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold">
                        Difference:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography
                        variant="body2"
                        align="right"
                        fontWeight="bold"
                        color={
                          totals.debitTotal === totals.creditTotal
                            ? "success.main"
                            : "error.main"
                        }
                      >
                        {formatCurrency(
                          Math.abs(totals.debitTotal - totals.creditTotal)
                        )}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={totals.debitTotal !== totals.creditTotal}
            >
              {selectedVoucher ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Voucher Details</DialogTitle>
        <DialogContent>
          {selectedVoucher && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Voucher Number
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {selectedVoucher.voucherNumber}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={selectedVoucher.status}
                  color={getStatusColor(selectedVoucher.status)}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Voucher Type
                </Typography>
                <Typography variant="body1">
                  {selectedVoucher.voucherType}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(selectedVoucher.date)}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Entries
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ledger</TableCell>
                        <TableCell>Narration</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedVoucher.entries?.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{entry.ledgerName}</TableCell>
                          <TableCell>{entry.narration}</TableCell>
                          <TableCell align="right">
                            {entry.type === "Debit"
                              ? formatCurrency(entry.amount)
                              : "-"}
                          </TableCell>
                          <TableCell align="right">
                            {entry.type === "Credit"
                              ? formatCurrency(entry.amount)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="subtitle2">Total</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">
                            {formatCurrency(selectedVoucher.debitTotal)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">
                            {formatCurrency(selectedVoucher.creditTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {selectedVoucher.notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body1">
                    {selectedVoucher.notes}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmActionHandler}
        title="Confirm Action"
        message={confirmAction?.message}
      />
    </Box>
  );
};

export default Vouchers;

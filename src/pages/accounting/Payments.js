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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  CheckCircle as PostIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import accountingService from "../../services/accountingService";
import masterService from "../../services/masterService";
import salesService from "../../services/salesService";
import purchaseService from "../../services/purchaseService";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
} from "../../utils/formatters";

const Payments = () => {
  const { showNotification, setLoading } = useApp();
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [confirmPost, setConfirmPost] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: "Receipt",
      customerId: "",
      supplierId: "",
      mode: "Cash",
      amount: 0,
      date: new Date(),
      referenceNumber: "",
      bankAccount: "",
      allocations: [],
      remarks: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "allocations",
  });

  const watchType = watch("type");

  const paymentTypeOptions = [
    { value: "Receipt", label: "Receipt (from Customer)" },
    { value: "Payment", label: "Payment (to Supplier)" },
  ];
  const paymentModeOptions = [
    { value: "Cash", label: "Cash" },
    { value: "NEFT", label: "NEFT" },
    { value: "UPI", label: "UPI" },
    { value: "Cheque", label: "Cheque" },
    { value: "RTGS", label: "RTGS" },
  ];
  const customerOptions = customers.map((customer) => ({
    value: customer._id,
    label: customer.companyName || customer.customerCode || "Customer",
  }));
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier._id,
    label: supplier.name,
  }));
  const watchCustomerId = watch("customerId");
  const watchSupplierId = watch("supplierId");
  const watchAllocations = watch("allocations");

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (watchType === "Receipt" && watchCustomerId) {
      fetchCustomerInvoices(watchCustomerId);
    } else if (watchType === "Payment" && watchSupplierId) {
      fetchSupplierInvoices(watchSupplierId);
    }
  }, [watchType, watchCustomerId, watchSupplierId]);

  useEffect(() => {
    const totalAllocated = watchAllocations.reduce(
      (sum, alloc) => sum + (parseFloat(alloc.allocatedAmount) || 0),
      0
    );
    setValue("amount", totalAllocated);
  }, [watchAllocations]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getPayments();
      setPayments(response.data);
    } catch (error) {
      showNotification("Failed to fetch payments", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await masterService.getCustomers({ active: true });
      setCustomers(response.data);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await masterService.getSuppliers({ active: true });
      setSuppliers(response.data);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  };

  const fetchCustomerInvoices = async (customerId) => {
    try {
      const response = await salesService.getSalesInvoices({
        customerId,
        paymentStatus: ["Unpaid", "PartiallyPaid"],
      });
      setPendingInvoices(response.data);
    } catch (error) {
      console.error("Failed to fetch customer invoices:", error);
    }
  };

  const fetchSupplierInvoices = async (supplierId) => {
    try {
      const response = await purchaseService.getPurchaseInvoices({
        supplierId,
        paymentStatus: ["Unpaid", "PartiallyPaid"],
      });
      setPendingInvoices(response.data);
    } catch (error) {
      console.error("Failed to fetch supplier invoices:", error);
    }
  };

  const handleAdd = () => {
    setSelectedPayment(null);
    reset({
      type: "Receipt",
      customerId: "",
      supplierId: "",
      mode: "Cash",
      amount: 0,
      date: new Date(),
      referenceNumber: "",
      bankAccount: "",
      allocations: [],
      remarks: "",
    });
    setOpenDialog(true);
  };

  const handleView = (row) => {
    setSelectedPayment(row);
    reset({
      type: row.type,
      customerId: row.customerId,
      supplierId: row.supplierId,
      mode: row.mode,
      amount: row.amount,
      date: new Date(row.date),
      referenceNumber: row.referenceNumber,
      bankAccount: row.bankAccount,
      allocations: row.allocations || [],
      remarks: row.remarks,
    });
    setOpenDialog(true);
  };

  const handlePost = (row) => {
    if (row.status !== "Draft") {
      showNotification("Payment is already posted", "warning");
      return;
    }
    setSelectedPayment(row);
    setConfirmPost(true);
  };

  const confirmPostPayment = async () => {
    try {
      await accountingService.postPayment(selectedPayment._id);
      showNotification("Payment posted successfully", "success");
      fetchPayments();
    } catch (error) {
      showNotification("Failed to post payment", "error");
    }
    setConfirmPost(false);
  };

  const onSubmit = async (data) => {
    try {
      const paymentData = {
        ...data,
        partyName:
          data.type === "Receipt"
            ? customers.find((c) => c._id === data.customerId)?.name
            : suppliers.find((s) => s._id === data.supplierId)?.name,
      };

      if (selectedPayment) {
        showNotification("Cannot edit posted payments", "warning");
      } else {
        await accountingService.createPayment(paymentData);
        showNotification("Payment created successfully", "success");
      }
      setOpenDialog(false);
      fetchPayments();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "paymentNumber", headerName: "Payment#" },
    {
      field: "type",
      headerName: "Type",
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === "Receipt" ? "success" : "primary"}
          size="small"
        />
      ),
    },
    { field: "partyName", headerName: "Party", flex: 1 },
    { field: "mode", headerName: "Mode" },
    {
      field: "amount",
      headerName: "Amount",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "date",
      headerName: "Date",
      renderCell: (params) => formatDate(params.value),
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
  ];

  const customActions = [
    {
      icon: <PostIcon />,
      label: "Post",
      onClick: handlePost,
      show: (row) => row.status === "Draft",
    },
  ];

  return (
    <Box>
      <DataTable
        title="Payments & Receipts"
        columns={columns}
        rows={payments}
        onAdd={handleAdd}
        onView={handleView}
        customActions={customActions}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedPayment
              ? `Payment: ${selectedPayment.paymentNumber}`
              : "Create Payment/Receipt"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="type"
                  control={control}
                  rules={{ required: "Type is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        paymentTypeOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      disabled={!!selectedPayment}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Type"
                          error={!!errors.type}
                          helperText={errors.type?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="mode"
                  control={control}
                  rules={{ required: "Payment mode is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        paymentModeOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Payment Mode"
                          error={!!errors.mode}
                          helperText={errors.mode?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              {watchType === "Receipt" && (
                <Grid item xs={12} md={6}>
                  <Controller
                    name="customerId"
                    control={control}
                    rules={{ required: "Customer is required" }}
                    render={({ field }) => (
                      <Autocomplete
                        {...buildSingleSelectAutocompleteProps(
                          customerOptions,
                          field.value,
                          field.onChange
                        )}
                        fullWidth
                        disabled={!!selectedPayment}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Customer"
                            error={!!errors.customerId}
                            helperText={errors.customerId?.message}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
              )}

              {watchType === "Payment" && (
                <Grid item xs={12} md={6}>
                  <Controller
                    name="supplierId"
                    control={control}
                    rules={{ required: "Supplier is required" }}
                    render={({ field }) => (
                      <Autocomplete
                        {...buildSingleSelectAutocompleteProps(
                          supplierOptions,
                          field.value,
                          field.onChange
                        )}
                        fullWidth
                        disabled={!!selectedPayment}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Supplier"
                            error={!!errors.supplierId}
                            helperText={errors.supplierId?.message}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: "Date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Payment Date"
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

              {watch("mode") !== "Cash" && (
                <>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="referenceNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Reference Number"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Controller
                      name="bankAccount"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} fullWidth label="Bank Account" />
                      )}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Invoice Allocation
                </Typography>

                {pendingInvoices.length > 0 ? (
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice#</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Total</TableCell>
                          <TableCell>Outstanding</TableCell>
                          <TableCell>Allocate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pendingInvoices.map((invoice) => (
                          <TableRow key={invoice._id}>
                            <TableCell>
                              {invoice.siNumber || invoice.piNumber}
                            </TableCell>
                            <TableCell>
                              {formatDate(invoice.siDate || invoice.date)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                invoice.total || invoice.grandTotal
                              )}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                invoice.outstandingAmount ||
                                  invoice.grandTotal - invoice.paidAmount
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                onClick={() =>
                                  append({
                                    invoiceId: invoice._id,
                                    invoiceNumber:
                                      invoice.siNumber || invoice.piNumber,
                                    invoiceType: invoice.siNumber
                                      ? "SalesInvoice"
                                      : "PurchaseInvoice",
                                    allocatedAmount:
                                      invoice.outstandingAmount ||
                                      invoice.grandTotal - invoice.paidAmount,
                                  })
                                }
                              >
                                Allocate
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">No pending invoices</Alert>
                )}
              </Grid>

              {fields.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Allocated Invoices
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice#</TableCell>
                          <TableCell>Allocated Amount</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fields.map((field, index) => (
                          <TableRow key={field.id}>
                            <TableCell>{field.invoiceNumber}</TableCell>
                            <TableCell>
                              <Controller
                                name={`allocations.${index}.allocatedAmount`}
                                control={control}
                                render={({ field }) => (
                                  <NumericFormat
                                    {...field}
                                    customInput={TextField}
                                    size="small"
                                    thousandSeparator=","
                                    decimalScale={2}
                                    prefix="₹"
                                  />
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => remove(index)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <NumericFormat
                      {...field}
                      customInput={TextField}
                      fullWidth
                      label="Total Amount"
                      thousandSeparator=","
                      decimalScale={2}
                      prefix="₹"
                      disabled
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="remarks"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Remarks"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !!selectedPayment && selectedPayment.status === "Posted"
              }
            >
              {selectedPayment ? "View Only" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        onConfirm={confirmPostPayment}
        title="Post Payment"
        message="Are you sure you want to post this payment? This will update invoice balances and create accounting entries."
        confirmColor="primary"
      />
    </Box>
  );
};

export default Payments;

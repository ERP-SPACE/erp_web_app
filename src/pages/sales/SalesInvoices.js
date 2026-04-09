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
  Divider,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Receipt as InvoiceIcon,
  CheckCircle as PostIcon,
  Print as PrintIcon,
  Assessment as ProfitIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import salesService from "../../services/salesService";
import inventoryService from "../../services/inventoryService";
import {
  formatCurrency,
  formatDate,
  formatInches,
  getStatusColor,
} from "../../utils/formatters";

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

const SalesInvoices = () => {
  const { showNotification, setLoading } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [selectedDC, setSelectedDC] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const deliveryChallanOptions = deliveryChallans.map((dc) => ({
    value: dc._id,
    label: `${dc.dcNumber} - ${dc.customerName}`,
  }));
  const [confirmPost, setConfirmPost] = useState(false);
  const [showProfitDialog, setShowProfitDialog] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      deliveryChallanId: "",
      siDate: new Date(),
      dueDate: new Date(),
      lines: [],
      notes: "",
    },
  });

  const watchDeliveryChallanId = watch("deliveryChallanId");
  const watchLines = watch("lines");

  useEffect(() => {
    fetchSalesInvoices();
    fetchDeliveryChallans();
  }, []);

  useEffect(() => {
    const dcId = normalizeId(watchDeliveryChallanId);
    if (dcId) {
      loadDeliveryChallanDetails(dcId);
    }
  }, [watchDeliveryChallanId]);

  useEffect(() => {
    calculateTotals();
  }, [watchLines]);

  const fetchSalesInvoices = async () => {
    setLoading(true);
    try {
      const response = await salesService.getSalesInvoices();
      setInvoices(response.data);
    } catch (error) {
      showNotification("Failed to fetch sales invoices", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryChallans = async () => {
    try {
      const response = await salesService.getDeliveryChallans({
        status: "Open",
      });
      setDeliveryChallans(response.data);
    } catch (error) {
      console.error("Failed to fetch delivery challans:", error);
    }
  };

  const loadDeliveryChallanDetails = async (dcId) => {
    try {
      const response = await salesService.getDeliveryChallan(dcId);
      const dc = response.data;
      setSelectedDC(dc);

      // Get SO details for pricing
      const soResponse = await salesService.getSalesOrder(
        normalizeId(dc.salesOrderId)
      );
      const so = soResponse.data;

      // Initialize invoice lines from DC lines with pricing and COGS
      const invoiceLines = [];
      for (const dcLine of dc.lines) {
        const soLine = so.lines.find((l) => l._id === dcLine.soLineId);
        const rollId = normalizeId(dcLine.rollId);
        
        // inventoryService.getRoll returns the roll object directly (axios interceptor unwraps response.data)
        let rollData = {};
        if (rollId && rollId !== "[object Object]") {
          try {
            rollData = await inventoryService.getRoll(rollId) || {};
          } catch (err) {
            console.warn("Failed to fetch roll:", rollId, err);
          }
        }

        const ratePerRoll = toNumber(
          soLine?.finalRatePerRoll ??
            dcLine?.finalRatePerRoll ??
            dcLine?.ratePerRoll ??
            soLine?.derivedRatePerRoll
        );
        const taxRate = toNumber(
          soLine?.taxRate ?? dcLine?.taxRate ?? soLine?.tax ?? dcLine?.tax ?? 0
        );
        const landedCost = toNumber(rollData.totalLandedCost || rollData.landedCostPerRoll);

        // Get roll details - prefer roll data, fallback to SO line (direct or via populated SKU), then DC line
        const skuData = soLine?.skuId || {};
        const productData = skuData?.productId || {};
        
        const categoryName = rollData.categoryName || 
          soLine?.categoryName || 
          productData?.categoryId?.name || 
          skuData?.categoryName || 
          "";
        const gsm = rollData.gsm || 
          soLine?.gsm || 
          productData?.gsmId?.value || 
          productData?.gsmId?.label || 
          skuData?.gsm || 
          "";
        const qualityName = rollData.qualityName || 
          soLine?.qualityName || 
          productData?.qualityId?.name || 
          skuData?.qualityName || 
          "";
        const widthInches = rollData.widthInches || 
          soLine?.widthInches || 
          skuData?.widthInches || 
          dcLine?.widthInches || 
          0;

        invoiceLines.push({
          soLineId: dcLine.soLineId,
          rollId,
          rollNumber: dcLine.rollNumber,
          skuId: dcLine.skuId || rollData.skuId,
          categoryName,
          gsm,
          qualityName,
          widthInches,
          qtyRolls: 1,
          billedLengthMeters: dcLine.shippedLengthMeters,
          ratePerRoll,
          discountLine: 0,
          taxRate,
          landedCostPerRoll: landedCost,
          cogsAmount: landedCost,
        });
      }

      setValue("lines", invoiceLines);
      setValue("customerId", dc.customerId);
      setValue("customerName", dc.customerName);
      setValue("salesOrderId", dc.salesOrderId);
    } catch (error) {
      showNotification("Failed to load delivery challan details", "error");
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    let totalCOGS = 0;

    watchLines.forEach((line) => {
      const lineSubtotal = toNumber(line.qtyRolls) * toNumber(line.ratePerRoll);
      const lineDiscount = (lineSubtotal * toNumber(line.discountLine)) / 100;
      const taxableAmount = lineSubtotal - lineDiscount;
      const lineTax = (taxableAmount * toNumber(line.taxRate)) / 100;

      subtotal += lineSubtotal;
      taxAmount += lineTax;
      totalCOGS += line.cogsAmount || 0;
    });

    const total = subtotal + taxAmount;
    const grossMargin = total - totalCOGS;
    const marginPercent = total > 0 ? (grossMargin / total) * 100 : 0;

    return {
      subtotal,
      taxAmount,
      total,
      totalCOGS,
      grossMargin,
      marginPercent,
    };
  };

  const handleAdd = () => {
    setSelectedInvoice(null);
    reset({
      deliveryChallanId: "",
      siDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lines: [],
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleView = (row) => {
    setSelectedInvoice(row);
    reset({
      deliveryChallanId: normalizeId(row.deliveryChallanId),
      siDate: new Date(row.siDate),
      dueDate: new Date(row.dueDate),
      lines: row.lines || [],
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const handlePost = (row) => {
    if (row.status !== "Draft") {
      showNotification("Invoice is already posted", "warning");
      return;
    }
    setSelectedInvoice(row);
    setConfirmPost(true);
  };

  const confirmPostInvoice = async () => {
    try {
      const invoiceId = normalizeId(selectedInvoice?._id);
      const dcId = normalizeId(selectedInvoice?.deliveryChallanId);

      if (!invoiceId) {
        showNotification("Missing invoice id. Cannot post.", "error");
        setConfirmPost(false);
        return;
      }

      await salesService.postSalesInvoice(invoiceId);

      // Update DC status (close) only when we have a valid id
      if (dcId) {
        await salesService.closeDeliveryChallan(dcId);
      } else {
        showNotification("Missing delivery challan id to close.", "warning");
      }

      showNotification("Invoice posted successfully", "success");
      fetchSalesInvoices();
    } catch (error) {
      showNotification("Failed to post invoice", "error");
    }
    setConfirmPost(false);
  };

  const handlePrint = async (row) => {
    try {
      const response = await salesService.getSalesInvoicePDF(row._id);
      const blob = new Blob([response], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      showNotification("Failed to generate PDF", "error");
    }
  };

  const handleViewProfit = (row) => {
    setSelectedInvoice(row);
    setShowProfitDialog(true);
  };

  const onSubmit = async (data) => {
    try {
      const totals = calculateTotals();
      const invoiceData = {
        ...data,
        ...totals,
        customerId: selectedDC.customerId,
        customerName: selectedDC.customerName,
        salesOrderId: selectedDC.salesOrderId,
        paymentStatus: "Unpaid",
        paidAmount: 0,
        outstandingAmount: totals.total,
      };

      if (selectedInvoice) {
        showNotification("Cannot edit posted invoices", "warning");
      } else {
        await salesService.createSalesInvoice(invoiceData);

        // Update roll status
        for (const line of data.lines) {
          await inventoryService.updateRoll(line.rollId, {
            billedInSIId: selectedInvoice?._id,
          });
        }

        showNotification("Sales invoice created successfully", "success");
      }
      setOpenDialog(false);
      fetchSalesInvoices();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "siNumber", headerName: "Invoice Number" },
    { field: "customerName", headerName: "Customer", flex: 1 },
    {
      field: "siDate",
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
    {
      field: "total",
      headerName: "Invoice Amount",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "grossMargin",
      headerName: "Margin",
      renderCell: (params) => {
        const marginPercent =
          params.row.total > 0 ? (params.value / params.row.total) * 100 : 0;
        return (
          <Typography
            variant="body2"
            color={marginPercent > 20 ? "success.main" : "warning.main"}
          >
            {formatCurrency(params.value)} ({marginPercent.toFixed(1)}%)
          </Typography>
        );
      },
    },
    {
      field: "paymentStatus",
      headerName: "Payment",
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === "Paid" ? "success" : "warning"}
          size="small"
        />
      ),
    },
  ];

  const customActions = [
    {
      icon: <PostIcon />,
      label: "Post Invoice",
      onClick: handlePost,
      show: (row) => row.status === "Draft",
    },
    {
      icon: <PrintIcon />,
      label: "Print",
      onClick: handlePrint,
    },
    {
      icon: <ProfitIcon />,
      label: "View Profit",
      onClick: handleViewProfit,
    },
  ];

  const totals = calculateTotals();

  return (
    <Box>
      <DataTable
        title="Sales Invoices"
        columns={columns}
        rows={invoices}
        onAdd={handleAdd}
        onView={handleView}
        customActions={customActions}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedInvoice
              ? `Invoice: ${selectedInvoice.siNumber}`
              : "Create Sales Invoice"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="deliveryChallanId"
                  control={control}
                  rules={{ required: "Delivery Challan is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        deliveryChallanOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      disabled={!!selectedInvoice}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Customer"
                          error={!!errors.deliveryChallanId}
                          helperText={errors.deliveryChallanId?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="siDate"
                  control={control}
                  rules={{ required: "Invoice date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Invoice Date"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.siDate}
                          helperText={errors.siDate?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            </Grid>

            {selectedDC && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Customer: {selectedDC.customerName} | DC Date:
                {formatDate(selectedDC.dcDate)} | Rolls:
                {selectedDC.lines?.length}
              </Alert>
            )}

            <Typography variant="h6" gutterBottom>
              Invoice Lines
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Roll#</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>GSM</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Width"</TableCell>
                    <TableCell>Length(m)</TableCell>
                    <TableCell>Rate/Roll</TableCell>
                    <TableCell>Tax%</TableCell>
                    <TableCell>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {watchLines.map((line, index) => {
                    const rate = toNumber(line.ratePerRoll);
                    const tax = toNumber(line.taxRate);
                    const lineAmount = rate * (1 + tax / 100);

                    return (
                      <TableRow key={index}>
                        <TableCell>{line.rollNumber}</TableCell>
                        <TableCell>{line.categoryName}</TableCell>
                        <TableCell>{line.gsm}</TableCell>
                        <TableCell>{line.qualityName}</TableCell>
                        <TableCell>{formatInches(line.widthInches)}</TableCell>
                        <TableCell>{line.billedLengthMeters}</TableCell>
                        <TableCell>
                          {formatCurrency(line.ratePerRoll)}
                        </TableCell>
                        <TableCell>{line.taxRate}%</TableCell>
                        <TableCell>{formatCurrency(lineAmount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

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
                  <Typography variant="body2" gutterBottom>
                    Subtotal: {formatCurrency(totals.subtotal)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Tax: {formatCurrency(totals.taxAmount)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Total: {formatCurrency(totals.total)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    COGS: {formatCurrency(totals.totalCOGS)}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    Gross Margin: {formatCurrency(totals.grossMargin)} (
                    {totals.marginPercent.toFixed(1)}%)
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !!selectedInvoice && selectedInvoice.status === "Posted"
              }
            >
              {selectedInvoice ? "View Only" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Profit Analysis Dialog */}
      <Dialog
        open={showProfitDialog}
        onClose={() => setShowProfitDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Profitability Analysis</DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Invoice: {selectedInvoice.siNumber}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Revenue
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(selectedInvoice.total)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Cost of Goods Sold
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(selectedInvoice.totalCOGS)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Gross Profit
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(selectedInvoice.grossMargin)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Margin %
                  </Typography>
                  <Typography
                    variant="h6"
                    color={
                      (selectedInvoice.grossMargin / selectedInvoice.total) *
                        100 >
                      20
                        ? "success.main"
                        : "warning.main"
                    }
                  >
                    {(
                      (selectedInvoice.grossMargin / selectedInvoice.total) *
                      100
                    ).toFixed(2)}
                    %
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Roll-wise Analysis
              </Typography>
              {selectedInvoice.lines?.map((line, index) => {
                const lineMargin = line.ratePerRoll - line.cogsAmount;
                const marginPercent = (lineMargin / line.ratePerRoll) * 100;

                return (
                  <Box
                    key={index}
                    sx={{ mb: 1, p: 1, bgcolor: "grey.50", borderRadius: 1 }}
                  >
                    <Typography variant="body2">
                      {line.rollNumber}: {line.categoryName} {line.gsm}GSM
                      {formatInches(line.widthInches)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={
                        marginPercent > 20 ? "success.main" : "warning.main"
                      }
                    >
                      Margin: {formatCurrency(lineMargin)} (
                      {marginPercent.toFixed(1)}%)
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProfitDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        onConfirm={confirmPostInvoice}
        title="Post Invoice"
        message="Are you sure you want to post this invoice? This will update accounting entries and cannot be undone."
        confirmColor="primary"
      />
    </Box>
  );
};

export default SalesInvoices;

import React, { useState, useEffect, useMemo } from "react";
import {
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
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
  Checkbox,
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
import {
  deriveRatePerRollForInvoiceRoll,
  normalizeInvoiceRollLineForSave,
  ensureInvoiceLinesHaveRatePerRoll,
  computeInvoiceRollLineAmounts,
} from "../../utils/salesLinePricing";

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

/** One row per SO line: rolls, meters, and amounts aggregated from roll-level invoice lines. */
const groupInvoiceLinesByOrderLine = (lines) => {
  if (!lines?.length) return [];
  const map = new Map();
  lines.forEach((line, idx) => {
    const key =
      normalizeId(line.soLineId) ||
      `roll:${normalizeId(line.rollId)}:${line.rollNumber ?? idx}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        categoryName: line.categoryName,
        gsm: line.gsm,
        qualityName: line.qualityName,
        widthInches: line.widthInches,
        rolls: [],
      });
    }
    map.get(key).rolls.push(line);
  });
  return Array.from(map.values()).map((g) => {
    const { rolls } = g;
    const first = rolls[0];
    const totalRolls = rolls.reduce((s, l) => s + toNumber(l.qtyRolls), 0);
    const totalMeters = rolls.reduce(
      (s, l) => s + toNumber(l.billedLengthMeters),
      0
    );
    let lineSubtotal = 0;
    let lineTax = 0;
    let lineCogs = 0;
    rolls.forEach((line) => {
      const sub = toNumber(line.qtyRolls) * toNumber(line.ratePerRoll);
      const disc = (sub * toNumber(line.discountLine)) / 100;
      const taxable = sub - disc;
      lineSubtotal += sub;
      lineTax += (taxable * toNumber(line.taxRate)) / 100;
      lineCogs += toNumber(line.cogsAmount);
    });
    return {
      key: g.key,
      categoryName: g.categoryName,
      gsm: g.gsm,
      qualityName: g.qualityName,
      widthInches: g.widthInches,
      totalRolls,
      totalMeters,
      taxRate: toNumber(first.taxRate),
      lineSubtotal,
      lineTax,
      lineTotal: lineSubtotal + lineTax,
      lineCogs,
    };
  });
};

const SalesInvoices = () => {
  const { showNotification, setLoading } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [selectedDC, setSelectedDC] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showRollDetails, setShowRollDetails] = useState(false);
  const deliveryChallanOptions = deliveryChallans.map((dc) => ({
    value: normalizeId(dc),
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

  const groupedOrderLines = useMemo(
    () => groupInvoiceLinesByOrderLine(watchLines || []),
    [watchLines]
  );

  useEffect(() => {
    fetchSalesInvoices();
    fetchDeliveryChallans();
  }, []);

  const ensureDeliveryChallanInOptions = async (dcId) => {
    const normalizedId = normalizeId(dcId);
    if (!normalizedId) return;

    const alreadyPresent = deliveryChallans.some(
      (dc) => normalizeId(dc) === normalizedId
    );
    if (alreadyPresent) return;

    try {
      const response = await salesService.getDeliveryChallan(normalizedId);
      const dc = response.data;
      setDeliveryChallans((prev) => [...prev, dc]);
    } catch (error) {
      // If it can't be fetched (permissions, deleted, etc), just leave it blank
      console.warn("Failed to load delivery challan for display:", error);
    }
  };

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
        const soLineId = normalizeId(dcLine.soLineId);
        const soLine = so.lines.find((l) => normalizeId(l?._id) === soLineId);
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

        const billedMeters = toNumber(dcLine.shippedLengthMeters);
        const ratePerRoll = deriveRatePerRollForInvoiceRoll({
          soLine,
          dcLine: { ...dcLine, shippedLengthMeters: billedMeters },
        });
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
          billedLengthMeters: billedMeters,
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
    setShowRollDetails(false);
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
    setShowRollDetails(false);
    ensureDeliveryChallanInOptions(row.deliveryChallanId);
    reset({
      deliveryChallanId: normalizeId(row.deliveryChallanId),
      siDate: new Date(row.siDate),
      dueDate: new Date(row.dueDate),
      lines: ensureInvoiceLinesHaveRatePerRoll(row.lines || []),
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
        lines: (data.lines || []).map((l) =>
          normalizeInvoiceRollLineForSave(l)
        ),
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
            <Grid container spacing={2} sx={{ mt:2, mb: 2 }}>
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
                          label="Select Delivery Challan"
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
              Order lines
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              One row per sales order line: rolls and meters are totals for that
              line.
            </Typography>

            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>GSM</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Width&quot;</TableCell>
                    <TableCell align="right">Rolls</TableCell>
                    <TableCell align="right">Meters</TableCell>
                    <TableCell align="right">Tax%</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">COGS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedOrderLines.map((row) => {
                    return (
                      <TableRow key={row.key}>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>{row.gsm}</TableCell>
                        <TableCell>{row.qualityName}</TableCell>
                        <TableCell>{formatInches(row.widthInches)}</TableCell>
                        <TableCell align="right">{row.totalRolls}</TableCell>
                        <TableCell align="right">
                          {row.totalMeters.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">{row.taxRate}%</TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.lineSubtotal)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.lineTax)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.lineTotal)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(row.lineCogs)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <FormControlLabel
              sx={{ mb: 1 }}
              control={
                <Checkbox
                  checked={showRollDetails}
                  onChange={(e) => setShowRollDetails(e.target.checked)}
                />
              }
              label="Show roll details"
            />

            {showRollDetails && (
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Roll#</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>GSM</TableCell>
                      <TableCell>Quality</TableCell>
                      <TableCell>Width&quot;</TableCell>
                      <TableCell align="right">Meters</TableCell>
                      <TableCell align="right">Tax%</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(watchLines || []).map((line, idx) => {
                      const { lineTotal: total } =
                        computeInvoiceRollLineAmounts(line);
                      return (
                        <TableRow key={`${normalizeId(line.rollId) || idx}`}>
                          <TableCell>{line.rollNumber}</TableCell>
                          <TableCell>{line.categoryName}</TableCell>
                          <TableCell>{line.gsm}</TableCell>
                          <TableCell>{line.qualityName}</TableCell>
                          <TableCell>{formatInches(line.widthInches)}</TableCell>
                          <TableCell align="right">
                            {toNumber(line.billedLengthMeters).toFixed(2)}
                          </TableCell>
                          <TableCell align="right">{toNumber(line.taxRate)}%</TableCell>
                          <TableCell align="right">{formatCurrency(total)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

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
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: "grey.50",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Invoice totals
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="caption" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {formatCurrency(totals.subtotal)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="caption" color="text.secondary">
                    Tax
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {formatCurrency(totals.taxAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="caption" color="text.secondary">
                    Total
                  </Typography>
                  <Typography variant="h6" component="div">
                    {formatCurrency(totals.total)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="caption" color="text.secondary">
                    COGS
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {formatCurrency(totals.totalCOGS)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Gross margin
                  </Typography>
                  <Typography variant="body1" color="success.main" fontWeight={600}>
                    {formatCurrency(totals.grossMargin)} (
                    {totals.marginPercent.toFixed(1)}%)
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
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
                const marginPercent =
                  toNumber(line.ratePerRoll) > 0
                    ? (lineMargin / toNumber(line.ratePerRoll)) * 100
                    : 0;

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

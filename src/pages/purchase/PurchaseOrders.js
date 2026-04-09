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
  IconButton,
  Typography,
  Chip,
  Divider,
  Stack,
  Tooltip,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  Cancel as CancelIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import purchaseService from "../../services/purchaseService";
import masterService from "../../services/masterService";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  formatNumber,
} from "../../utils/formatters";

const sanitizeNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && value?.floatValue !== undefined) {
    return value.floatValue || 0;
  }
  return Number(value) || 0;
};

const PurchaseOrders = () => {
  const { showNotification, setLoading } = useApp();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [skus, setSKUs] = useState([]);
  const [supplierBaseRates, setSupplierBaseRates] = useState([]);
  const [addingRateForLine, setAddingRateForLine] = useState(null);
  const [newRateValue, setNewRateValue] = useState("");
  const supplierOptions = (suppliers || []).map((supplier) => ({
    value: supplier._id,
    label: supplier.name,
  }));
  const skuOptions = [
    { value: "", label: "Select SKU" },
    ...(skus || []).map((sku) => ({ value: sku._id, label: sku.skuCode })),
  ];
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      supplierId: "",
      date: new Date(),
      lines: [
        {
          skuId: "",
          categoryName: "",
          gsm: "",
          qualityName: "",
          widthInches: "",
          lengthMetersPerRoll: 0,
          qtyRolls: 0,
          ratePerRoll: 0,
          totalMeters: 0,
          lineTotal: 0,
          lineStatus: "Pending",
        },
      ],
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const watchLines = watch("lines");
  const selectedSupplierId = watch("supplierId");

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchSKUs();
  }, []);

  const lineTotals = (watchLines || []).reduce(
    (acc, line = {}) => {
      const qty = sanitizeNumber(line.qtyRolls);
      const metersPerRoll = sanitizeNumber(line.lengthMetersPerRoll);
      const rate = sanitizeNumber(line.ratePerRoll);
      const lineMeters = qty * metersPerRoll;
      acc.totalMeters += lineMeters;
      acc.totalRatePerRoll += rate;
      acc.totalAmount += lineMeters * rate;
      return acc;
    },
    { totalMeters: 0, totalRatePerRoll: 0, totalAmount: 0 }
  );

  //   useEffect(() => {
  //     calculateTotals();
  //   }, [watchLines]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseOrders();
      const ordersData =
        response?.data ||
        response?.orders ||
        response?.purchaseOrders ||
        response?.rows ||
        response;

      if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      } else if (Array.isArray(ordersData?.data)) {
        setOrders(ordersData.data);
      } else {
        setOrders([]);
      }
    } catch (error) {
      showNotification("Failed to fetch purchase orders", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await masterService.getSuppliers({ active: true });
      setSuppliers(response?.data || response?.suppliers || []);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      setSuppliers([]);
    }
  };

  const fetchSKUs = async () => {
    try {
      const response = await masterService.getSKUs({ active: true });
      setSKUs(response?.data || response?.skus || []);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
      setSKUs([]);
    }
  };

  const fetchSupplierBaseRates = async (supplierId) => {
    if (!supplierId) { setSupplierBaseRates([]); return; }
    try {
      const response = await masterService.getSupplierBaseRates(supplierId);
      setSupplierBaseRates(response?.data || response || []);
    } catch (error) {
      console.error("Failed to fetch supplier base rates:", error);
      setSupplierBaseRates([]);
    }
  };

  const handleSaveSkuRate = async (lineIndex) => {
    const supplierId = getValues("supplierId");
    const skuId = getValues(`lines.${lineIndex}.skuId`);
    if (!supplierId || !skuId) return;
    const rate = Number(newRateValue);
    if (!rate || rate <= 0) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }
    try {
      await masterService.upsertSupplierBaseRate(supplierId, skuId, rate);
      showNotification("Supplier base rate saved successfully", "success");
      await fetchSupplierBaseRates(supplierId);
      // Auto-fill the line with the newly saved rate
      setValue(`lines.${lineIndex}.ratePerRoll`, rate);
      setAddingRateForLine(null);
      setNewRateValue("");
    } catch (err) {
      showNotification(err?.message || "Failed to save rate", "error");
    }
  };

  const handleAdd = () => {
    setSelectedOrder(null);
    setSupplierBaseRates([]);
    setAddingRateForLine(null);
    setNewRateValue("");
    reset({
      supplierId: "",
      date: new Date(),
      lines: [
        {
          skuId: "",
          categoryName: "",
          gsm: "",
          qualityName: "",
          widthInches: "",
          lengthMetersPerRoll: 0,
          qtyRolls: 0,
          ratePerRoll: 0,
          totalMeters: 0,
          lineTotal: 0,
          lineStatus: "Pending",
        },
      ],
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setSupplierBaseRates([]);
    setAddingRateForLine(null);
    setNewRateValue("");
    const normalizedSupplierId =
      row.supplierId?._id ||
      row.supplierId ||
      row.supplier?._id ||
      row.supplier ||
      "";
    const normalizedLines = (row.lines || []).map((line = {}) => ({
      ...line,
      skuId: line.skuId?._id || line.skuId || "",
      lineStatus: line.lineStatus || line.status || "Pending",
    }));
    setSelectedOrder(row);
    reset({
      supplierId: normalizedSupplierId,
      date: new Date(row.date),
      lines: normalizedLines,
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const deriveProductMeta = (sku) => {
    if (!sku) {
      return {
        categoryId: "",
        categoryName: "",
        qualityName: "",
        gsm: "",
        widthInches: "",
        lengthMetersPerRoll: "",
      };
    }

    const product = sku.productId || sku.product || {};
    const categoryId =
      sku.categoryId ||
      product.categoryId?._id ||
      product.categoryId ||
      product.category?._id ||
      product.category ||
      "";

    const categoryName =
      sku.categoryName ||
      product.categoryName ||
      product.category?.name ||
      product.categoryId?.name ||
      product.category?.categoryName ||
      "";

    const qualityName =
      sku.qualityName ||
      product.qualityName ||
      product.quality?.name ||
      product.qualityId?.name ||
      "";

    const gsm =
      sku.gsm ||
      product.gsmName ||
      product.gsm?.name ||
      product.gsmId?.name ||
      "";

    const lengthMetersPerRoll =
      sku.lengthMetersPerRoll ||
      sku.metersPerRoll ||
      product.defaultLengthMeters ||
      product.defaultLength ||
      product.lengthMetersPerRoll ||
      "";

    return {
      categoryId,
      categoryName,
      qualityName,
      gsm,
      lengthMetersPerRoll,
      widthInches: sku.widthInches || product.widthInches || "",
    };
  };

  const getSupplierBaseRate = (supplierId, skuId) => {
    if (!supplierId || !skuId) return undefined;

    const matched = supplierBaseRates.find((br) => {
      const brSkuId = br.skuId?._id?.toString() || br.skuId?.toString() || "";
      return brSkuId === skuId.toString();
    });

    if (!matched || matched.rate === undefined) return undefined;
    return sanitizeNumber(matched.rate);
  };

  const applyBaseRateForLine = (index, sku, supplierId) => {
    if (!sku || !supplierId) return;

    const baseRate = getSupplierBaseRate(supplierId, sku._id);

    if (baseRate === undefined) return;

    setValue(`lines.${index}.ratePerRoll`, baseRate);

    const qtyRolls = sanitizeNumber(getValues(`lines.${index}.qtyRolls`));
    const metersPerRoll = sanitizeNumber(
      getValues(`lines.${index}.lengthMetersPerRoll`)
    );
    const totalMeters = qtyRolls * metersPerRoll;
    setValue(`lines.${index}.totalMeters`, totalMeters);
    setValue(`lines.${index}.lineTotal`, totalMeters * baseRate);
  };

  useEffect(() => {
    fetchSupplierBaseRates(selectedSupplierId);
  }, [selectedSupplierId]);

  useEffect(() => {
    if (!selectedSupplierId || !supplierBaseRates.length) return;

    const currentLines = getValues("lines") || [];

    currentLines.forEach((line, index) => {
      if (!line?.skuId) return;
      const sku = skus?.find((s) => s._id === line.skuId);
      if (!sku) return;
      applyBaseRateForLine(index, sku, selectedSupplierId);
    });
  }, [selectedSupplierId, supplierBaseRates, skus, getValues, setValue]);

  const handleSKUChange = (index, skuId) => {
    const sku = skus?.find((s) => s._id === skuId);

    setValue(`lines.${index}.skuId`, skuId || "");

    if (!sku) {
      setValue(`lines.${index}.categoryName`, "");
      setValue(`lines.${index}.gsm`, "");
      setValue(`lines.${index}.qualityName`, "");
      setValue(`lines.${index}.widthInches`, "");
      setValue(`lines.${index}.lengthMetersPerRoll`, "");
      setValue(`lines.${index}.lineStatus`, "Pending");
      return;
    }

    const meta = deriveProductMeta(sku);

    setValue(`lines.${index}.categoryName`, meta.categoryName || "");
    setValue(`lines.${index}.gsm`, meta.gsm || "");
    setValue(`lines.${index}.qualityName`, meta.qualityName || "");
    setValue(`lines.${index}.widthInches`, meta.widthInches || "");
    setValue(
      `lines.${index}.lengthMetersPerRoll`,
      meta.lengthMetersPerRoll || ""
    );

    applyBaseRateForLine(index, sku, getValues("supplierId"));
  };

  const handleApprove = (row) => {
    setSelectedOrder(row);
    setConfirmAction({
      type: "approve",
      message: "Are you sure you want to approve this order?",
    });
  };

  const handleCancel = (row) => {
    setSelectedOrder(row);
    setConfirmAction({
      type: "cancel",
      message: "Are you sure you want to cancel this order?",
    });
  };

  const handleClose = (row) => {
    setSelectedOrder(row);
    setConfirmAction({
      type: "close",
      message: "Are you sure you want to close this order?",
    });
  };

  const confirmActionHandler = async () => {
    try {
      switch (confirmAction.type) {
        case "approve":
          await purchaseService.approvePurchaseOrder(selectedOrder._id);
          showNotification("Purchase order approved successfully", "success");
          break;
        case "cancel":
          await purchaseService.cancelPurchaseOrder(selectedOrder._id);
          showNotification("Purchase order cancelled successfully", "success");
          break;
        case "close":
          await purchaseService.closePurchaseOrder(selectedOrder._id);
          showNotification("Purchase order closed successfully", "success");
          break;
      }
      fetchPurchaseOrders();
    } catch (error) {
      showNotification(`Failed to ${confirmAction.type} order`, "error");
    }
    setConfirmAction(null);
  };

  const onSubmit = async (
    data,
    { saveAsDraft = false, allowCreate = true } = {}
  ) => {
    try {
      const formattedLines = (data.lines || []).map((line = {}) => {
        const qtyRolls = sanitizeNumber(line.qtyRolls);
        const ratePerRoll = sanitizeNumber(line.ratePerRoll);
        const lengthMetersPerRoll = sanitizeNumber(line.lengthMetersPerRoll);
        const totalMeters = qtyRolls * lengthMetersPerRoll;
        const lineTotal = totalMeters * ratePerRoll;
        const lineStatus = line.lineStatus || line.status || "Pending";
        const { taxRate: _ignoredTaxRate, ...restLine } = line || {};

        return {
          ...restLine,
          qtyRolls,
          ratePerRoll,
          lengthMetersPerRoll,
          totalMeters,
          lineTotal,
          lineStatus,
        };
      });

      const orderData = {
        ...data,
        supplierId: data.supplierId,
        date: data.date,
        lines: formattedLines,
        notes: data.notes || "",
        saveAsDraft,
      };

      if (selectedOrder) {
        await purchaseService.updatePurchaseOrder(selectedOrder._id, orderData);
        showNotification("Purchase order updated successfully", "success");
      } else if (allowCreate) {
        await purchaseService.createPurchaseOrder(orderData);
        showNotification("Purchase order created successfully", "success");
      }
      setOpenDialog(false);
      fetchPurchaseOrders();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    {
      field: "date",
      headerName: "Date",
      renderCell: (params) => formatDate(params.value),
    },
    { field: "poNumber", headerName: "PO Number" },
    { field: "supplierName", headerName: "Supplier" },
    {
      field: "lines",
      headerName: "Items",
      renderCell: (params) => params.value?.length || 0,
      width: 50,
    },
    {
      field: "totalAmount",
      headerName: "Total Amount",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "totalMeters",
      headerName: "Total Meters",
      renderCell: (params) => params.value ?? 0,
    },
    {
      field: "poStatus",
      headerName: "Status",
      renderCell: (params) => {
        const value =
          params.row?.poStatus || params.row?.status || params.value;
        return (
          <Chip label={value} color={getStatusColor(value)} size="small" />
        );
      },
    },
  ];

  const customActions = [
    {
      icon: <ApproveIcon />,
      label: "Approve",
      onClick: handleApprove,
      show: (row) => (row.poStatus || row.status) === "Draft",
    },
    {
      icon: <CancelIcon />,
      label: "Cancel",
      onClick: handleCancel,
      show: (row) => ["Draft", "Approved"].includes(row.poStatus || row.status),
    },
  ];

  // const totals = calculateTotals();

  return (
    <Box>
      <DataTable
        title="Purchase Orders"
        columns={columns}
        rows={orders}
        onAdd={handleAdd}
        onEdit={handleEdit}
        customActions={customActions}
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullScreen>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6">
              {selectedOrder
                ? `Edit Purchase Order: ${selectedOrder.poNumber}`
                : "Create Purchase Order"}
            </Typography>
            <IconButton onClick={() => setOpenDialog(false)} size="small">
              <CancelIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: 2,
              paddingTop: "20px !important",
            }}
          >
            {/* ── Top section: Order Details + SKU Base Rates ── */}
            <Grid container spacing={2} alignItems="stretch" sx={{ width: "100%" }}>
              {/* Left: Supplier & Date */}
              <Grid item xs={12} md={5}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary"
                    sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
                    Order Details
                  </Typography>
                  <Stack spacing={2}>
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
                    <Controller
                      name="date"
                      control={control}
                      rules={{ required: "Date is required" }}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="Order Date"
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
                  </Stack>
                </Paper>
              </Grid>

              {/* Right: SKU Base Rates for selected supplier */}
              <Grid item xs={12} md={7}>
                <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <Box sx={{ px: 2, py: 1, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary"
                      sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                      SKU Base Rates
                      {selectedSupplierId && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1, fontWeight: 400 }}>
                          — {suppliers.find(s => s._id === selectedSupplierId)?.name || ""}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                  <TableContainer sx={{ flex: 1, maxHeight: 180, overflow: "auto" }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>SKU</TableCell>
                          <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }} align="right">Base Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!selectedSupplierId ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ color: "text.disabled", py: 2 }}>
                              Select a supplier to view rates
                            </TableCell>
                          </TableRow>
                        ) : supplierBaseRates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ color: "text.disabled", py: 2 }}>
                              No SKU rates configured for this supplier
                            </TableCell>
                          </TableRow>
                        ) : (
                          supplierBaseRates.map((br) => (
                            <TableRow key={br._id} hover>
                              <TableCell>{br.skuId?.skuCode || br.skuId?.skuAlias || "—"}</TableCell>
                              <TableCell align="right">{formatCurrency(br.rate)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
              Order Lines
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Leave SKU empty to enter a manual line (category, GSM, quality, width, rate, and quantities).
              Select a SKU to pull details from master data.
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 140 }}>SKU</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>GSM</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Width</TableCell>
                    <TableCell>Base Rate</TableCell>
                    <TableCell>Meters/Roll</TableCell>
                    <TableCell>Roll Quantity</TableCell>
                    <TableCell>Total Meters</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(fields || []).map((field, index) => {
                    const rawSkuId = watchLines?.[index]?.skuId;
                    const lineSkuId = rawSkuId?._id?.toString() || rawSkuId?.toString() || "";
                    const hasSkuSelected = !!lineSkuId;
                    /** Manual line: no master SKU — user types category/GSM/quality/width and rate. */
                    const isManualLine = !hasSkuSelected;
                    const supplierSelected = !!getValues("supplierId");
                    const supplierRate = hasSkuSelected
                      ? supplierBaseRates.find((br) => {
                          const brId = br.skuId?._id?.toString() || br.skuId?.toString() || "";
                          return brId === lineSkuId;
                        })
                      : null;
                    const hasSupplierRate = !!supplierRate;

                    return (
                    <TableRow key={field.id}>
                      <TableCell sx={{ minWidth: 300 }}>
                        <Controller
                          name={`lines.${index}.skuId`}
                          control={control}
                          render={({ field }) => (
                            <Autocomplete
                              {...buildSingleSelectAutocompleteProps(
                                skuOptions,
                                field.value,
                                (value) => {
                                  setAddingRateForLine(null);
                                  setNewRateValue("");
                                  handleSKUChange(index, value);
                                }
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
                          name={`lines.${index}.categoryName`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              size="small"
                              disabled={hasSkuSelected}
                              placeholder={isManualLine ? "e.g. Sublimation" : ""}
                              title={
                                isManualLine
                                  ? "Manual line: type category, or pick a SKU above to use master data."
                                  : "From SKU master"
                              }
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.gsm`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              size="small"
                              disabled={hasSkuSelected}
                              placeholder={isManualLine ? "GSM" : ""}
                              title={isManualLine ? "Manual GSM" : "From SKU master"}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.qualityName`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              size="small"
                              disabled={hasSkuSelected}
                              placeholder={isManualLine ? "Quality" : ""}
                              title={isManualLine ? "Manual quality" : "From SKU master"}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.widthInches`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              type="number"
                              size="small"
                              disabled={hasSkuSelected}
                              placeholder={isManualLine ? "Width" : ""}
                              title={isManualLine ? "Manual width (inches)" : "From SKU master"}
                              inputProps={{ min: 0, step: "any" }}
                            />
                          )}
                        />
                      </TableCell>

                      {/* Base Rate: editable for manual lines; for SKU lines, optional supplier base-rate save flow */}
                      <TableCell sx={{ minWidth: 160 }}>
                        {isManualLine ? (
                          <Controller
                            name={`lines.${index}.ratePerRoll`}
                            control={control}
                            render={({ field }) => (
                              <NumericFormat
                                {...field}
                                customInput={TextField}
                                size="small"
                                thousandSeparator=","
                                decimalScale={2}
                                sx={{ width: 110 }}
                                placeholder="Rate"
                                title="Rate per roll for this manual line"
                              />
                            )}
                          />
                        ) : addingRateForLine === index ? (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TextField
                              size="small"
                              type="number"
                              value={newRateValue}
                              onChange={(e) => setNewRateValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveSkuRate(index);
                                if (e.key === "Escape") { setAddingRateForLine(null); setNewRateValue(""); }
                              }}
                              autoFocus
                              placeholder="Rate"
                              sx={{ width: 90 }}
                              inputProps={{ min: 0, step: "any" }}
                            />
                            <Tooltip title="Save as supplier base rate">
                              <IconButton size="small" color="primary" onClick={() => handleSaveSkuRate(index)}>
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => { setAddingRateForLine(null); setNewRateValue(""); }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Controller
                              name={`lines.${index}.ratePerRoll`}
                              control={control}
                              render={({ field }) => (
                                <NumericFormat
                                  {...field}
                                  customInput={TextField}
                                  size="small"
                                  thousandSeparator=","
                                  decimalScale={2}
                                  sx={{ width: 110 }}
                                />
                              )}
                            />
                            {!hasSupplierRate && (
                              <Tooltip title="No supplier base rate — click to save current rate as base rate">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    const currentRate = getValues(`lines.${index}.ratePerRoll`);
                                    setNewRateValue(String(sanitizeNumber(currentRate) || ""));
                                    setAddingRateForLine(index);
                                  }}
                                >
                                  <WarningIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.lengthMetersPerRoll`}
                          control={control}
                          render={({ field }) => (
                            <TextField {...field} type="number" size="small" />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.qtyRolls`}
                          control={control}
                          render={({ field }) => (
                            <TextField {...field} type="number" size="small" />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={
                            sanitizeNumber(watchLines?.[index]?.qtyRolls) *
                            sanitizeNumber(
                              watchLines?.[index]?.lengthMetersPerRoll
                            )
                          }
                          size="small"
                          disabled
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatCurrency(
                            sanitizeNumber(watchLines?.[index]?.qtyRolls) *
                              sanitizeNumber(
                                watchLines?.[index]?.lengthMetersPerRoll
                              ) *
                              sanitizeNumber(watchLines?.[index]?.ratePerRoll)
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.lineStatus`}
                          control={control}
                          render={({ field }) => (
                            <Typography variant="body2">
                              {field.value || "Pending"}
                            </Typography>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        {fields.length > 1 && (
                          <IconButton
                            size="small"
                            onClick={() => remove(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  <TableRow sx={{ fontWeight: 600, bgcolor: "grey.100" }}>
                    <TableCell colSpan={8}>Totals</TableCell>
                    <TableCell>
                      {formatNumber(lineTotals.totalMeters)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(lineTotals.totalAmount)}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Button
              startIcon={<AddIcon />}
              onClick={() =>
                append({
                  skuId: "",
                  categoryName: "",
                  gsm: "",
                  qualityName: "",
                  widthInches: "",
                  lengthMetersPerRoll: 0,
                  qtyRolls: 0,
                  ratePerRoll: 0,
                  totalMeters: 0,
                  lineTotal: 0,
                  lineStatus: "Pending",
                })
              }
              sx={{ mt: 1 }}
            >
              Add Line
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
              <Grid item xs={12} md={4}></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              onClick={handleSubmit((formData) =>
                onSubmit(formData, { saveAsDraft: true, allowCreate: true })
              )}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={handleSubmit((formData) =>
                onSubmit(formData, { saveAsDraft: false, allowCreate: true })
              )}
            >
              {selectedOrder ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
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

export default PurchaseOrders;

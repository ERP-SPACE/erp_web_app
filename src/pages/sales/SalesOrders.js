import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
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
  Alert,
  Tooltip,
  InputBase,
  Stack,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as ConfirmIcon,
  Cancel as CancelIcon,
  CreditCard as CreditCheckIcon,
  Calculate as CalculateIcon,
  Warning as WarningIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CallSplit as BifurcateIcon,
} from "@mui/icons-material";
import LinearProgress from "@mui/material/LinearProgress";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useApp } from "../../contexts/AppContext";
import salesService from "../../services/salesService";
import masterService from "../../services/masterService";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
} from "../../utils/formatters";

const SalesOrders = () => {
  const { showNotification, setLoading } = useApp();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [skus, setSKUs] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [creditCheckResult, setCreditCheckResult] = useState(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [customerRates, setCustomerRates] = useState([]);
  const [addingRateForLine, setAddingRateForLine] = useState(null);
  const [newRateValue, setNewRateValue] = useState("");
  const [bifurcationDialog, setBifurcationDialog] = useState({
    open: false,
    lineIndex: null,
    targetMeters: 0,
    groups: [],
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customerId: "",
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
          overrideRatePerRoll: null,
          lineTotal: 0,
        },
      ],
      discountPercent: 0,
      dueDays: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  // Prevents the watchCustomerId effect from overriding dueDays when
  // opening an existing order (edit / view) via reset()
  const skipDueDaysAutoSetRef = useRef(false);

  const formatDisplayValue = useCallback((val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string" || typeof val === "number") return val;
    if (typeof val === "object") {
      return (
        val.companyName ||
        val.name ||
        val.value ||
        val.label ||
        val.title ||
        val.customerCode ||
        val.code ||
        val._id ||
        ""
      );
    }
    return "";
  }, []);

  const normalizeTaxRate = useCallback((tax) => {
    const raw =
      (tax && typeof tax === "object" && (tax.value ?? tax.rate)) ?? tax ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const normalizeId = useCallback((val) => {
    if (val && typeof val === "object") {
      return val._id || val.id || val.value || "";
    }
    return val || "";
  }, []);

  const toNumber = useCallback((val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const normalizeLine = useCallback(
    (line = {}) => ({
      ...line,
      skuId: normalizeId(line.skuId),
      totalMeters: (line.totalMeters != null ? line.totalMeters : null) ?? ((toNumber(line.lengthMetersPerRoll) * toNumber(line.qtyRolls)) || 0),
      bifurcations: Array.isArray(line.bifurcations) ? line.bifurcations : [],
    }),
    [normalizeId, toNumber]
  );

  const watchCustomerId = watch("customerId");
  const watchLines = watch("lines");
  const watchDiscountPercent = watch("discountPercent");

  const pendingLimit = useMemo(() => {
    const limit =
      creditCheckResult?.creditLimit ??
      selectedCustomer?.creditPolicy?.creditLimit ??
      0;
    const exposure = creditCheckResult?.exposure ?? 0;
    return limit - exposure;
  }, [creditCheckResult, selectedCustomer]);

  useEffect(() => {
    fetchSalesOrders();
    fetchCustomers();
    fetchSKUs();
  }, []);

  useEffect(() => {
    if (watchCustomerId) {
      const customer = customers.find((c) => c._id === watchCustomerId);
      setSelectedCustomer(customer);
      checkCustomerCredit(watchCustomerId);
      fetchCustomerRates(watchCustomerId);
      if (!skipDueDaysAutoSetRef.current) {
        const days =
          (customer?.creditPolicy?.creditDays || 0) +
          (customer?.creditPolicy?.graceDays || 0);
        setValue("dueDays", days);
      }
      skipDueDaysAutoSetRef.current = false;
    }
  }, [watchCustomerId, customers]);

  const fetchSalesOrders = async () => {
    setLoading(true);
    try {
      const response = await salesService.getSalesOrders();
      setOrders(response.data);
    } catch (error) {
      showNotification("Failed to fetch sales orders", "error");
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

  const fetchSKUs = async () => {
    try {
      const response = await masterService.getSKUs({ active: true, limit: 1000 });
      setSKUs(response.skus || []);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
    }
  };

  const checkCustomerCredit = async (customerId) => {
    try {
      const response = await masterService.checkCredit(customerId);
      setCreditCheckResult(response.data);
      if (response.data.blocked) {
        showNotification("Warning: Customer credit blocked!", "warning");
      }
    } catch (error) {
      console.error("Credit check failed:", error);
    }
  };

  const fetchCustomerRates = async (customerId) => {
    try {
      const rates = await masterService.getCustomerRates(customerId);
      setCustomerRates(Array.isArray(rates) ? rates : []);
    } catch (error) {
      console.error("Failed to fetch customer rates:", error);
      setCustomerRates([]);
    }
  };

  const skuById = useMemo(() => {
    const map = {};
    (skus || []).forEach((s) => {
      if (s?._id) map[s._id] = s;
    });
    return map;
  }, [skus]);

  // Find the SKU-specific rate for a line directly by skuId.
  const findRateForSku = useCallback(
    (skuId) => {
      const id = String(normalizeId(skuId) || "");
      if (!id || !customerRates.length) return null;
      return customerRates.find((r) => {
        const rateSkuId = String(normalizeId(r.skuId?._id ?? r.skuId) || "");
        return rateSkuId === id;
      }) || null;
    },
    [customerRates, normalizeId]
  );

  const getLineBaseRate = useCallback(
    (line) => {
      const match = findRateForSku(line?.skuId);
      if (match) return toNumber(match.baseRate);
      return toNumber(selectedCustomer?.baseRate44);
    },
    [findRateForSku, toNumber, selectedCustomer]
  );

  // Returns the customerRate record for this line's SKU, or null.
  const getSkuRateMatch = useCallback(
    (line) => findRateForSku(line?.skuId),
    [findRateForSku]
  );

  const handleSaveSkuRate = useCallback(
    async (lineIndex) => {
      const line = watchLines[lineIndex];
      const skuId = normalizeId(line?.skuId);
      if (!skuId || !selectedCustomer) return;
      const rate = Number(newRateValue);
      if (!rate || rate <= 0) {
        showNotification("Please enter a valid rate", "warning");
        return;
      }
      try {
        await masterService.setCustomerRate(selectedCustomer._id, {
          skuId,
          baseRate: rate,
        });
        showNotification("Base rate added successfully", "success");
        await fetchCustomerRates(selectedCustomer._id);
        setAddingRateForLine(null);
        setNewRateValue("");
      } catch (err) {
        showNotification(err?.message || "Failed to save rate", "error");
      }
    },
    [watchLines, selectedCustomer, newRateValue, fetchCustomerRates, normalizeId, showNotification]
  );

  const resolveTaxRate = useCallback(
    (line) => {
      const sku = skuById[normalizeId(line?.skuId)] || {};
      return normalizeTaxRate(sku.taxRate);
    },
    [skuById, normalizeId, normalizeTaxRate]
  );

  // Calculate pricing for a single line.
  // With SKU-based rates the baseRate is already width-specific — no further scaling needed.
  const calculateLinePrice = useCallback(
    (line, baseRate, discountPercent) => {
      const rate = toNumber(baseRate);
      // Use explicitly stored totalMeters (from direct input or bifurcation) when available
      const totalMeters =
        toNumber(line?.totalMeters) ||
        toNumber(line?.lengthMetersPerRoll) * toNumber(line?.qtyRolls);
      const lineTotal = totalMeters * rate;

      const hasOverride =
        line?.overrideRatePerRoll !== null &&
        line?.overrideRatePerRoll !== undefined &&
        line?.overrideRatePerRoll !== "";
      const finalRate = hasOverride ? toNumber(line?.overrideRatePerRoll) : rate;

      const taxRate = resolveTaxRate(line);

      return {
        derivedRate: rate,
        finalRate,
        taxRate,
        lineTotal,
      };
    },
    [resolveTaxRate, toNumber]
  );

  const computeTotals = useCallback(
    (lines = [], discountPercent = 0) => {
      let subtotal = 0;
      const discountAmount = 0;
      const taxAmount = 0;

      lines.forEach((line) => {
        const effectiveMeters =
          toNumber(line?.totalMeters) ||
          (toNumber(line?.lengthMetersPerRoll) * toNumber(line?.qtyRolls));
        if (effectiveMeters > 0) {
          subtotal += effectiveMeters * getLineBaseRate(line);
        }
      });

      return {
        subtotal,
        discountAmount,
        taxAmount,
        total: subtotal,
      };
    },
    [toNumber, getLineBaseRate]
  );

  const [totals, setTotals] = useState({
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
  });

  useEffect(() => {
    const subscription = watch((value) => {
      setTotals(computeTotals(value?.lines || [], value?.discountPercent));
    });

    return () => subscription.unsubscribe();
  }, [watch, computeTotals]);

  useEffect(() => {
    setTotals(computeTotals(watchLines, watchDiscountPercent));
  }, [watchLines, watchDiscountPercent, computeTotals]);

  const deriveSkuFields = useCallback(
    (line) => {
      const skuObj =
        line.skuId && typeof line.skuId === "object"
          ? line.skuId
          : skuById[normalizeId(line.skuId)];
      if (!skuObj) return {};
      const product = skuObj.productId || skuObj.product;
      return {
        categoryName:
          product?.categoryId?.name ||
          product?.category?.name ||
          skuObj.categoryName ||
          "",
        gsm:
          product?.gsmId?.name ||
          product?.gsmId?.value?.toString() ||
          (typeof skuObj.gsm === "object"
            ? skuObj.gsm?.name || skuObj.gsm?.value?.toString() || ""
            : skuObj.gsm) ||
          "",
        qualityName:
          product?.qualityId?.name ||
          product?.quality?.name ||
          skuObj.qualityName ||
          "",
        widthInches: skuObj.widthInches,
      };
    },
    [skuById, normalizeId]
  );

  const handleView = (row) => {
    setSelectedOrder(row);
    setViewMode(true);
    const customer = customers.find((c) => c._id === normalizeId(row.customerId));
    setSelectedCustomer(customer || null);
    setCreditCheckResult(null);
    setCustomerRates([]);
    fetchCustomerRates(normalizeId(row.customerId));
    skipDueDaysAutoSetRef.current = true;
    reset({
      customerId: normalizeId(row.customerId),
      date: new Date(row.date),
      dueDays:
        row.dueDays ??
        (customer?.creditPolicy?.creditDays || 0) +
          (customer?.creditPolicy?.graceDays || 0),
      lines: (row.lines || []).map((line) => {
        const derived = deriveSkuFields(line);
        return normalizeLine({
          ...line,
          skuId: normalizeId(line.skuId),
          categoryName: line.categoryName || derived.categoryName || "",
          gsm: line.gsm || derived.gsm || "",
          qualityName: line.qualityName || derived.qualityName || "",
          widthInches: line.widthInches || derived.widthInches || "",
        });
      }),
      discountPercent: row.discountPercent || 0,
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const handleAdd = () => {
    setSelectedOrder(null);
    setViewMode(false);
    setSelectedCustomer(null);
    setCreditCheckResult(null);
    setCustomerRates([]);
    reset({
      customerId: "",
      date: new Date(),
      dueDays: 0,
      lines: [
        normalizeLine({
          skuId: "",
          categoryName: "",
          gsm: "",
          qualityName: "",
          widthInches: "",
          lengthMetersPerRoll: 0,
          qtyRolls: 0,
          overrideRatePerRoll: null,
          lineTotal: 0,
        }),
      ],
      discountPercent: 0,
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    if (row.status !== "Draft") {
      showNotification("Can only edit draft orders", "warning");
      return;
    }
    setSelectedOrder(row);
    setViewMode(false);
    setCustomerRates([]);
    fetchCustomerRates(normalizeId(row.customerId));
    skipDueDaysAutoSetRef.current = true;
    const editCustomer = customers.find((c) => c._id === normalizeId(row.customerId));
    reset({
      customerId: normalizeId(row.customerId),
      date: new Date(row.date),
      dueDays:
        row.dueDays ??
        (editCustomer?.creditPolicy?.creditDays || 0) +
          (editCustomer?.creditPolicy?.graceDays || 0),
      lines: (row.lines || []).map((line) => {
        const derived = deriveSkuFields(line);
        return normalizeLine({
          ...line,
          skuId: normalizeId(line.skuId),
          categoryName: line.categoryName || derived.categoryName || "",
          gsm: line.gsm || derived.gsm || "",
          qualityName: line.qualityName || derived.qualityName || "",
          widthInches: line.widthInches || derived.widthInches || "",
        });
      }),
      discountPercent: row.discountPercent || 0,
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const handleSKUChange = (index, skuId) => {
    const sku = skus.find((s) => s._id === skuId);
    if (sku) {
      const currentLine = watchLines[index] || {};
      const product = sku.productId || sku.product; // Handle both populated and direct reference
      const defaultLength =
        product?.defaultLengthMeters ?? sku.lengthMetersPerRoll ?? "";

      const categoryName =
        product?.categoryId?.name ||
        product?.category?.name ||
        sku.categoryName ||
        "";
      const gsm =
        product?.gsmId?.name ||
        product?.gsmId?.value?.toString() ||
        (typeof sku.gsm === "object"
          ? sku.gsm?.name || sku.gsm?.value?.toString() || ""
          : sku.gsm) ||
        "";
      const qualityName =
        product?.qualityId?.name ||
        product?.quality?.name ||
        sku.qualityName ||
        "";

      const updatedLine = normalizeLine({
        ...currentLine,
        skuId: skuId,
        categoryName,
        gsm,
        qualityName,
        widthInches: sku.widthInches,
        lengthMetersPerRoll: defaultLength,
        totalMeters: 0,
        bifurcations: [],
      });

      // Calculate pricing (lineTotal) using product-specific rate
      const pricing = calculateLinePrice(
        updatedLine,
        getLineBaseRate(updatedLine),
        watchDiscountPercent
      );

      setValue(`lines.${index}`, {
        ...updatedLine,
        lineTotal: pricing.lineTotal,
      });
    }
  };

  const handleQtyChange = (index, qty) => {
    const line = watchLines[index] || {};
    const length = toNumber(line.lengthMetersPerRoll);
    const newTotalMeters = toNumber(qty) * length;
    const updatedLine = { ...line, qtyRolls: qty, totalMeters: newTotalMeters, bifurcations: [] };
    setValue(`lines.${index}.qtyRolls`, qty);
    setValue(`lines.${index}.totalMeters`, newTotalMeters);
    setValue(`lines.${index}.bifurcations`, []);

    const pricing = calculateLinePrice(updatedLine, getLineBaseRate(updatedLine), watchDiscountPercent);
    setValue(`lines.${index}.lineTotal`, pricing.lineTotal);
  };

  const handleTotalMetersChange = (index, value) => {
    const totalM = toNumber(value);
    const line = watchLines[index] || {};
    const length = toNumber(line.lengthMetersPerRoll) || 1;
    const derivedQty = Math.round(totalM / length);
    const updatedLine = { ...line, totalMeters: totalM, qtyRolls: derivedQty, bifurcations: [] };
    setValue(`lines.${index}.totalMeters`, totalM);
    setValue(`lines.${index}.qtyRolls`, derivedQty);
    setValue(`lines.${index}.bifurcations`, []);
    const pricing = calculateLinePrice(updatedLine, getLineBaseRate(updatedLine), watchDiscountPercent);
    setValue(`lines.${index}.lineTotal`, pricing.lineTotal);
  };

  const handleOpenBifurcation = (index) => {
    const line = watchLines[index] || {};
    const length = toNumber(line.lengthMetersPerRoll) || 1000;
    const totalM = toNumber(line.totalMeters) || toNumber(line.lengthMetersPerRoll) * toNumber(line.qtyRolls);
    const existingGroups = Array.isArray(line.bifurcations) && line.bifurcations.length > 0
      ? line.bifurcations
      : [{ qty: toNumber(line.qtyRolls) || Math.ceil(totalM / length), lengthMeters: length }];
    setBifurcationDialog({ open: true, lineIndex: index, targetMeters: totalM, groups: existingGroups });
  };

  const handleBifurcationSave = () => {
    const { lineIndex, groups } = bifurcationDialog;
    const sumMeters = groups.reduce((s, g) => s + toNumber(g.qty) * toNumber(g.lengthMeters), 0);
    const totalQty = groups.reduce((s, g) => s + toNumber(g.qty), 0);
    const line = watchLines[lineIndex] || {};
    setValue(`lines.${lineIndex}.bifurcations`, groups);
    setValue(`lines.${lineIndex}.totalMeters`, sumMeters);
    setValue(`lines.${lineIndex}.qtyRolls`, totalQty);
    const updatedLine = { ...line, bifurcations: groups, totalMeters: sumMeters, qtyRolls: totalQty };
    const pricing = calculateLinePrice(updatedLine, getLineBaseRate(updatedLine), watchDiscountPercent);
    setValue(`lines.${lineIndex}.lineTotal`, pricing.lineTotal);
    setBifurcationDialog({ open: false, lineIndex: null, targetMeters: 0, groups: [] });
  };

  const handleOverrideRateChange = (index, overrideRate) => {
    setValue(`lines.${index}.overrideRatePerRoll`, overrideRate);

    const line = { ...watchLines[index], overrideRatePerRoll: overrideRate };
    const pricing = calculateLinePrice(
      line,
      getLineBaseRate(line),
      watchDiscountPercent
    );
    setValue(`lines.${index}.lineTotal`, pricing.lineTotal);
  };

  const handleConfirm = (row) => {
    setSelectedOrder(row);
    setConfirmAction({
      type: "confirm",
      message: "Are you sure you want to confirm this order?",
    });
  };

  const handleCancel = (row) => {
    setSelectedOrder(row);
    setConfirmAction({
      type: "cancel",
      message: "Are you sure you want to cancel this order?",
    });
  };

  const confirmActionHandler = async () => {
    try {
      switch (confirmAction.type) {
        case "confirm":
          await salesService.confirmSalesOrder(selectedOrder._id);
          showNotification("Sales order confirmed successfully", "success");
          break;
        case "cancel":
          await salesService.cancelSalesOrder(selectedOrder._id);
          showNotification("Sales order cancelled successfully", "success");
          break;
      }
      fetchSalesOrders();
    } catch (error) {
      showNotification(`Failed to ${confirmAction.type} order`, "error");
    }
    setConfirmAction(null);
  };

  const onSubmit = async (data) => {
    try {
      if (creditCheckResult?.blocked) {
        showNotification(
          "Cannot create order - Customer credit blocked",
          "error"
        );
        return;
      }

      // Calculate final values for each line using product-specific base rate
      const processedLines = data.lines.map((line) => {
        if (selectedCustomer && line.widthInches) {
          const lineBaseRate = getLineBaseRate(line);
          const pricing = calculateLinePrice(line, lineBaseRate, data.discountPercent);
          return {
            ...normalizeLine(line),
            lineTotal: pricing.lineTotal,
            totalMeters: line.lengthMetersPerRoll * line.qtyRolls,
          };
        }
        return normalizeLine(line);
      });

      const finalTotals = computeTotals(processedLines, data.discountPercent);

      const orderData = {
        ...data,
        lines: processedLines,
        ...finalTotals,
        creditCheckPassed: !creditCheckResult?.blocked,
        creditCheckNotes: creditCheckResult?.reasons?.join("; "),
      };

      if (selectedOrder) {
        await salesService.updateSalesOrder(selectedOrder._id, orderData);
        showNotification("Sales order updated successfully", "success");
      } else {
        await salesService.createSalesOrder(orderData);
        showNotification("Sales order created successfully", "success");
      }
      setOpenDialog(false);
      fetchSalesOrders();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "soNumber", headerName: "SO Number" },
    {
      field: "customerName",
      headerName: "Customer",
      flex: 1,
      renderCell: (params) => {
        return formatDisplayValue(params.value);
      },
    },
    {
      field: "date",
      headerName: "Date",
      renderCell: (params) => {
        const val = formatDisplayValue(params.value);
        return formatDate(val);
      },
    },
    {
      field: "status",
      headerName: "Status",
      renderCell: (params) => {
        const statusLabel = formatDisplayValue(params.value);
        return (
          <Chip
            label={statusLabel}
            color={getStatusColor(statusLabel)}
            size="small"
          />
        );
      },
    },
    {
      field: "creditCheckPassed",
      headerName: "Credit",
      renderCell: (params) => {
        const passed = Boolean(params.value);
        const label = passed ? "Credit check passed" : "Credit check blocked";
        return (
          <Tooltip title={label} arrow>
            {passed ? (
              <ConfirmIcon color="success" />
            ) : (
              <WarningIcon color="error" />
            )}
          </Tooltip>
        );
      },
    },
    {
      field: "total",
      headerName: "Total Amount",
      renderCell: (params) => {
        const order = params.row;
        // Use stored total; fall back to summing per-line stored lineTotals
        const total =
          toNumber(order.total) ||
          (order.lines || []).reduce(
            (sum, line) => sum + toNumber(line.lineTotal),
            0
          );
        return formatCurrency(total);
      },
    },
  ];

  const customActions = [
    {
      icon: <ConfirmIcon />,
      label: "Confirm",
      onClick: handleConfirm,
      show: (row) => row.status === "Draft",
    },
    {
      icon: <CancelIcon />,
      label: "Cancel",
      onClick: handleCancel,
      show: (row) => ["Draft", "Confirmed"].includes(row.status),
    },
  ];

  return (
    <Box>
      <DataTable
        title="Sales Orders"
        columns={columns}
        rows={orders}
        onAdd={handleAdd}
        onView={handleView}
        onEdit={handleEdit}
        customActions={customActions.filter(
          (action) => !action.show || action.show
        )}
      />

      <Dialog
        open={openDialog}
        onClose={() => { setOpenDialog(false); setViewMode(false); setCustomerRates([]); }}
        maxWidth="xl"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {viewMode
              ? `View Sales Order: ${selectedOrder?.soNumber}`
              : selectedOrder
              ? `Edit Sales Order: ${selectedOrder.soNumber}`
              : "Add Sales Order"}
          </DialogTitle>
          <DialogContent>
            {/* ── Two-column header ── */}
            <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>

              {/* Part 1 — Customer info */}
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  {/* Customer + Date */}
                  <Controller
                    name="customerId"
                    control={control}
                    rules={{ required: "Customer is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        fullWidth
                        size="small"
                        label="Customer"
                        error={!!errors.customerId}
                        helperText={errors.customerId?.message}
                        inputProps={{ readOnly: viewMode }}
                        disabled={viewMode}
                      >
                        {customers.map((customer) => (
                          <MenuItem key={customer._id} value={customer._id}>
                            {customer.companyName || customer.customerCode || "Customer"}{" "}
                            ({customer.customerCode || "N/A"})
                          </MenuItem>
                        ))}
                      </TextField>
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
                        disabled={viewMode}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            size="small"
                            error={!!errors.date}
                            helperText={errors.date?.message}
                          />
                        )}
                      />
                    )}
                  />

                  {/* Credit info — 2×2 grid */}
                  {selectedCustomer && (
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        bgcolor: "grey.50",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Grid container rowSpacing={1.5} columnSpacing={2}>
                        {[
                          {
                            label: "Credit Limit",
                            value: formatCurrency(
                              selectedCustomer.creditPolicy?.creditLimit || 0
                            ),
                          },
                          {
                            label: "Outstanding",
                            value: formatCurrency(pendingLimit),
                          },
                          {
                            label: "Customer Group",
                            value:
                              selectedCustomer.customerGroupId?.name ||
                              selectedCustomer.customerGroup?.name ||
                              "—",
                          },
                        ].map((stat) => (
                          <Grid item xs={6} key={stat.label}>
                            <Typography variant="caption" color="text.disabled" display="block">
                              {stat.label}
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {stat.value}
                            </Typography>
                          </Grid>
                        ))}

                        {/* Due Days — editable */}
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.disabled" display="block">
                            Due Days
                          </Typography>
                          {viewMode ? (
                            <Typography variant="body2" fontWeight={500}>
                              {watch("dueDays") ?? 0} days
                            </Typography>
                          ) : (
                            <Controller
                              name="dueDays"
                              control={control}
                              render={({ field }) => (
                                <Stack direction="row" alignItems="baseline" spacing={0.5}>
                                  <InputBase
                                    {...field}
                                    type="number"
                                    inputProps={{ min: 0 }}
                                    onChange={(e) =>
                                      field.onChange(Number(e.target.value))
                                    }
                                    sx={{
                                      width: 44,
                                      "& input": {
                                        p: 0,
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        color: "text.primary",
                                        borderBottom: "1px solid",
                                        borderColor: "text.disabled",
                                      },
                                    }}
                                  />
                                  <Typography variant="body2" color="text.secondary">
                                    days
                                  </Typography>
                                </Stack>
                              )}
                            />
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Credit check alert */}
                  {creditCheckResult && (
                    <Alert
                      severity={creditCheckResult.blocked ? "error" : "success"}
                      action={
                        <Button size="small" onClick={() => setShowCreditDialog(true)}>
                          Details
                        </Button>
                      }
                    >
                      {creditCheckResult.blocked
                        ? "Customer credit blocked!"
                        : "Credit check passed"}
                    </Alert>
                  )}
                </Stack>
              </Grid>

              {/* Part 2 — Product-wise base rates */}
              <Grid item xs={12} md={7}>
                <Box
                  sx={{
                    height: "100%",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box sx={{ px: 2, py: 1, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                      SKU Base Rates
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 220, overflow: "auto", flex: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>SKU</TableCell>
                          <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }} align="right">Base Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customerRates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ color: "text.disabled", py: 3 }}>
                              {selectedCustomer
                                ? "No rates configured for this customer"
                                : "Select a customer to view rates"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          customerRates.map((rate) => (
                            <TableRow key={rate._id} hover>
                              <TableCell>
                                {rate.skuId?.skuCode ||
                                  rate.skuId?.skuAlias ||
                                  "—"}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(rate.baseRate)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
              Order Lines
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>GSM</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Width"</TableCell>
                    <TableCell>Length/Roll</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Base Rate</TableCell>
                    <TableCell>Total Meters</TableCell>
                    <TableCell>Rate</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = watchLines[index] || {};
                    const skuRateMatch = getSkuRateMatch(line);
                    const hasSkuSelected = !!normalizeId(line?.skuId);
                    const baseRate = getLineBaseRate(line);
                    const pricing = calculateLinePrice(
                      line,
                      baseRate,
                      watchDiscountPercent
                    );
                    const effectiveTotalMeters =
                      toNumber(line.totalMeters) ||
                      toNumber(line.lengthMetersPerRoll) * toNumber(line.qtyRolls);
                    const hasBifurcation =
                      Array.isArray(line.bifurcations) && line.bifurcations.length > 0;

                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Controller
                            name={`lines.${index}.skuId`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                select
                                size="small"
                                fullWidth
                                disabled={viewMode}
                                onChange={(e) =>
                                  handleSKUChange(index, e.target.value)
                                }
                              >
                                <MenuItem value="">Select</MenuItem>
                                {skus.map((sku) => (
                                  <MenuItem key={sku._id} value={sku._id}>
                                    {sku.skuCode}
                                  </MenuItem>
                                ))}
                              </TextField>
                            )}
                          />
                        </TableCell>
                        <TableCell>{formatDisplayValue(line?.categoryName)}</TableCell>
                        <TableCell>{formatDisplayValue(line?.gsm)}</TableCell>
                        <TableCell>{formatDisplayValue(line?.qualityName)}</TableCell>
                        <TableCell>{formatDisplayValue(line?.widthInches)}</TableCell>
                        <TableCell>
                          <Controller
                            name={`lines.${index}.lengthMetersPerRoll`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                type="number"
                                size="small"
                                sx={{ width: 80 }}
                                disabled={viewMode}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`lines.${index}.qtyRolls`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                type="number"
                                size="small"
                                sx={{ width: 60 }}
                                disabled={viewMode}
                                onChange={(e) =>
                                  handleQtyChange(index, e.target.value)
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 130 }}>
                          {!hasSkuSelected ? (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          ) : skuRateMatch ? (
                            <Typography variant="body2">
                              {formatCurrency(skuRateMatch.baseRate)}
                            </Typography>
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
                                sx={{ width: 80 }}
                                inputProps={{ min: 0, step: "any" }}
                              />
                              <Tooltip title="Save rate">
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
                            <Tooltip title="No SKU rate found. Click to add.">
                              <Box
                                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: viewMode ? "default" : "pointer" }}
                                onClick={() => {
                                  if (!viewMode) { setAddingRateForLine(index); setNewRateValue(""); }
                                }}
                              >
                                <WarningIcon sx={{ fontSize: 14, color: "warning.main" }} />
                                <Typography variant="caption" color="warning.main">
                                  {viewMode ? "No rate" : "Add rate"}
                                </Typography>
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {viewMode ? (
                              <Typography variant="body2">
                                {effectiveTotalMeters.toLocaleString()}
                                {hasBifurcation && (
                                  <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 0.5 }}>
                                    ({line.bifurcations.length} groups)
                                  </Typography>
                                )}
                              </Typography>
                            ) : (
                              <TextField
                                size="small"
                                type="number"
                                value={effectiveTotalMeters || ""}
                                onChange={(e) => handleTotalMetersChange(index, e.target.value)}
                                sx={{ width: 90 }}
                                inputProps={{ min: 0, step: 1 }}
                                disabled={!hasSkuSelected}
                              />
                            )}
                            {hasSkuSelected && (
                              <Tooltip title={hasBifurcation ? `${line.bifurcations.length} groups configured` : "Set bifurcation"}>
                                <IconButton
                                  size="small"
                                  color={hasBifurcation ? "primary" : "default"}
                                  onClick={() => handleOpenBifurcation(index)}
                                >
                                  <BifurcateIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`lines.${index}.overrideRatePerRoll`}
                            control={control}
                            render={({ field }) => (
                              <NumericFormat
                                {...field}
                                customInput={TextField}
                                size="small"
                                thousandSeparator=","
                                decimalScale={2}
                                sx={{ width: 100 }}
                                placeholder="Optional"
                                disabled={viewMode}
                                onValueChange={(values) =>
                                  handleOverrideRateChange(
                                    index,
                                    values.floatValue
                                  )
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(formatDisplayValue(pricing.lineTotal))}
                        </TableCell>
                        <TableCell>
                          {!viewMode && fields.length > 1 && (
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
                </TableBody>
              </Table>
            </TableContainer>

            {!viewMode && (
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
                    totalMeters: 0,
                    bifurcations: [],
                    overrideRatePerRoll: null,
                    lineTotal: 0,
                  })
                }
                sx={{ mt: 1 }}
              >
                Add Line
              </Button>
            )}

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={2}
                      disabled={viewMode}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Subtotal: {formatCurrency(totals.subtotal)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Discount: {formatCurrency(totals.discountAmount)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Tax: {formatCurrency(totals.taxAmount)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6">
                    Total: {formatCurrency(totals.total)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setOpenDialog(false); setViewMode(false); }}>
              {viewMode ? "Close" : "Cancel"}
            </Button>
            {!viewMode && (
              <Button
                type="submit"
                variant="contained"
                disabled={creditCheckResult?.blocked}
              >
                {selectedOrder ? "Update" : "Create"}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* Bifurcation Dialog */}
      {bifurcationDialog.open && (() => {
        const { targetMeters, groups } = bifurcationDialog;
        const sumMeters = groups.reduce((s, g) => s + toNumber(g.qty) * toNumber(g.lengthMeters), 0);
        const remaining = targetMeters - sumMeters;
        const progress = targetMeters > 0 ? Math.min((sumMeters / targetMeters) * 100, 100) : 0;
        const isExact = Math.abs(remaining) < 0.01;

        const updateGroup = (i, field, value) => {
          const updated = groups.map((g, idx) => idx === i ? { ...g, [field]: toNumber(value) } : g);
          setBifurcationDialog((prev) => ({ ...prev, groups: updated }));
        };
        const addGroup = () => {
          const suggestedLength = groups[0]?.lengthMeters || toNumber((watchLines[bifurcationDialog.lineIndex] || {}).lengthMetersPerRoll) || 1000;
          const suggestedQty = remaining > 0 ? Math.max(1, Math.floor(remaining / suggestedLength)) : 1;
          setBifurcationDialog((prev) => ({ ...prev, groups: [...prev.groups, { qty: suggestedQty, lengthMeters: suggestedLength }] }));
        };
        const removeGroup = (i) => setBifurcationDialog((prev) => ({ ...prev, groups: prev.groups.filter((_, idx) => idx !== i) }));

        return (
          <Dialog
            open
            onClose={() => setBifurcationDialog({ open: false, lineIndex: null, targetMeters: 0, groups: [] })}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  Roll Bifurcation
                  <Typography variant="caption" display="block" color="text.secondary">
                    Target: {targetMeters.toLocaleString()} m
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color={isExact ? "success.main" : remaining > 0 ? "warning.main" : "error.main"} fontWeight={600}>
                    {isExact ? "✓ Matched" : remaining > 0 ? `${remaining.toLocaleString()} m remaining` : `${Math.abs(remaining).toLocaleString()} m over`}
                  </Typography>
                </Stack>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{sumMeters.toLocaleString()} / {targetMeters.toLocaleString()} m</Typography>
                  <Typography variant="caption" color="text.secondary">{progress.toFixed(1)}%</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  color={isExact ? "success" : remaining < 0 ? "error" : "primary"}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Qty (Rolls)</TableCell>
                    <TableCell>Length / Roll (m)</TableCell>
                    <TableCell align="right">Sub-total (m)</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={g.qty}
                          onChange={(e) => updateGroup(i, "qty", e.target.value)}
                          sx={{ width: 80 }}
                          inputProps={{ min: 1, step: 1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={g.lengthMeters}
                          onChange={(e) => updateGroup(i, "lengthMeters", e.target.value)}
                          sx={{ width: 90 }}
                          inputProps={{ min: 1, step: 1 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {(toNumber(g.qty) * toNumber(g.lengthMeters)).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {groups.length > 1 && (
                          <IconButton size="small" onClick={() => removeGroup(i)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" fontWeight={600}>Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color={isExact ? "success.main" : "text.primary"}>
                        {sumMeters.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              <Button startIcon={<AddIcon />} onClick={addGroup} size="small" sx={{ mt: 1 }}>
                Add Group
              </Button>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBifurcationDialog({ open: false, lineIndex: null, targetMeters: 0, groups: [] })}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleBifurcationSave}
                disabled={!isExact}
              >
                Apply
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* Credit Check Details Dialog */}
      <Dialog
        open={showCreditDialog}
        onClose={() => setShowCreditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Credit Check Details</DialogTitle>
        <DialogContent>
          {creditCheckResult && (
            <Box>
              <Typography
                variant="h6"
                color={creditCheckResult.blocked ? "error" : "success"}
                gutterBottom
              >
                Status: {creditCheckResult.blocked ? "BLOCKED" : "APPROVED"}
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Total Exposure:</strong>
                  {formatCurrency(creditCheckResult.exposure)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Credit Limit:</strong>
                  {formatCurrency(creditCheckResult.creditLimit)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Pending Limit:</strong>
                  {formatCurrency(pendingLimit)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Outstanding AR:</strong>
                  {formatCurrency(creditCheckResult.outstandingAR)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Pending Orders:</strong>
                  {formatCurrency(creditCheckResult.pendingSOValue)}
                </Typography>
              </Box>

                {creditCheckResult.reasons &&
                  creditCheckResult.reasons.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Reasons:
                      </Typography>
                      {creditCheckResult.reasons.map((reason, index) => {
                        const reasonText =
                          typeof reason === "string"
                            ? reason
                            : reason?.name ||
                              reason?.value ||
                              reason?.description ||
                              reason?._id ||
                              JSON.stringify(reason);
                        return (
                          <Typography key={index} variant="body2" color="error">
                            • {reasonText}
                          </Typography>
                        );
                      })}
                    </Box>
                  )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreditDialog(false)}>Close</Button>
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

export default SalesOrders;

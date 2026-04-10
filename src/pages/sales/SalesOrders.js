import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Alert,
  Tooltip,
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
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import salesService from "../../services/salesService";
import masterService from "../../services/masterService";
import {
  formatCurrency,
  formatDate,
  formatInches,
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
  const [showDueDaysEditor, setShowDueDaysEditor] = useState(false);
  const customerOptions = customers.map((customer) => ({
    value: customer._id,
    label: customer.creditPolicy?.isBlocked
      ? `${customer.companyName || customer.customerCode || "Customer"} (${customer.customerCode || "N/A"}) - BLOCKED`
      : `${customer.companyName || customer.customerCode || "Customer"} (${customer.customerCode || "N/A"})`,
    isBlocked: customer.creditPolicy?.isBlocked || false,
    blockReason: customer.creditPolicy?.blockReason,
  }));
  const skuOptions = [
    { value: "", label: "Select" },
    ...skus.map((sku) => ({ value: sku._id, label: sku.skuCode })),
  ];
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
      creditDays: 0,
      graceDays: 0,
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

  // More forgiving parser for API values that may come as formatted strings
  // (e.g. "77,470.00" or "₹77,470.00").
  const toNumberLoose = useCallback((val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (typeof val === "string") {
      const cleaned = val.replace(/[₹,$,\s]/g, "").replace(/,/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof val === "object" && val?.floatValue !== undefined) {
      const n = Number(val.floatValue);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
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
  const watchCreditDays = watch("creditDays");
  const watchGraceDays = watch("graceDays");

  const dueDaysSaveDebounceRef = useRef(null);
  const dueDaysSaveSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (dueDaysSaveDebounceRef.current) {
        clearTimeout(dueDaysSaveDebounceRef.current);
      }
    };
  }, []);

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
        const creditDays = customer?.creditPolicy?.creditDays || 0;
        const graceDays = customer?.creditPolicy?.graceDays || 0;
        setValue("creditDays", creditDays);
        setValue("graceDays", graceDays);
        setValue("dueDays", creditDays + graceDays);
      }
      skipDueDaysAutoSetRef.current = false;
      setShowDueDaysEditor(false);
    }
  }, [watchCustomerId, customers]);

  useEffect(() => {
    setValue("dueDays", toNumber(watchCreditDays) + toNumber(watchGraceDays));
  }, [watchCreditDays, watchGraceDays, setValue, toNumber]);

  const persistSelectedCustomerCreditPolicy = useCallback(
    (nextCreditDays, nextGraceDays) => {
      if (!selectedCustomer?._id) return;

      const creditDays = toNumber(nextCreditDays);
      const graceDays = toNumber(nextGraceDays);

      // Optimistic local update so UI reflects immediately
      const nextCreditPolicy = {
        ...(selectedCustomer.creditPolicy || {}),
        creditDays,
        graceDays,
      };
      setSelectedCustomer((prev) =>
        prev?._id === selectedCustomer._id
          ? { ...prev, creditPolicy: nextCreditPolicy }
          : prev
      );
      setCustomers((prev) =>
        (prev || []).map((c) =>
          c?._id === selectedCustomer._id ? { ...c, creditPolicy: nextCreditPolicy } : c
        )
      );

      // Debounced persist to backend
      if (dueDaysSaveDebounceRef.current) {
        clearTimeout(dueDaysSaveDebounceRef.current);
      }
      const seq = ++dueDaysSaveSeqRef.current;
      dueDaysSaveDebounceRef.current = setTimeout(async () => {
        try {
          const updated = await masterService.updateCreditPolicy(
            selectedCustomer._id,
            nextCreditPolicy
          );

          // Ignore stale responses
          if (seq !== dueDaysSaveSeqRef.current) return;

          if (updated?._id) {
            setSelectedCustomer((prev) =>
              prev?._id === updated._id ? updated : prev
            );
            setCustomers((prev) =>
              (prev || []).map((c) => (c?._id === updated._id ? updated : c))
            );
          }

          setShowDueDaysEditor(false);
        } catch (error) {
          // Keep editor open so user can retry/change; show a toast
          showNotification("Failed to update customer due days", "error");
        }
      }, 350);
    },
    [selectedCustomer, setCustomers, setSelectedCustomer, showNotification, toNumber]
  );

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
      const result = await masterService.checkCredit(customerId);
      setCreditCheckResult(result);
      if (result?.blocked) {
        showNotification("Warning: Customer credit blocked!", "warning");
      }
    } catch (error) {
      console.error("Credit check failed:", error);
    }
  };

  const fetchCustomerRates = async (customerId) => {
    try {
      const res = await masterService.getCustomerRates(customerId);
      const rates = Array.isArray(res) ? res : res?.data || [];
      setCustomerRates(rates);
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

  // Find the Product-specific rate for a line by productId.
  const findRateForProduct = useCallback(
    (productId) => {
      const id = String(normalizeId(productId) || "");
      if (!id || !customerRates.length) return null;
      return (
        customerRates.find((r) => {
          const rateProductId = String(
            normalizeId(r.productId?._id ?? r.productId) || ""
          );
          return rateProductId === id;
        }) || null
      );
    },
    [customerRates, normalizeId]
  );

  const getBenchmarkRateForLine = useCallback(
    (line) => {
      const selectedSku = skuById[normalizeId(line?.skuId)];
      const productId = normalizeId(selectedSku?.productId);
      if (!productId) return null;
      return findRateForProduct(productId);
    },
    [findRateForProduct, normalizeId, skuById]
  );

  const calculateWidthDerivedRate = useCallback(
    (benchmarkRate44, widthInches) => {
      const benchmarkRate = toNumber(benchmarkRate44);
      const width = toNumber(widthInches);

      if (!benchmarkRate || !width) {
        return 0;
      }

      // Original behavior: keep 2 decimals for width-derived rate
      return (
        Math.round((benchmarkRate * (width / 44) + Number.EPSILON) * 100) / 100
      );
    },
    [toNumber]
  );

  const getLineBaseRate = useCallback(
    (line) => {
      const benchmarkRate = getBenchmarkRateForLine(line);
      const benchmarkRate44 = benchmarkRate?.baseRate ?? 0;
      const widthInches =
        line?.widthInches || skuById[normalizeId(line?.skuId)]?.widthInches || 0;

      return calculateWidthDerivedRate(benchmarkRate44, widthInches);
    },
    [
      calculateWidthDerivedRate,
      getBenchmarkRateForLine,
      normalizeId,
      skuById,
    ]
  );

  // Returns the 44" benchmark customerRate record that drives this line, or null.
  const getSkuRateMatch = useCallback(
    (line) => getBenchmarkRateForLine(line),
    [getBenchmarkRateForLine]
  );

  const handleSaveSkuRate = useCallback(
    async (lineIndex) => {
      const line = watchLines[lineIndex];
      const selectedSku = skuById[normalizeId(line?.skuId)];
      const productId = normalizeId(selectedSku?.productId);
      if (!productId || !selectedCustomer) return;
      const rate = Number(newRateValue);
      if (!rate || rate <= 0) {
        showNotification("Please enter a valid rate", "warning");
        return;
      }
      try {
        await masterService.setCustomerRate(selectedCustomer._id, {
          productId,
          baseRate: rate,
        });
        showNotification('44" benchmark rate added successfully', "success");
        await fetchCustomerRates(selectedCustomer._id);
        setAddingRateForLine(null);
        setNewRateValue("");
      } catch (err) {
        showNotification(err?.message || "Failed to save rate", "error");
      }
    },
    [
      watchLines,
      selectedCustomer,
      newRateValue,
      fetchCustomerRates,
      normalizeId,
      showNotification,
      skuById,
    ]
  );

  const resolveTaxRate = useCallback(
    (line) => {
      const direct = normalizeTaxRate(line?.taxRate);
      if (direct) return direct;
      const sku = skuById[normalizeId(line?.skuId)] || {};
      const productTaxRate =
        sku?.productId?.taxRate ??
        sku?.product?.taxRate ??
        sku?.productId?.taxrate ??
        sku?.product?.taxrate;
      return normalizeTaxRate(productTaxRate ?? sku.taxRate);
    },
    [skuById, normalizeId, normalizeTaxRate]
  );

  // Sales pricing is derived from the product's 44" benchmark rate.
  // For example, 24" uses: rate44 * (24 / 44).
  const getTotalMetersForLine = useCallback(
    (line = {}) => {
      const groups = Array.isArray(line?.bifurcations) ? line.bifurcations : [];
      if (groups.length > 0) {
        const sum = groups.reduce(
          (s, g) => s + toNumber(g?.qty) * toNumber(g?.lengthMeters),
          0
        );
        if (sum > 0) return sum;
      }

      return (
        toNumber(line?.totalMeters) ||
        toNumber(line?.lengthMetersPerRoll) * toNumber(line?.qtyRolls)
      );
    },
    [toNumber]
  );

  const calculateLinePrice = useCallback(
    (line, baseRate, discountPercent) => {
      // Original behavior: rate is derived for selected width, then applied per-meter
      const rate = toNumber(baseRate);
      const totalMeters = getTotalMetersForLine(line);
      const lineTotal = totalMeters * rate;
      const hasOverride =
        line?.overrideRatePerRoll !== null &&
        line?.overrideRatePerRoll !== undefined &&
        line?.overrideRatePerRoll !== "";
      const finalRate = hasOverride ? toNumber(line?.overrideRatePerRoll) : rate;

      return {
        derivedRate: rate,
        finalRate,
        lineTotal,
      };
    },
    [
      calculateWidthDerivedRate,
      getTotalMetersForLine,
      normalizeId,
      skuById,
      toNumber,
    ]
  );

  const computeTotals = useCallback(
    (lines = [], discountPercent = 0) => {
      let subtotal = 0;

      lines.forEach((line) => {
        const lineTotal = toNumberLoose(line?.lineTotal);
        subtotal += lineTotal;
      });

      const discountAmount =
        (subtotal * (toNumber(discountPercent) || 0)) / 100;

      return {
        subtotal,
        discountAmount,
        taxAmount: 0,
        total: subtotal - discountAmount,
      };
    },
    [toNumber, toNumberLoose]
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
      creditDays: customer?.creditPolicy?.creditDays || 0,
      graceDays: customer?.creditPolicy?.graceDays || 0,
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
    setShowDueDaysEditor(false);
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
      creditDays: 0,
      graceDays: 0,
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
    setShowDueDaysEditor(false);
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
      creditDays: editCustomer?.creditPolicy?.creditDays || 0,
      graceDays: editCustomer?.creditPolicy?.graceDays || 0,
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
    setShowDueDaysEditor(false);
    setOpenDialog(true);
  };

  const handleSKUChange = (index, skuId) => {
    const sku = skus.find((s) => s._id === skuId);
    if (sku) {
      const currentLine = watchLines[index] || {};
      const product = sku.productId || sku.product; // Handle both populated and direct reference
      const defaultLength =
        product?.defaultLengthMeters ?? sku.lengthMetersPerRoll ?? "";
      const taxRate = normalizeTaxRate(product?.taxRate ?? sku.taxRate ?? 0);

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
        taxRate,
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
    const totalM = getTotalMetersForLine(line);
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

  const handleRecheckCredit = async (row) => {
    try {
      await salesService.recheckSalesOrderCredit(row._id);
      showNotification("Credit re-check completed", "success");
      fetchSalesOrders();
    } catch (error) {
      showNotification(error.message || "Failed to re-check credit", "error");
    }
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
            derivedRatePerRoll: pricing.derivedRate,
            finalRatePerRoll: pricing.finalRate,
            totalMeters: getTotalMetersForLine(line),
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
      delete orderData.creditDays;
      delete orderData.graceDays;

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
        const status = formatDisplayValue(params.row?.status);
        const isDraft = status === "Draft";
        const passed = isDraft ? null : Boolean(params.value);
        const label =
          passed === null
            ? "Credit check not performed yet (Draft)"
            : passed
              ? "Credit check passed"
              : "Credit check blocked";
        return (
          <Tooltip title={label} arrow>
            {passed === null ? (
              <CalculateIcon sx={{ color: "text.disabled" }} />
            ) : passed ? (
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
      valueGetter: (params) => {
        const row = params?.row || {};
        return (
          row.total ??
          row.totalAmount ??          
          row.netTotal ??
          row.subtotal ??
          0
        );
      },
      valueFormatter: (params) => formatCurrency(toNumberLoose(params.value)),
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
      icon: <CreditCheckIcon />,
      label: "Re-check Credit",
      onClick: handleRecheckCredit,
      show: (row) => row.status === "OnHold",
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
                      <Autocomplete
                        {...buildSingleSelectAutocompleteProps(
                          customerOptions,
                          field.value,
                          field.onChange
                        )}
                        fullWidth
                        size="small"
                        disabled={viewMode}
                        getOptionDisabled={(option) => option.isBlocked}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                              <span>{option.label}</span>
                              {option.isBlocked && (
                                <Chip
                                  label="BLOCKED"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </Box>
                        )}
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
                            <Stack spacing={1}>
                              <Stack
                                direction="row"
                                alignItems="baseline"
                                spacing={0.5}
                                onClick={() => setShowDueDaysEditor((prev) => !prev)}
                                sx={{ cursor: "pointer", width: "fit-content" }}
                              >
                                <Typography variant="body2" fontWeight={500}>
                                  {watch("dueDays") ?? 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  days
                                </Typography>
                              </Stack>
                              {showDueDaysEditor && (
                                <Stack direction="row" spacing={1}>
                                  <Controller
                                    name="creditDays"
                                    control={control}
                                    render={({ field }) => (
                                      <TextField
                                        {...field}
                                        label="Credit Days"
                                        type="number"
                                        size="small"
                                        inputProps={{ min: 0 }}
                                        onChange={(e) => {
                                          const next = Number(e.target.value);
                                          field.onChange(next);
                                          persistSelectedCustomerCreditPolicy(
                                            next,
                                            watchGraceDays
                                          );
                                        }}
                                        sx={{ width: 120 }}
                                      />
                                    )}
                                  />
                                  <Controller
                                    name="graceDays"
                                    control={control}
                                    render={({ field }) => (
                                      <TextField
                                        {...field}
                                        label="Grace Days"
                                        type="number"
                                        size="small"
                                        inputProps={{ min: 0 }}
                                        onChange={(e) => {
                                          const next = Number(e.target.value);
                                          field.onChange(next);
                                          persistSelectedCustomerCreditPolicy(
                                            watchCreditDays,
                                            next
                                          );
                                        }}
                                        sx={{ width: 120 }}
                                      />
                                    )}
                                  />
                                </Stack>
                              )}
                            </Stack>
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
                      Product Base Rates
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 220, overflow: "auto", flex: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, bgcolor: "grey.50" }}>Product</TableCell>
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
                                {rate.productId?.productCode ||
                                  rate.productId?.productAlias ||
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
                    const effectiveTotalMeters = getTotalMetersForLine(line);
                    const hasBifurcation =
                      Array.isArray(line.bifurcations) && line.bifurcations.length > 0;

                    return (
                      <TableRow key={field.id}>
                        <TableCell sx={{ minWidth: 400 }}>
                          <Controller
                            name={`lines.${index}.skuId`}
                            control={control}
                            render={({ field }) => (
                              <Autocomplete
                                {...buildSingleSelectAutocompleteProps(
                                  skuOptions,
                                  field.value,
                                  (value) => handleSKUChange(index, value)
                                )}
                                size="small"
                                fullWidth
                                disabled={viewMode}
                                renderInput={(params) => (
                                  <TextField {...params} />
                                )}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>{formatDisplayValue(line?.categoryName)}</TableCell>
                        <TableCell>{formatDisplayValue(line?.gsm)}</TableCell>
                        <TableCell>{formatDisplayValue(line?.qualityName)}</TableCell>
                        <TableCell>{formatInches(line?.widthInches)}</TableCell>
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
                              <Tooltip title='Save 44" benchmark rate'>
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
                            <Tooltip title='No 44" benchmark rate found for this product. Click to add one.'>
                              <Box
                                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: viewMode ? "default" : "pointer" }}
                                onClick={() => {
                                  if (!viewMode) { setAddingRateForLine(index); setNewRateValue(""); }
                                }}
                              >
                                <WarningIcon sx={{ fontSize: 14, color: "warning.main" }} />
                                <Typography variant="caption" color="warning.main">
                                  {viewMode ? 'No 44" rate' : 'Add 44" rate'}
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
                                value={
                                  field.value === null ||
                                  field.value === undefined ||
                                  field.value === ""
                                    ? pricing.derivedRate
                                    : field.value
                                }
                                placeholder="Auto"
                                disabled={viewMode}
                                onValueChange={(values) => {
                                  const next =
                                    values.floatValue === undefined ? null : values.floatValue;
                                  field.onChange(next);
                                  handleOverrideRateChange(index, next);
                                }}
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

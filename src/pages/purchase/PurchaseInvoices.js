import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  FormHelperText,
  Divider,
  IconButton,
  ListItemText,
  Checkbox,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as PostIcon,
  LocalShipping as LandedCostIcon,
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import purchaseService from "../../services/purchaseService";
import inventoryService from "../../services/inventoryService";
import masterService from "../../services/masterService";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
} from "../../utils/formatters";

const PurchaseInvoices = () => {
  const { showNotification, setLoading } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [skus, setSkus] = useState([]);
  const skuLookup = useMemo(() => {
    const map = {};
    skus.forEach((sku) => {
      const id = sku._id || sku.id;
      if (id) map[id] = sku;
    });
    return map;
  }, [skus]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [availableLines, setAvailableLines] = useState([]);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [showLandedCostsSection, setShowLandedCostsSection] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openOrdersModal, setOpenOrdersModal] = useState(false);
  const [pendingLineIds, setPendingLineIds] = useState([]);
  const [pendingLineValues, setPendingLineValues] = useState({});
  const [openLandedCostDialog, setOpenLandedCostDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier._id,
    label: supplier.name,
  }));
  const skuOptions = skus.map((sku) => ({
    value: sku._id,
    label: sku.skuCode,
  }));
  const landedCostTypeOptions = [
    { value: "Freight", label: "Freight" },
    { value: "Duty", label: "Duty" },
    { value: "Clearing", label: "Clearing" },
    { value: "Misc", label: "Misc" },
  ];
  const landedCostAllocationOptions = [
    { value: "ROLL", label: "Per Roll" },
    { value: "METER", label: "Per Meter" },
    { value: "VALUE", label: "By Value" },
  ];
  const [confirmPost, setConfirmPost] = useState(false);
  const [currentUserState, setCurrentUserState] = useState("");
  const [inwardDetail, setInwardDetail] = useState({
    open: false,
    line: null,
    effectiveMeters: 0,
  });
  const [rollDetailsDialog, setRollDetailsDialog] = useState({
    open: false,
    line: null,
    rows: [],
  });
  const [computedTotals, setComputedTotals] = useState({
    subtotal: 0,
    totalLandedCost: 0,
    grandTotal: 0,
    sgst: 0,
    cgst: 0,
    igst: 0,
    taxAmount: 0,
  });
  const isExistingInvoice = Boolean(selectedInvoice);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      supplierId: "",
      purchaseOrderId: "",
      purchaseOrderIds: [],
      supplierInvoiceNumber: "",
      supplierChallanNumber: "",
      lrNumber: "",
      lrDate: new Date(),
      caseNumber: "",
      hsnCode: "",
      sgst: 0,
      cgst: 0,
      igst: 0,
      gstMode: "intra",
      date: new Date(),
      lines: [],
      landedCosts: [],
      notes: "",
    },
  });

  const {
    fields: lineFields,
    replace: replaceLines,
    append: appendLine,
  } = useFieldArray({
    control,
    name: "lines",
  });

  const {
    fields: landedCostFields,
    append: appendLandedCost,
    remove: removeLandedCost,
  } = useFieldArray({
    control,
    name: "landedCosts",
  });

  const watchLines = watch("lines");
  const watchLandedCosts = watch("landedCosts");
  const watchSGST = watch("sgst");
  const watchCGST = watch("cgst");
  const watchIGST = watch("igst");
  const watchGstMode = watch("gstMode");
  const watchSupplierId = watch("supplierId");

  const normalizeState = useCallback(
    (value) => (value || "").toString().trim().toLowerCase(),
    []
  );

  // Normalise to the canonical per-roll format [{ lengthMeters }].
  // Accepts both the UI dialog format { rollQty, metersPerRoll } (expands N times)
  // and the stored per-roll format { lengthMeters } (passes through).
  const normalizeRollDetails = useCallback((details = []) => {
    if (!Array.isArray(details)) return [];
    const expanded = [];
    for (const detail of details) {
      if (!detail) continue;
      if (detail.lengthMeters !== undefined) {
        const len = Number(detail.lengthMeters) || 0;
        if (len > 0) expanded.push({ lengthMeters: len });
      } else if (
        detail.rollQty !== undefined ||
        detail.metersPerRoll !== undefined
      ) {
        const qty = Math.max(Math.round(Number(detail.rollQty) || 0), 0);
        const mpr = Number(detail.metersPerRoll) || 0;
        if (qty > 0 && mpr > 0) {
          for (let i = 0; i < qty; i++) expanded.push({ lengthMeters: mpr });
        }
      }
    }
    return expanded;
  }, []);

  // Collapse individual rolls [{ lengthMeters }] into groups [{ rollQty, metersPerRoll }]
  // for display inside the Roll Details dialog (avoids showing 50 identical rows).
  const collapseRollsToGroups = useCallback((individualRolls = []) => {
    if (!Array.isArray(individualRolls) || !individualRolls.length) return [];
    const groups = new Map();
    for (const r of individualRolls) {
      if (!r) continue;
      // Handle both stored { lengthMeters } and already-grouped entries
      const len =
        r.lengthMeters !== undefined
          ? Number(r.lengthMeters) || 0
          : Number(r.metersPerRoll) || 0;
      const qty =
        r.lengthMeters !== undefined ? 1 : Number(r.rollQty) || 1;
      if (!len) continue;
      if (groups.has(len)) groups.get(len).rollQty += qty;
      else groups.set(len, { rollQty: qty, metersPerRoll: len });
    }
    return Array.from(groups.values());
  }, []);

  const summarizeRollDetails = useCallback(
    (details = []) => {
      // normalizeRollDetails handles both grouped and individual formats
      const normalized = normalizeRollDetails(details);
      const totalRolls = normalized.length;
      const totalMeters = normalized.reduce((s, r) => s + r.lengthMeters, 0);
      const avgMetersPerRoll = totalRolls > 0 ? totalMeters / totalRolls : 0;
      return { normalized, totalRolls, totalMeters, avgMetersPerRoll };
    },
    [normalizeRollDetails]
  );

  const selectedSupplier = suppliers.find((sup) => sup._id === watchSupplierId);
  const isAutoGstMode = Boolean(currentUserState && selectedSupplier?.state);
  const gstHelperText = isAutoGstMode
    ? `Auto-selected using your state (${currentUserState}) and supplier state (${selectedSupplier?.state}).`
    : "Choose intra (CGST+SGST 9% each) or inter (IGST 18%)";

  useEffect(() => {
    fetchPurchaseInvoices();
    fetchSuppliers();
    fetchSKUs();
  }, []);

  useEffect(() => {
    // Resolve current user state from common locations (window, storage, env)
    const resolveUserState = () => {
      let resolvedState = "";

      if (typeof window !== "undefined") {
        try {
          const storedUser = window.localStorage.getItem("currentUser");
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            resolvedState = parsed?.state || resolvedState;
          }

          if (!resolvedState) {
            const storedState = window.localStorage.getItem("currentUserState");
            resolvedState = storedState || resolvedState;
          }

          if (!resolvedState && window.__CURRENT_USER__?.state) {
            resolvedState = window.__CURRENT_USER__.state;
          }
        } catch (err) {
          // Ignore storage parsing errors and fall back to env
        }
      }

      if (!resolvedState) {
        resolvedState =
          process.env.REACT_APP_USER_STATE ||
          process.env.REACT_APP_COMPANY_STATE ||
          "";
      }

      return resolvedState;
    };

    const detectedState = resolveUserState();
    if (detectedState) {
      setCurrentUserState(detectedState);
    }
  }, []);

  useEffect(() => {
    if (!watchSupplierId || !currentUserState || selectedInvoice) return;

    const supplier = suppliers.find((sup) => sup._id === watchSupplierId);
    if (!supplier?.state) return;

    const supplierState = normalizeState(supplier.state);
    const userState = normalizeState(currentUserState);

    if (!supplierState || !userState) return;

    const nextGstMode = supplierState === userState ? "intra" : "inter";

    if (watchGstMode !== nextGstMode) {
      setValue("gstMode", nextGstMode);
    }
  }, [
    watchSupplierId,
    suppliers,
    currentUserState,
    selectedInvoice,
    watchGstMode,
    setValue,
    normalizeState,
  ]);

  useEffect(() => {
    if ((landedCostFields || []).length === 0) {
      setShowLandedCostsSection(false);
    }
  }, [landedCostFields]);

  const computeTotals = useCallback(() => {
    let subtotal = 0;

    // Price strictly on meters * base rate
    (watchLines || []).forEach((line) => {
      const meters =
        Number(line.totalMeters) ||
        Number(line.inwardMeters) ||
        (Number(line.lengthMetersPerRoll) || 0) *
          (Number(line.qtyRolls) || 0);
      const rate = Number(line.ratePerRoll) || 0;
      subtotal += meters * rate;
    });

    const sgstAmount = Number(watchSGST) || 0;
    const cgstAmount = Number(watchCGST) || 0;
    const igstAmount = Number(watchIGST) || 0;
    const taxAmount = sgstAmount + cgstAmount + igstAmount;

    const totalLandedCost = (watchLandedCosts || []).reduce(
      (sum, cost) => sum + (Number(cost.amount) || 0),
      0
    );
    const grandTotal = subtotal + taxAmount + totalLandedCost;

    return {
      subtotal,
      totalLandedCost,
      grandTotal,
      sgst: sgstAmount,
      cgst: cgstAmount,
      igst: igstAmount,
      taxAmount,
    };
  }, [watchLines, watchLandedCosts, watchSGST, watchCGST, watchIGST]);

  useEffect(() => {
    // Auto-compute SGST/CGST at 9% each on subtotal for new invoices only
    if (isExistingInvoice) return;

    // Use the same subtotal basis as totals (meters * rate)
    const { subtotal } = computeTotals();

    if (!subtotal) {
      setValue("sgst", 0);
      setValue("cgst", 0);
      setValue("igst", 0);
      return;
    }

    if (watchGstMode === "inter") {
      setValue("sgst", 0);
      setValue("cgst", 0);
      setValue("igst", subtotal * 0.18);
    } else {
      const sgstAmount = subtotal * 0.09;
      const cgstAmount = subtotal * 0.09;
      setValue("sgst", sgstAmount);
      setValue("cgst", cgstAmount);
      setValue("igst", 0);
    }
  }, [watchLines, watchGstMode, setValue, isExistingInvoice, computeTotals]);

  useEffect(() => {
    setComputedTotals(computeTotals());
  }, [computeTotals]);

  const fetchPurchaseInvoices = async () => {
    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseInvoices();
      setInvoices(response.data);
    } catch (error) {
      showNotification("Failed to fetch purchase invoices", "error");
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
      const response = await masterService.getSKUs();
      setSkus(response?.data || response?.skus || response || []);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
      showNotification("Failed to fetch SKUs", "error");
      setSkus([]);
    }
  };

  const fetchPurchaseOrders = async (supplierIdParam, options = {}) => {
    const { resetLines = true } = options;
    const supplierId = supplierIdParam || getValues("supplierId");

    if (!supplierId) {
      showNotification("Please select a supplier to fetch orders", "warning");
      return;
    }

    setLoading(true);
    try {
      const response = await purchaseService.getPurchaseOrders({
        supplierId,
        status: ["Approved", "PartiallyReceived"],
      });

      const ordersData =
        response?.data ||
        response?.orders ||
        response?.purchaseOrders ||
        response?.rows ||
        response ||
        [];

      const normalizedOrders = Array.isArray(ordersData)
        ? ordersData
        : Array.isArray(ordersData?.data)
        ? ordersData.data
        : [];

      setPurchaseOrders(normalizedOrders);
      if (resetLines) {
        setAvailableLines(buildInvoiceLinesFromOrders(normalizedOrders));
        setSelectedLineIds([]);
        replaceLines([]);
        setValue("purchaseOrderIds", []);
      }

      if (!normalizedOrders.length) {
        showNotification("No orders found for the selected supplier", "info");
      }
    } catch (error) {
      console.error("Failed to fetch purchase orders:", error);
      showNotification("Failed to fetch purchase orders", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOrdersModal = async () => {
    const supplierId = getValues("supplierId");

    if (!supplierId) {
      showNotification("Please select a supplier to fetch orders", "warning");
      return;
    }

    setOpenOrdersModal(true);
    setPendingLineIds(selectedLineIds || []);
    setPendingLineValues({});
    setAvailableLines([]);
    setSelectedLineIds([]);
    replaceLines([]);
    setValue("purchaseOrderIds", []);
    setValue("purchaseOrderId", "");
    await fetchPurchaseOrders(supplierId);
  };

  const handleCloseOrdersModal = () => {
    setOpenOrdersModal(false);
  };

  const closeInvoiceDialog = () => {
    setOpenDialog(false);
    setOpenOrdersModal(false);
  };

  const buildInvoiceLinesFromOrders = (orders = []) => {
    return orders.flatMap((po) =>
      (po.lines || []).map((line) => {
        const skuInfo = line.skuId;
        const isSkuObject =
          skuInfo && typeof skuInfo === "object" && !Array.isArray(skuInfo);
        const normalizedSkuId = isSkuObject ? skuInfo._id : skuInfo;
        const skuFromLookup = skuLookup[normalizedSkuId] || {};

        return {
          poId: po._id,
          poNumber: po.poNumber,
          poLineId: line._id,
          skuId: normalizedSkuId || "",
          skuCode:
            line.skuCode ||
            (isSkuObject ? skuInfo.skuCode : skuFromLookup.skuCode || ""),
          categoryName:
            line.categoryName ||
            (isSkuObject
              ? skuInfo.categoryName
              : skuFromLookup.categoryName || ""),
          gsm:
            line.gsm || (isSkuObject ? skuInfo.gsm : skuFromLookup.gsm || ""),
          qualityName:
            line.qualityName ||
            (isSkuObject
              ? skuInfo.qualityName
              : skuFromLookup.qualityName || ""),
          widthInches:
            line.widthInches ||
            (isSkuObject
              ? skuInfo.widthInches
              : skuFromLookup.widthInches || ""),
          lengthMetersPerRoll:
            line.lengthMetersPerRoll ||
            (isSkuObject ? skuInfo.lengthMetersPerRoll : 0) ||
            0,
          qtyRolls: Math.max(
            (Number(line.qtyRolls) || 0) - (Number(line.invoicedQty) || 0),
            0
          ),
          ratePerRoll: Number(line.ratePerRoll) || 0,
          totalMeters:
            line.totalMeters ??
            (Number(line.lengthMetersPerRoll) || 0) *
              (Math.max(
                (Number(line.qtyRolls) || 0) - (Number(line.invoicedQty) || 0),
                0
              ) || 0),
          lineTotal:
            line.lineTotal ??
            (Math.max(
              (Number(line.qtyRolls) || 0) - (Number(line.invoicedQty) || 0),
              0
            ) || 0) * (Number(line.ratePerRoll) || 0),
          inwardRolls: 0,
          inwardMeters: 0,
          gstMode: "intra",
        };
      })
    );
  };

  const loadSelectedOrders = async (orderIds = []) => {
    if (!orderIds.length) {
      setSelectedOrders([]);
      replaceLines([]);
      setValue("purchaseOrderId", "");
      return;
    }

    setLoading(true);
    try {
      const details = await Promise.all(
        orderIds.map(async (id) => {
          const response = await purchaseService.getPurchaseOrder(id);
          return response?.data || response;
        })
      );

      setSelectedOrders(details);
      setValue("purchaseOrderId", orderIds[0] || "");
      const invoiceLines = buildInvoiceLinesFromOrders(details);
      replaceLines(invoiceLines);
    } catch (error) {
      console.error("Failed to load purchase order details", error);
      showNotification("Failed to load selected orders", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierChange = (supplierId) => {
    setValue("supplierId", supplierId);
    setPurchaseOrders([]);
    setSelectedOrders([]);
    setAvailableLines([]);
    setSelectedLineIds([]);
    setValue("purchaseOrderIds", []);
    setValue("purchaseOrderId", "");
    replaceLines([]);
  };

  const toggleLineSelection = (poLineId) => {
    setPendingLineIds((prev = []) => {
      const exists = prev.includes(poLineId);
      return exists
        ? prev.filter((id) => id !== poLineId)
        : [...prev, poLineId];
    });
  };

  const updatePendingLineValue = (poLineId, key, value) => {
    setPendingLineValues((prev) => ({
      ...prev,
      [poLineId]: {
        ...(prev[poLineId] || {}),
        [key]: value,
      },
    }));
  };

  const deriveInwardRolls = (totalMeters, meterPerRoll) => {
    const meters = Number(totalMeters) || 0;
    const perRoll = Number(meterPerRoll) || 0;
    if (perRoll <= 0) return 0;
    return Math.ceil(meters / perRoll);
  };

  const setPendingMetersWithDerivedRolls = (poLineId, meters, meterPerRoll) => {
    setPendingLineValues((prev) => ({
      ...prev,
      [poLineId]: {
        ...(prev[poLineId] || {}),
        inwardMeters: meters,
        inwardRolls: deriveInwardRolls(meters, meterPerRoll),
        rollDetails: [],
      },
    }));
  };

  const openRollDetailsDialog = (line) => {
    if (!line?.poLineId) return;
    const pending = pendingLineValues[line.poLineId] || {};
    const existingDetails =
      pending.rollDetails || line.rollDetails || line.pendingRollDetails || [];
    const baseMeters = Number(line.lengthMetersPerRoll) || 0;

    // Existing details may be in the new per-roll format [{ lengthMeters }].
    // Collapse to groups [{ rollQty, metersPerRoll }] for a compact dialog UI.
    const collapsed = collapseRollsToGroups(existingDetails);
    const seedRows =
      collapsed.length > 0
        ? collapsed
        : [
            {
              rollQty:
                pending.inwardRolls ||
                line.inwardRolls ||
                line.qtyRolls ||
                1,
              metersPerRoll:
                Number(pending.inwardMeters) > 0 &&
                Number(pending.inwardRolls) > 0
                  ? Number(pending.inwardMeters) / Number(pending.inwardRolls)
                  : baseMeters,
            },
          ];

    setRollDetailsDialog({
      open: true,
      line,
      rows: seedRows,
    });
  };

  const closeRollDetailsDialog = () => {
    setRollDetailsDialog({
      open: false,
      line: null,
      rows: [],
    });
  };

  const updateRollDetailRow = (index, key, value) => {
    setRollDetailsDialog((prev) => {
      const nextRows = [...(prev.rows || [])];
      nextRows[index] = {
        ...(nextRows[index] || {}),
        [key]: value,
      };
      return { ...prev, rows: nextRows };
    });
  };

  const addRollDetailRow = () => {
    setRollDetailsDialog((prev) => {
      const baseMeters =
        Number(prev?.line?.lengthMetersPerRoll) ||
        Number(prev?.line?.lengthMeters) ||
        0;
      return {
        ...prev,
        rows: [...(prev.rows || []), { rollQty: 1, metersPerRoll: baseMeters }],
      };
    });
  };

  const removeRollDetailRow = (index) => {
    setRollDetailsDialog((prev) => {
      const nextRows = [...(prev.rows || [])];
      nextRows.splice(index, 1);
      return { ...prev, rows: nextRows };
    });
  };

  const saveRollDetails = () => {
    const { line, rows } = rollDetailsDialog;
    if (!line?.poLineId) {
      closeRollDetailsDialog();
      return;
    }
    // rows are in { rollQty, metersPerRoll } grouped format (from the dialog UI).
    // normalizeRollDetails expands them to individual [{ lengthMeters }] entries —
    // the canonical stored format where each entry = one physical roll.
    const summary = summarizeRollDetails(rows);
    setPendingLineValues((prev) => ({
      ...prev,
      [line.poLineId]: {
        ...(prev[line.poLineId] || {}),
        rollDetails: summary.normalized, // [{ lengthMeters }] — one entry per roll
        inwardRolls: summary.totalRolls,
        inwardMeters: summary.totalMeters,
      },
    }));
    setPendingLineIds((prev = []) =>
      prev.includes(line.poLineId) ? prev : [...prev, line.poLineId]
    );
    closeRollDetailsDialog();
  };

  const openInwardDetail = (line, meters) => {
    setInwardDetail({
      open: true,
      line,
      effectiveMeters: Number(meters) || 0,
    });
  };

  const closeInwardDetail = () => {
    setInwardDetail({
      open: false,
      line: null,
      effectiveMeters: 0,
    });
  };

  const applySelectedOrders = () => {
    const selectedLines = availableLines
      .filter((l) => pendingLineIds.includes(l.poLineId))
      .map((line) => {
        const overrides = pendingLineValues[line.poLineId] || {};
        const meterPerRoll = Number(line.lengthMetersPerRoll) || 0;
        const rollSummary = summarizeRollDetails(
          overrides.rollDetails || line.rollDetails || []
        );
        const resolvedMeters =
          rollSummary.totalMeters ??
          overrides.inwardMeters ??
          line.inwardMeters ??
          0;
        const derivedRolls = deriveInwardRolls(resolvedMeters, meterPerRoll);
        const resolvedRolls =
          rollSummary.totalRolls ??
          overrides.inwardRolls ??
          derivedRolls ??
          line.inwardRolls ??
          0;

        return {
          ...line,
          rollDetails: rollSummary.normalized,
          inwardRolls: resolvedRolls,
          inwardMeters: resolvedMeters,
        };
      });
    setSelectedLineIds(pendingLineIds);
    replaceLines(selectedLines);

    // Keep a reference of selected purchase orders
    const selectedPoIds = Array.from(
      new Set(selectedLines.map((l) => l.poId).filter(Boolean))
    );
    setSelectedOrders(
      purchaseOrders.filter((po) => selectedPoIds.includes(po._id))
    );

    const uniquePoIds = Array.from(
      new Set(selectedLines.map((l) => l.poId).filter(Boolean))
    );
    setValue("purchaseOrderIds", uniquePoIds);
    setValue("purchaseOrderId", uniquePoIds[0] || "");
    handleCloseOrdersModal();
  };

  const handleManualLineSKUChange = (index, skuId) => {
    const sku =
      skus.find((s) => s._id === skuId) ||
      skus.find((s) => s.id === skuId) ||
      {};
    setValue(`lines.${index}.skuId`, skuId);
    setValue(`lines.${index}.skuCode`, sku.skuCode || "");
    setValue(`lines.${index}.categoryName`, sku.categoryName || "");
    setValue(`lines.${index}.gsm`, sku.gsm || "");
    setValue(`lines.${index}.qualityName`, sku.qualityName || "");
    setValue(`lines.${index}.widthInches`, sku.widthInches || "");
    setValue(
      `lines.${index}.lengthMetersPerRoll`,
      sku.lengthMetersPerRoll || 0
    );
  };

  const addManualLine = () => {
    const manualId = `manual-${Date.now()}`;
    appendLine({
      poNumber: "Manual",
      poLineId: manualId,
      poId: null,
      skuId: "",
      skuCode: "",
      categoryName: "",
      gsm: "",
      qualityName: "",
      widthInches: "",
      lengthMetersPerRoll: 0,
      qtyRolls: 0,
      ratePerRoll: 0,
      inwardRolls: 0,
      inwardMeters: 0,
    });
    setSelectedLineIds((prev) => [...(prev || []), manualId]);
  };

  const recomputeManualLineTotal = (index, overrides = {}) => {
    const line = watchLines[index] || {};
    const qty = overrides.qtyRolls ?? (Number(line.qtyRolls) || 0);
    const rate = overrides.ratePerRoll ?? (Number(line.ratePerRoll) || 0);
    const meters =
      ((overrides.lengthMetersPerRoll ?? Number(line.lengthMetersPerRoll)) ||
        0) * qty;
    setValue(`lines.${index}.totalMeters`, meters);
    setValue(`lines.${index}.lineTotal`, meters * rate);
  };

  const handleAdd = () => {
    setSelectedInvoice(null);
    reset({
      supplierId: "",
      purchaseOrderId: "",
      purchaseOrderIds: [],
      supplierInvoiceNumber: "",
      supplierChallanNumber: "",
      lrNumber: "",
      lrDate: new Date(),
      caseNumber: "",
      hsnCode: "",
      sgst: 0,
      cgst: 0,
      igst: 0,
      gstMode: "intra",
      date: new Date(),
      lines: [],
      landedCosts: [],
      notes: "",
    });
    setPurchaseOrders([]);
    setSelectedOrders([]);
    setAvailableLines([]);
    setSelectedLineIds([]);
    setShowLandedCostsSection(false);
    setOpenOrdersModal(false);
    setOpenDialog(true);
  };

  const handleView = async (row) => {
    const rowId = row?._id || row?.id;
    if (!rowId) return;

    try {
      setLoading(true);
      const response = await purchaseService.getPurchaseInvoice(rowId);
      const data = response?.data || response || {};

      setSelectedInvoice(data);

      const normalizedSupplierId =
        data.supplierId?._id || data.supplierId || "";
      const normalizedPurchaseOrderId =
        data.purchaseOrderId?._id || data.purchaseOrderId || "";

      reset({
        supplierId: normalizedSupplierId,
        purchaseOrderId: normalizedPurchaseOrderId,
        purchaseOrderIds: normalizedPurchaseOrderId
          ? [normalizedPurchaseOrderId]
          : [],
        supplierInvoiceNumber: data.supplierInvoiceNumber || "",
        supplierChallanNumber: data.supplierChallanNumber || "",
        lrNumber: data.lrNumber || "",
        lrDate: data.lrDate ? new Date(data.lrDate) : new Date(),
        caseNumber: data.caseNumber || "",
        hsnCode: data.hsnCode || "",
        sgst: data.sgst || 0,
        cgst: data.cgst || 0,
        igst: data.igst ?? 0,
        gstMode: data.gstMode || "intra",
        date: data.date ? new Date(data.date) : new Date(),
        lines: data.lines || [],
        landedCosts: data.landedCosts || [],
        notes: data.notes || "",
      });

      setSelectedOrders([]);
      setPurchaseOrders([]);
      setAvailableLines([]);
      setSelectedLineIds(
        (data.lines || [])
          .map((l) => l.poLineId || l._id || l.id)
          .filter(Boolean)
      );
      setShowLandedCostsSection(
        Array.isArray(data.landedCosts) && data.landedCosts.length > 0
      );
      setOpenOrdersModal(false);
      setOpenDialog(true);
    } catch (error) {
      showNotification("Failed to load invoice details", "error");
    } finally {
      setLoading(false);
    }
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
      // Post the invoice
      await purchaseService.postPurchaseInvoice(selectedInvoice._id);

      // Allocate landed costs to rolls
      if (
        selectedInvoice.landedCosts &&
        selectedInvoice.landedCosts.length > 0
      ) {
        for (const landedCost of selectedInvoice.landedCosts) {
          await purchaseService.allocateLandedCost(
            selectedInvoice._id,
            landedCost
          );
        }
      }

      showNotification(
        "Invoice posted and landed costs allocated successfully",
        "success"
      );
      fetchPurchaseInvoices();
    } catch (error) {
      showNotification("Failed to post invoice", "error");
    }
    setConfirmPost(false);
  };

  const handleLandedCost = (row) => {
    setSelectedInvoice(row);
    setOpenLandedCostDialog(true);
  };

  const onSubmit = async (data) => {
    try {
    const totals = computeTotals();
      const primaryPurchaseOrderId =
        data.purchaseOrderIds?.[0] || data.purchaseOrderId || "";
      const supplierInfo =
        suppliers.find((sup) => sup._id === data.supplierId) || {};
      const subtotal = totals.subtotal || 0;
      const overallTaxRate =
        subtotal > 0 ? (totals.taxAmount / subtotal) * 100 : 0;

      const normalizedLines = (data.lines || []).map((line) => {
        const rollSummary = summarizeRollDetails(line.rollDetails);
        const meterPerRoll =
          Number(line.lengthMetersPerRoll) ||
          rollSummary.avgMetersPerRoll ||
          0;
        const inwardMeters =
          rollSummary.totalMeters ||
          Number(line.inwardMeters) ||
          (Number(line.inwardRolls) || 0) * meterPerRoll;
        const inwardRolls =
          rollSummary.totalRolls ||
          deriveInwardRolls(inwardMeters, meterPerRoll) ||
          Number(line.inwardRolls) ||
          0;

        return {
          poLineId: line.poLineId,
          poId: line.poId,
          poNumber: line.poNumber,
          skuId: line.skuId,
          skuCode: line.skuCode,
          categoryName: line.categoryName,
          qualityName: line.qualityName,
          gsm: line.gsm,
          widthInches: line.widthInches,
          lengthMetersPerRoll: line.lengthMetersPerRoll || rollSummary.avgMetersPerRoll,
          totalMeters:
            rollSummary.totalMeters ||
            Number(line.totalMeters) ||
            meterPerRoll * (Number(line.inwardRolls || line.qtyRolls || 0)),
          qtyRolls: Number(line.qtyRolls) || 0,
          ratePerRoll: Number(line.ratePerRoll) || 0,
          taxRate: overallTaxRate,
          inwardRolls,
          inwardMeters,
          rollDetails: rollSummary.normalized,
        };
      });

      // Drop manual lines that were added by mistake with no meaningful data entered.
      // A line is considered empty when it has no SKU, no meters, and no rolls.
      const filteredLines = normalizedLines.filter((line) => {
        const isManualLine =
          (!line.poId && line.poNumber === "Manual") ||
          line.poLineId?.toString().startsWith("manual-");
        if (!isManualLine) return true; // always keep PO-linked lines
        const hasData =
          !!line.skuId ||
          line.inwardMeters > 0 ||
          line.inwardRolls > 0 ||
          (Array.isArray(line.rollDetails) && line.rollDetails.length > 0);
        return hasData;
      });

      const invoiceData = {
        ...data,
        ...totals,
        purchaseOrderId: primaryPurchaseOrderId || null,
        supplierName: supplierInfo.name || data.supplierName || "",
        lines: filteredLines,
      };

      if (!selectedInvoice && !primaryPurchaseOrderId) {
        if (!data.supplierId) {
          showNotification(
            "Select a supplier for a direct purchase invoice (no purchase order).",
            "error"
          );
          return;
        }
        if (!filteredLines.length) {
          showNotification(
            "Add at least one line with rolls, meters, and rate.",
            "error"
          );
          return;
        }
      }

      if (selectedInvoice) {
        await purchaseService.updatePurchaseInvoice(
          selectedInvoice._id,
          invoiceData
        );
        showNotification("Invoice updated successfully", "success");
      } else {
        await purchaseService.createPurchaseInvoice(invoiceData);
        showNotification("Invoice created successfully", "success");
      }
      closeInvoiceDialog();
      fetchPurchaseInvoices();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "piNumber", headerName: "PI Number" },
    {
      field: "supplierInvoiceNumber",
      headerName: "Supplier Invoice",
    },
    { field: "supplierName", headerName: "Supplier", flex: 1 },
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
    {
      field: "grandTotal",
      headerName: "Total Amount",
      renderCell: (params) => {
        const row = params.row || {};
        const amount =
          row.grandTotal ??
          row.total ??
          (Number(row.subtotal) || 0) +
            (Number(row.taxAmount) || 0) +
            (Number(row.totalLandedCost) || 0);
        return formatCurrency(amount || 0);
      },
    },
    {
      field: "totalLandedCost",
      headerName: "Landed Cost",
      renderCell: (params) => formatCurrency(params.value || 0),
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
      icon: <LandedCostIcon />,
      label: "Landed Cost",
      onClick: handleLandedCost,
    },
  ];

  const totals = computedTotals;

  return (
    <Box>
      <DataTable
        title="Purchase Invoices"
        columns={columns}
        rows={invoices}
        onAdd={handleAdd}
        onView={handleView}
        customActions={customActions}
      />

      <Dialog
        open={openDialog}
        onClose={closeInvoiceDialog}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pr: 1,
            }}
          >
            {selectedInvoice
              ? `Invoice: ${selectedInvoice.piNumber}`
              : "Add Purchase Invoice"}
            <IconButton
              aria-label="close"
              onClick={closeInvoiceDialog}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Grid
              container
              spacing={2}
              sx={{ mb: 2, mt: 1 }}
              columns={{ xs: 12, md: 12 }}
            >
              <Grid item xs={12} md={3}>
                <Controller
                  name="date"
                  control={control}
                  rules={{ required: "Date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Invoice Date"
                      sx={{ width: "100%" }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.date,
                          helperText: errors.date?.message,
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="supplierId"
                  control={control}
                  rules={{ required: "Supplier is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        supplierOptions,
                        field.value,
                        handleSupplierChange
                      )}
                      fullWidth
                      disabled={!!selectedInvoice}
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

              <Grid item xs={12} md={3}>
                <Controller
                  name="supplierInvoiceNumber"
                  control={control}
                  rules={{ required: "Supplier invoice number is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Supplier Invoice Number"
                      error={!!errors.supplierInvoiceNumber}
                      helperText={errors.supplierInvoiceNumber?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Controller
                  name="supplierChallanNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Supplier Challan No."
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Grid
              container
              spacing={2}
              sx={{ mb: 2 }}
              columns={{ xs: 12, md: 12 }}
            >
              <Grid item xs={12} md={4}>
                <Controller
                  name="lrDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="LR Date"
                      sx={{ width: "100%" }}
                      renderInput={(params) => (
                        <TextField {...params} fullWidth />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="lrNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="LR No." />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="caseNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Case No." />
                  )}
                />
              </Grid>
            </Grid>

            <Grid
              container
              spacing={2}
              sx={{ mb: 2 }}
              columns={{ xs: 12, md: 12 }}
            >
              <Grid
                item
                xs={12}
                md={3}
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleOpenOrdersModal}
                  disabled={!getValues("supplierId")}
                >
                  Fetch Orders
                </Button>
              </Grid>
            </Grid>

            <Controller
              name="purchaseOrderIds"
              control={control}
              render={() => null}
            />

            {lineFields.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Selected Lines
                </Typography>

                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>PO Number</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell>Base Rate</TableCell>
                        <TableCell>Meter/Roll</TableCell>
                        <TableCell>Roll Quantity</TableCell>
                        <TableCell>Total Meters</TableCell>
                        <TableCell>Total Amount</TableCell>
                        <TableCell>Inward Rolls</TableCell>
                        <TableCell>Inward Meters</TableCell>
                        <TableCell>Balance Order</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lineFields.map((field, index) => {
                        const isManual =
                          (!field.poId && field.poNumber === "Manual") ||
                          field.poLineId?.toString().startsWith("manual-");
                        const watchLine = watchLines[index] || {};
                        const normalizedSkuId =
                          watchLine.skuId?._id ||
                          watchLine.skuId ||
                          field.skuId ||
                          "";
                        const totalMeters =
                          Number(watchLine.totalMeters ?? field.totalMeters) ||
                          (Number(watchLine.lengthMetersPerRoll) || 0) *
                            (Number(watchLine.qtyRolls) || 0);
                        const amountMeters =
                          Number(watchLine.inwardMeters) ||
                          totalMeters;
                        const totalAmount =
                          (Number(watchLine.ratePerRoll) || 0) * amountMeters;
                        const meterPerRoll =
                          Number(watchLine.lengthMetersPerRoll) || 0;
                        const inwardMeters =
                          Number(watchLine.inwardMeters) || 0;
                        const derivedInwardRolls = deriveInwardRolls(
                          inwardMeters,
                          meterPerRoll
                        );
                        const balanceOrder =
                          (Number(watchLine.qtyRolls) || 0) -
                          derivedInwardRolls;

                        return (
                          <TableRow key={field.id}>
                            <TableCell>{field.poNumber || ""}</TableCell>
                            <TableCell>
                              {isManual ? (
                                <Autocomplete
                                  {...buildSingleSelectAutocompleteProps(
                                    skuOptions,
                                    normalizedSkuId,
                                    (value) =>
                                      handleManualLineSKUChange(index, value)
                                  )}
                                  size="small"
                                  fullWidth
                                  renderInput={(params) => (
                                    <TextField {...params} />
                                  )}
                                />
                              ) : (
                                field.skuCode || field.skuId
                              )}
                            </TableCell>
                            <TableCell>
                              {isManual ? (
                                <NumericFormat
                                  value={watchLine.ratePerRoll}
                                  customInput={TextField}
                                  size="small"
                                  thousandSeparator=","
                                  decimalScale={2}
                                  sx={{ width: 110 }}
                                  onValueChange={(values) => {
                                    const rateVal = Number(values.value) || 0;
                                    setValue(
                                      `lines.${index}.ratePerRoll`,
                                      rateVal
                                    );
                                    if (isManual) {
                                      recomputeManualLineTotal(index, {
                                        ratePerRoll: rateVal,
                                      });
                                    }
                                  }}
                                />
                              ) : (
                                formatCurrency(field.ratePerRoll)
                              )}
                            </TableCell>
                            <TableCell>
                              {isManual ? (
                                <Controller
                                  name={`lines.${index}.lengthMetersPerRoll`}
                                  control={control}
                                  render={({ field }) => (
                                    <TextField
                                      {...field}
                                      type="number"
                                      size="small"
                                      sx={{ width: 110 }}
                                    />
                                  )}
                                />
                              ) : (
                                field.lengthMetersPerRoll
                              )}
                            </TableCell>
                            <TableCell>
                              {isManual ? (
                                <Controller
                                  name={`lines.${index}.qtyRolls`}
                                  control={control}
                                  render={({ field }) => (
                                    <TextField
                                      {...field}
                                      type="number"
                                      size="small"
                                      sx={{ width: 90 }}
                                      onChange={(e) => {
                                        const val = Number(e.target.value) || 0;
                                        field.onChange(val);
                                        recomputeManualLineTotal(index, {
                                          qtyRolls: val,
                                        });
                                      }}
                                    />
                                  )}
                                />
                              ) : (
                                watchLines[index]?.qtyRolls
                              )}
                            </TableCell>
                            <TableCell>{totalMeters}</TableCell>
                            <TableCell>{formatCurrency(totalAmount)}</TableCell>
                            <TableCell>
                              {isManual ? (
                                <TextField
                                  value={derivedInwardRolls}
                                  size="small"
                                  sx={{ width: 110 }}
                                  InputProps={{
                                    readOnly: true,
                                    endAdornment: (
                                      <InputAdornment position="end">
                                        <Tooltip
                                          title={
                                            meterPerRoll > 0
                                              ? `Derived as ceil(${
                                                  inwardMeters || 0
                                                } / ${meterPerRoll})`
                                              : "Add meter/roll to derive inward rolls"
                                          }
                                        >
                                          <InfoIcon
                                            fontSize="small"
                                            color="action"
                                          />
                                        </Tooltip>
                                      </InputAdornment>
                                    ),
                                  }}
                                />
                              ) : (
                                derivedInwardRolls
                              )}
                            </TableCell>
                            <TableCell>
                              {isManual ? (
                                <Controller
                                  name={`lines.${index}.inwardMeters`}
                                  control={control}
                                  render={({ field }) => (
                                    <TextField
                                      {...field}
                                      type="number"
                                      size="small"
                                      sx={{ width: 100 }}
                                      onChange={(e) => {
                                        const meters =
                                          Number(e.target.value) || 0;
                                        field.onChange(meters);
                                        setValue(
                                          `lines.${index}.inwardRolls`,
                                          deriveInwardRolls(
                                            meters,
                                            meterPerRoll
                                          )
                                        );
                                      }}
                                    />
                                  )}
                                />
                              ) : (
                                inwardMeters
                              )}
                            </TableCell>
                            <TableCell>{balanceOrder}</TableCell>
                          </TableRow>
                        );
                      })}
                      {lineFields.length > 0 && (
                        <TableRow sx={{ fontWeight: 600, bgcolor: "grey.100" }}>
                          <TableCell colSpan={4}>Totals</TableCell>
                          <TableCell>
                            {lineFields.reduce(
                              (sum, _, idx) =>
                                sum + (Number(watchLines[idx]?.qtyRolls) || 0),
                              0
                            )}
                          </TableCell>
                          <TableCell>
                            {lineFields.reduce(
                              (sum, _, idx) =>
                                sum +
                                (Number(
                                  watchLines[idx]?.totalMeters ??
                                    lineFields[idx]?.totalMeters
                                ) ||
                                  (Number(
                                    watchLines[idx]?.lengthMetersPerRoll
                                  ) || 0) *
                                    (Number(watchLines[idx]?.qtyRolls) || 0)),
                              0
                            )}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(
                              lineFields.reduce((sum, _, idx) => {
                                const meters =
                                  Number(
                                    watchLines[idx]?.inwardMeters ||
                                      watchLines[idx]?.totalMeters ||
                                      lineFields[idx]?.totalMeters
                                  ) ||
                                  (Number(
                                    watchLines[idx]?.lengthMetersPerRoll
                                  ) || 0) *
                                    (Number(watchLines[idx]?.qtyRolls) || 0);
                                const rate =
                                  Number(watchLines[idx]?.ratePerRoll) || 0;
                                return sum + meters * rate;
                              }, 0)
                            )}
                          </TableCell>
                          <TableCell>
                            {lineFields.reduce(
                              (sum, _, idx) =>
                                sum +
                                deriveInwardRolls(
                                  Number(watchLines[idx]?.inwardMeters) || 0,
                                  Number(
                                    watchLines[idx]?.lengthMetersPerRoll
                                  ) || 0
                                ),
                              0
                            )}
                          </TableCell>
                          <TableCell>
                            {lineFields.reduce(
                              (sum, _, idx) =>
                                sum +
                                (Number(watchLines[idx]?.inwardMeters) || 0),
                              0
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={addManualLine}
                  >
                    Add Line
                  </Button>
                </Box>
              </>
            )}

            <Divider sx={{ my: 2 }} />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              {landedCostFields.length > 0 && (
                <Typography variant="h6">Landed Costs</Typography>
              )}
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  appendLandedCost({
                    type: "Freight",
                    amount: 0,
                    allocationBasis: "ROLL",
                    description: "",
                  })
                }
                size="small"
              >
                Add Landed Cost
              </Button>
            </Box>

            {landedCostFields.length > 0 && (
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Allocation Basis</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {landedCostFields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Controller
                            name={`landedCosts.${index}.type`}
                            control={control}
                            render={({ field }) => (
                              <Autocomplete
                                {...buildSingleSelectAutocompleteProps(
                                  landedCostTypeOptions,
                                  field.value,
                                  field.onChange
                                )}
                                size="small"
                                fullWidth
                                renderInput={(params) => (
                                  <TextField {...params} />
                                )}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`landedCosts.${index}.amount`}
                            control={control}
                            render={({ field }) => (
                              <NumericFormat
                                {...field}
                                customInput={TextField}
                                size="small"
                                thousandSeparator=","
                                decimalScale={2}
                                valueIsNumericString
                                onValueChange={(values) =>
                                  field.onChange(values.value)
                                }
                                sx={{ width: 120 }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`landedCosts.${index}.allocationBasis`}
                            control={control}
                            render={({ field }) => (
                              <Autocomplete
                                {...buildSingleSelectAutocompleteProps(
                                  landedCostAllocationOptions,
                                  field.value,
                                  field.onChange
                                )}
                                size="small"
                                fullWidth
                                renderInput={(params) => (
                                  <TextField {...params} />
                                )}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            name={`landedCosts.${index}.description`}
                            control={control}
                            render={({ field }) => (
                              <TextField {...field} size="small" fullWidth />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => removeLandedCost(index)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2} sx={{ mt: 2, mb: 2 }}>
              <Controller
                name="gstMode"
                control={control}
                render={({ field }) => <input type="hidden" {...field} />}
              />

              {watchGstMode === "inter" ? (
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="IGST (18%)"
                    value={formatCurrency(totals.igst)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              ) : (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="SGST (9%)"
                      value={formatCurrency(totals.sgst)}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CGST (9%)"
                      value={formatCurrency(totals.cgst)}
                      InputProps={{ readOnly: true }}
                    />
                  </Grid>
                </>
              )}
            </Grid>

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
                    {watchGstMode === "inter"
                      ? `IGST (18%): ${formatCurrency(totals.igst)}`
                      : `SGST (9%): ${formatCurrency(totals.sgst)}`}
                  </Typography>
                  {watchGstMode !== "inter" && (
                    <Typography variant="body2" gutterBottom>
                      CGST (9%): {formatCurrency(totals.cgst)}
                    </Typography>
                  )}
                  <Typography variant="body2" gutterBottom>
                    Landed Cost: {formatCurrency(totals.totalLandedCost)}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6">
                    Grand Total: {formatCurrency(totals.grandTotal)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeInvoiceDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !!selectedInvoice && selectedInvoice.status === "Posted"
              }
            >
              {selectedInvoice ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={openOrdersModal}
        onClose={handleCloseOrdersModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Select Purchase Orders</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>PO Number</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Base Rate</TableCell>
                  <TableCell>Meter/Roll</TableCell>
                  <TableCell>Roll Quantity</TableCell>
                  <TableCell>Total Meters</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Total Inward Meters</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableLines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No lines to show. Select a supplier and click "Fetch
                      Orders".
                    </TableCell>
                  </TableRow>
                )}
                {availableLines.map((line) => {
                  const totalMeters = line?.totalMeters;
                  const totalAmount = line?.lineTotal;
                  const selected = pendingLineIds.includes(line.poLineId);
                  const pending = pendingLineValues[line.poLineId] || {};
                  const meterPerRoll = Number(line.lengthMetersPerRoll) || 0;
              const rollSummary = summarizeRollDetails(
                pending.rollDetails || line.rollDetails || []
              );
              const effectiveMeters =
                rollSummary.totalMeters ??
                pending.inwardMeters ??
                line.inwardMeters ??
                0;
              const derivedInwardRolls =
                rollSummary.totalRolls ??
                deriveInwardRolls(effectiveMeters, meterPerRoll);

                  return (
                    <TableRow key={line.poLineId} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected}
                          onChange={() => toggleLineSelection(line.poLineId)}
                        />
                      </TableCell>
                      <TableCell>{line.poNumber}</TableCell>
                      <TableCell>{line.skuCode || ""}</TableCell>
                      <TableCell>{formatCurrency(line.ratePerRoll)}</TableCell>
                      <TableCell>{line.lengthMetersPerRoll}</TableCell>
                      <TableCell>{line.qtyRolls}</TableCell>
                      <TableCell>{line?.totalMeters}</TableCell>
                      <TableCell>{formatCurrency(totalAmount)}</TableCell>
                      <TableCell>
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <TextField
                            type="number"
                            size="small"
                            sx={{ width: 140 }}
                            value={effectiveMeters}
                            onChange={(e) =>
                              setPendingMetersWithDerivedRolls(
                                line.poLineId,
                                Number(e.target.value) || 0,
                                meterPerRoll
                              )
                            }
                          />
                          <Tooltip title="View derived roll quantity">
                            <IconButton
                              size="small"
                              onClick={() =>
                                openInwardDetail(line, effectiveMeters)
                              }
                            >
                              <InfoIcon fontSize="small" color="action" />
                            </IconButton>
                          </Tooltip>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openRollDetailsDialog(line)}
                          >
                            Add Rolls
                          </Button>
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Rolls: {rollSummary.totalRolls || 0} | Meters:{" "}
                          {rollSummary.totalMeters || 0}
                        </Typography>
                      </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOrdersModal}>Cancel</Button>
          <Button variant="contained" onClick={applySelectedOrders}>
            Select Orders
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rollDetailsDialog.open}
        onClose={closeRollDetailsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Roll Details</DialogTitle>
        <DialogContent dividers>
          {rollDetailsDialog.line && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                PO: {rollDetailsDialog.line.poNumber} | SKU:{" "}
                {rollDetailsDialog.line.skuCode || "N/A"}
              </Typography>
              {rollDetailsDialog.rows.map((row, idx) => (
                <Grid
                  container
                  spacing={1}
                  alignItems="center"
                  key={`roll-row-${idx}`}
                  sx={{ mb: 1 }}
                >
                  <Grid item xs={5}>
                    <TextField
                      label="Roll Quantity"
                      type="number"
                      size="small"
                      fullWidth
                      value={row.rollQty}
                      onChange={(e) =>
                        updateRollDetailRow(idx, "rollQty", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      label="Meters / Roll"
                      type="number"
                      size="small"
                      fullWidth
                      value={row.metersPerRoll}
                      onChange={(e) =>
                        updateRollDetailRow(
                          idx,
                          "metersPerRoll",
                          e.target.value
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton
                      size="small"
                      onClick={() => removeRollDetailRow(idx)}
                      disabled={(rollDetailsDialog.rows || []).length <= 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={addRollDetailRow}
                sx={{ mb: 1 }}
              >
                Add Row
              </Button>
              {(() => {
                const summary = summarizeRollDetails(rollDetailsDialog.rows);
                const maxRolls = Number(rollDetailsDialog.line?.qtyRolls) || 0;
                const maxMeters =
                  maxRolls *
                  (Number(rollDetailsDialog.line?.lengthMetersPerRoll) || 0);
                const rollsOver =
                  maxRolls > 0 && summary.totalRolls > maxRolls;
                const metersOver =
                  maxMeters > 0 && summary.totalMeters > maxMeters;
                const hasError = rollsOver || metersOver;
                return (
                  <Box
                    sx={{
                      mt: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: hasError ? "error.50" : "grey.50",
                      border: "1px solid",
                      borderColor: hasError ? "error.light" : "divider",
                    }}
                  >
                    <Box
                      sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        color={rollsOver ? "error" : "text.secondary"}
                        fontWeight={rollsOver ? 600 : 400}
                      >
                        Rolls: {summary.totalRolls}
                        {maxRolls > 0 && ` / ${maxRolls}`}
                        {rollsOver && " ⚠ exceeds ordered"}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={metersOver ? "error" : "text.secondary"}
                        fontWeight={metersOver ? 600 : 400}
                      >
                        Meters: {summary.totalMeters}
                        {maxMeters > 0 && ` / ${maxMeters}`}
                        {metersOver && " ⚠ exceeds ordered"}
                      </Typography>
                    </Box>
                    {hasError && (
                      <Typography variant="caption" color="error">
                        Total cannot exceed the ordered quantity. Adjust roll
                        entries before saving.
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRollDetailsDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveRollDetails}
            disabled={(() => {
              const summary = summarizeRollDetails(rollDetailsDialog.rows);
              const maxRolls =
                Number(rollDetailsDialog.line?.qtyRolls) || 0;
              const maxMeters =
                maxRolls *
                (Number(rollDetailsDialog.line?.lengthMetersPerRoll) || 0);
              return (
                (maxRolls > 0 && summary.totalRolls > maxRolls) ||
                (maxMeters > 0 && summary.totalMeters > maxMeters)
              );
            })()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inwardDetail.open} onClose={closeInwardDetail}>
        <DialogTitle>Inward Rolls</DialogTitle>
        <DialogContent dividers>
          {(() => {
            const meterPerRoll =
              Number(inwardDetail?.line?.lengthMetersPerRoll) || 0;
            const meters = Number(inwardDetail.effectiveMeters) || 0;
            const derivedRolls = deriveInwardRolls(meters, meterPerRoll);
            return (
              <Box sx={{ minWidth: 280 }}>
                <Typography variant="body2" gutterBottom>
                  Total Inward Meters: {meters}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Meter/Roll: {meterPerRoll}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Roll Quantity: {derivedRolls}
                </Typography>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeInwardDetail}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        onConfirm={confirmPostInvoice}
        title="Post Invoice"
        message="Are you sure you want to post this invoice? This will update inventory costs and create accounting entries."
        confirmColor="primary"
      />
    </Box>
  );
};

export default PurchaseInvoices;

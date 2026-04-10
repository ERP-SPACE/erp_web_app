import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  IconButton,
  Grid,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Cancel as CancelIcon,
  CheckCircle as UnblockIcon,
  Block as BlockIcon,
  CreditCard as CreditIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import masterService from "../../services/masterService";
import { formatCurrency, formatDate } from "../../utils/formatters";

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const Customers = () => {
  const { showNotification, setLoading } = useApp();
  const [customers, setCustomers] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [agents, setAgents] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [creditCheckDialog, setCreditCheckDialog] = useState(false);
  const [creditCheckResult, setCreditCheckResult] = useState(null);
  const [rateHistoryDialog, setRateHistoryDialog] = useState(false);
  const [rateHistory, setRateHistory] = useState([]);
  const [loadingRateHistory, setLoadingRateHistory] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Per-Product pricing state
  const [products, setProducts] = useState([]);
  const [customerBaseRates, setCustomerBaseRates] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [baseRateValue, setBaseRateValue] = useState("");
  const [loadingBaseRates, setLoadingBaseRates] = useState(false);
  const [baseRateDeleteId, setBaseRateDeleteId] = useState(null);
  const [openBaseRateConfirm, setOpenBaseRateConfirm] = useState(false);
  const [openEditRateDialog, setOpenEditRateDialog] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [editRateValue, setEditRateValue] = useState("");
  const [rateHistorySku, setRateHistorySku] = useState(null);

  // Agent commission (for this customer) UI state
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionAgent, setCommissionAgent] = useState(null);
  const [commissionEntry, setCommissionEntry] = useState(null);
  const [commissionForm, setCommissionForm] = useState({
    commissionType: "percentage",
    amountPerMeter: "",
    percentage: 5,
    applyByDefault: true,
    effectiveFrom: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const agentOptions = [
    { value: "", label: "Unassigned" },
    ...agents.map((agent) => ({
      value: agent._id,
      label: `${agent.name}${agent.agentCode ? ` (${agent.agentCode})` : ""}`,
    })),
  ];
  const blockRuleOptions = [
    { value: "OVER_LIMIT", label: "Credit Over Limit" },
    { value: "OVER_DUE", label: "Days Over Due" },
    { value: "BOTH", label: "Any Breach (Limit or Days)" },
  ];

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return value._id || value.id || "";
    return String(value);
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: "",
      gstin: "",
      agentId: "",
      state: "",
      address: {
        billing: {
          line1: "",
          line2: "",
          city: "",
          pincode: "",
        },
      },
      customerGroupIds: [],
      contactPersons: [{ name: "", phone: "", email: "", isPrimary: true }],
      referralSource: {
        source: "",
        name: "",
        contact: "",
        company: "",
        remarks: "",
      },
      businessInfo: {
        targetSalesMeters: 0,
      },
      creditPolicy: {
        creditLimit: 0,
        creditDays: 0,
        graceDays: 0,
        autoBlock: false,
        blockRule: "BOTH",
      },
      active: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contactPersons",
  });

  useEffect(() => {
    fetchCustomers();
    fetchCustomerGroups();
    fetchAgents();
    fetchProducts();
  }, []);


  const loadCustomerCommissionFromAgent = useCallback(
    async (agentId, customerId) => {
      const resolvedAgentId = normalizeId(agentId);
      const resolvedCustomerId = normalizeId(customerId);

      if (!resolvedAgentId || !resolvedCustomerId) {
        setCommissionAgent(null);
        setCommissionEntry(null);
        setCommissionForm((prev) => ({
          ...prev,
          commissionType: "percentage",
          amountPerMeter: "",
          percentage: 5,
          applyByDefault: true,
          effectiveFrom: new Date().toISOString().split("T")[0],
          notes: "",
        }));
        return;
      }

      setCommissionLoading(true);
      try {
        const agent = await masterService.getAgent(resolvedAgentId);
        const agentDoc = agent?.data || agent;
        setCommissionAgent(agentDoc);

        const commissions = Array.isArray(agentDoc?.partyCommissions)
          ? agentDoc.partyCommissions
          : [];
        const entry =
          commissions.find(
            (c) => normalizeId(c?.customer) === resolvedCustomerId
          ) || null;
        setCommissionEntry(entry);

        setCommissionForm({
          commissionType: entry?.commissionType || "percentage",
          amountPerMeter:
            entry?.commissionType === "per_meter"
              ? String(entry?.amountPerMeter ?? "")
              : "",
          percentage:
            entry?.commissionType === "percentage"
              ? Number(entry?.percentage ?? 0)
              : 0,
          applyByDefault:
            entry?.applyByDefault === undefined ? true : Boolean(entry.applyByDefault),
          effectiveFrom: new Date().toISOString().split("T")[0],
          notes: entry?.notes || "",
        });
      } catch (error) {
        setCommissionAgent(null);
        setCommissionEntry(null);
      } finally {
        setCommissionLoading(false);
      }
    },
    []
  );

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await masterService.getCustomers();
      setCustomers(response.data || response.customers || []);
    } catch (error) {
      showNotification("Failed to fetch customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerGroups = async () => {
    try {
      const response = await masterService.getCustomerGroups({ active: true });
      setCustomerGroups(response.data || response.customerGroups || []);
    } catch (error) {
      console.error("Failed to fetch customer groups:", error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await masterService.getAgents({
        active: true,
        limit: 500,
      });
      setAgents(response.agents || response.data || []);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await masterService.getProducts({ limit: 2000 });
      setProducts(response.products || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const fetchCustomerBaseRates = useCallback(
    async (customerId) => {
      if (!customerId) return;
      setLoadingBaseRates(true);
      try {
        const res = await masterService.getCustomerRates(customerId);
        const rates = Array.isArray(res) ? res : res?.data || [];
        setCustomerBaseRates(rates);
      } catch (error) {
        showNotification("Failed to fetch rates", "error");
        setCustomerBaseRates([]);
      } finally {
        setLoadingBaseRates(false);
      }
    },
    [showNotification]
  );

  const availableProducts = useMemo(() => {
    const existingProductIds = new Set(
      customerBaseRates
        .map((rate) =>
          rate?.productId?._id ||
          rate?.productId ||
          rate?.skuId?.productId?._id ||
          rate?.skuId?.productId
        )
        .filter(Boolean)
        .map(String)
    );
    return products.filter(
      (product) => !existingProductIds.has(String(product._id))
    );
  }, [products, customerBaseRates]);

  const handleAddBaseRate = async () => {
    if (!selectedCustomer) {
      showNotification("Please save the customer first", "warning");
      return;
    }
    if (!selectedProduct) {
      showNotification("Please select a product", "warning");
      return;
    }
    if (!baseRateValue || isNaN(parseFloat(baseRateValue))) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }
    try {
      await masterService.setCustomerRate(selectedCustomer._id, {
        productId: selectedProduct._id,
        baseRate: parseFloat(baseRateValue),
      });
      showNotification("Rate added successfully", "success");
      setSelectedProduct(null);
      setBaseRateValue("");
      fetchCustomerBaseRates(selectedCustomer._id);
    } catch (error) {
      showNotification(error.message || "Failed to save rate", "error");
    }
  };

  const handleDeleteBaseRate = (productId) => {
    setBaseRateDeleteId(productId);
    setOpenBaseRateConfirm(true);
  };

  const confirmDeleteBaseRate = async () => {
    if (!selectedCustomer || !baseRateDeleteId) return;
    try {
      await masterService.deleteCustomerRate(selectedCustomer._id, baseRateDeleteId);
      showNotification("Rate deleted successfully", "success");
      fetchCustomerBaseRates(selectedCustomer._id);
    } catch (error) {
      showNotification("Failed to delete rate", "error");
    }
    setOpenBaseRateConfirm(false);
    setBaseRateDeleteId(null);
  };

  const handleEditBaseRate = (rate) => {
    setEditingRate(rate);
    setEditRateValue(rate.baseRate?.toString() || "");
    setOpenEditRateDialog(true);
  };

  const handleSaveEditedRate = async () => {
    if (!selectedCustomer || !editingRate) return;
    if (!editRateValue || isNaN(parseFloat(editRateValue))) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }
    const newRate = parseFloat(editRateValue);
    if (newRate === editingRate.baseRate) {
      showNotification("Rate is unchanged", "info");
      setOpenEditRateDialog(false);
      return;
    }
    try {
      const productId =
        editingRate?.productId?._id ||
        editingRate?.productId ||
        editingRate?.skuId?.productId?._id ||
        editingRate?.skuId?.productId ||
        null;
      await masterService.setCustomerRate(selectedCustomer._id, {
        ...(productId ? { productId } : { skuId: editingRate.skuId._id }),
        baseRate: newRate,
      });
      showNotification("Rate updated successfully", "success");
      setOpenEditRateDialog(false);
      setEditingRate(null);
      setEditRateValue("");
      fetchCustomerBaseRates(selectedCustomer._id);
    } catch (error) {
      showNotification(error.message || "Failed to update rate", "error");
    }
  };

  const resetGroupForm = () =>
    setNewGroupForm({ name: "", code: "", description: "" });

  const handleOpenGroupDialog = () => {
    setGroupDialogOpen(true);
  };

  const handleCloseGroupDialog = () => {
    if (creatingGroup) return;
    setGroupDialogOpen(false);
    resetGroupForm();
  };

  const handleCreateCustomerGroup = async () => {
    if (!newGroupForm.name.trim() || !newGroupForm.code.trim()) {
      showNotification("Name and code are required", "warning");
      return;
    }

    try {
      setCreatingGroup(true);
      const response = await masterService.createCustomerGroup({
        name: newGroupForm.name.trim(),
        code: newGroupForm.code.trim(),
        description: newGroupForm.description?.trim(),
        active: true,
      });
      const createdGroup = response.data || response;
      setCustomerGroups((prev) =>
        [...prev, createdGroup].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );
      const createdId = createdGroup._id || createdGroup.id;
      const currentSelection = watch("customerGroupIds") || [];
      setValue(
        "customerGroupIds",
        [...new Set([...currentSelection, createdId])],
        { shouldValidate: true }
      );
      showNotification("Customer group added", "success");
      setGroupDialogOpen(false);
      resetGroupForm();
    } catch (error) {
      showNotification(
        error.message || "Failed to create customer group",
        "error"
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAgentChange = async (agentId, customerIdOverride = null) => {
    const customerId = customerIdOverride || selectedCustomer?._id || null;
    if (!agentId || !customerId) return;

    try {
      const commissionPayload = {
        customer: customerId,
        commissionType: "percentage",
        percentage: 5,
        applyByDefault: true,
        effectiveFrom: new Date().toISOString().split('T')[0],
        notes: "Auto-created default commission when agent was assigned to customer",
      };

      await masterService.upsertAgentPartyCommission(agentId, commissionPayload);
      showNotification("Default commission created for the selected agent", "success");
      await loadCustomerCommissionFromAgent(agentId, customerId);
    } catch (error) {
      showNotification(
        error.message || "Failed to create default commission",
        "error"
      );
    }
  };

  const watchAgentId = watch("agentId");

  useEffect(() => {
    if (!openDialog) return;
    if (!watchAgentId || !selectedCustomer?._id) return;
    loadCustomerCommissionFromAgent(watchAgentId, selectedCustomer._id);
  }, [openDialog, watchAgentId, selectedCustomer?._id, loadCustomerCommissionFromAgent]);

  const handleSaveCustomerCommission = async () => {
    const agentId = normalizeId(watchAgentId);
    const customerId = normalizeId(selectedCustomer?._id);
    if (!agentId || !customerId) return;

    const payload = {
      customer: customerId,
      commissionType: commissionForm.commissionType,
      applyByDefault: Boolean(commissionForm.applyByDefault),
      effectiveFrom: commissionForm.effectiveFrom,
      notes: commissionForm.notes,
      amountPerMeter:
        commissionForm.commissionType === "per_meter"
          ? Number(commissionForm.amountPerMeter || 0)
          : undefined,
      percentage:
        commissionForm.commissionType === "percentage"
          ? Number(commissionForm.percentage || 0)
          : undefined,
    };

    try {
      await masterService.upsertAgentPartyCommission(agentId, payload);
      showNotification("Commission updated for this customer", "success");
      await loadCustomerCommissionFromAgent(agentId, customerId);
    } catch (error) {
      showNotification(error.message || "Failed to update commission", "error");
    }
  };

  const handleRemoveCustomerCommission = async () => {
    const agentId = normalizeId(watchAgentId);
    const customerId = normalizeId(selectedCustomer?._id);
    if (!agentId || !customerId) return;

    try {
      await masterService.removeAgentPartyCommission(
        agentId,
        customerId,
        "Removed from customer modal"
      );
      showNotification("Commission removed for this customer", "success");
      await loadCustomerCommissionFromAgent(agentId, customerId);
    } catch (error) {
      showNotification(error.message || "Failed to remove commission", "error");
    }
  };

  const handleAdd = () => {
    setSelectedCustomer(null);
    reset({
      companyName: "",
      gstin: "",
      agentId: "",
      state: "",
      address: {
        billing: {
          line1: "",
          line2: "",
          city: "",
          pincode: "",
        },
      },
      customerGroupIds: [],
      contactPersons: [{ name: "", phone: "", email: "", isPrimary: true }],
      referralSource: {
        source: "",
        name: "",
        contact: "",
        company: "",
        remarks: "",
      },
      businessInfo: {
        targetSalesMeters: 0,
      },
      creditPolicy: {
        creditLimit: 0,
        creditDays: 0,
        graceDays: 0,
        autoBlock: false,
        blockRule: "BOTH",
      },
      active: true,
    });
    setCustomerBaseRates([]);
    setSelectedProduct(null);
    setBaseRateValue("");
    setTabValue(0);
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setSelectedCustomer(row);
    const normalizedGroupIds = row.customerGroupIds?.length
      ? row.customerGroupIds.map((group) => group?._id || group)
      : row.customerGroupId
      ? [row.customerGroupId._id || row.customerGroupId]
      : [];

    reset({
      companyName: row.companyName || "",
      gstin: row.gstin || "",
      agentId: row.agentId?._id || row.agentId || "",
      state: row.state || "",
      address: row.address || {
        billing: {
          line1: "",
          line2: "",
          city: "",
          pincode: "",
        },
      },
      customerGroupIds: normalizedGroupIds,
      contactPersons: row.contactPersons || [
        { name: "", phone: "", email: "", isPrimary: true },
      ],
      referralSource: row.referral || {
        source: "",
        name: "",
        contact: "",
        company: "",
        remarks: "",
      },
      businessInfo: row.businessInfo || { targetSalesMeters: 0 },
      creditPolicy: row.creditPolicy || {
        creditLimit: 0,
        creditDays: 0,
        graceDays: 0,
        autoBlock: false,
        blockRule: "BOTH",
      },
      active: row.active !== undefined ? row.active : true,
    });
    setCustomerBaseRates([]);
    setSelectedProduct(null);
    setBaseRateValue("");
    setTabValue(0);
    setOpenDialog(true);
    fetchCustomerBaseRates(row._id);
  };

  const handleDelete = (row) => {
    setDeleteId(row._id);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await masterService.deleteCustomer(deleteId);
      showNotification("Customer deleted successfully", "success");
      fetchCustomers();
    } catch (error) {
      showNotification("Failed to delete customer", "error");
    }
    setOpenConfirm(false);
  };

  const handleCreditCheck = async (row) => {
    setLoading(true);
    try {
      const response = await masterService.checkCredit(row._id);
      setCreditCheckResult(response?.data || response);
      setCreditCheckDialog(true);
    } catch (error) {
      showNotification("Failed to check credit", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (row) => {
    const reason = prompt("Enter reason for blocking:");
    if (reason) {
      try {
        await masterService.blockCustomer(row._id, reason);
        showNotification("Customer blocked successfully", "success");
        fetchCustomers();
      } catch (error) {
        showNotification("Failed to block customer", "error");
      }
    }
  };

  const handleUnblock = async (row) => {
    try {
      await masterService.unblockCustomer(row._id);
      showNotification("Customer unblocked successfully", "success");
      fetchCustomers();
    } catch (error) {
      showNotification("Failed to unblock customer", "error");
    }
  };

  const handleViewRateHistory = async (productId = null, product = null) => {
    if (!selectedCustomer?._id) return;
    setRateHistorySku(product);
    setLoadingRateHistory(true);
    setRateHistoryDialog(true);
    try {
      const history = await masterService.getCustomerRateHistory(
        selectedCustomer._id,
        productId
      );
      setRateHistory(history);
    } catch (error) {
      showNotification("Failed to fetch rate history", "error");
      setRateHistory([]);
    } finally {
      setLoadingRateHistory(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      // Sanitize numeric fields - convert formatted strings to numbers
      const sanitizedData = { ...data };

      const normalizedContactPersons = Array.isArray(sanitizedData.contactPersons)
        ? sanitizedData.contactPersons
            .map((person = {}) => ({
              ...person,
              name: (person.name || "").trim(),
              phone: (person.phone || "").trim(),
              email: (person.email || "").trim(),
              designation: (person.designation || "").trim(),
              whatsapp: (person.whatsapp || "").trim(),
            }))
            .filter(
              (person) =>
                person.name ||
                person.phone ||
                person.email ||
                person.designation ||
                person.whatsapp
            )
        : [];

      if (
        normalizedContactPersons.length > 0 &&
        !normalizedContactPersons.some((person) => person.isPrimary)
      ) {
        normalizedContactPersons[0].isPrimary = true;
      }

      sanitizedData.contactPersons = normalizedContactPersons;

      // Convert creditPolicy numeric fields
      if (sanitizedData.creditPolicy) {
        if (typeof sanitizedData.creditPolicy.creditLimit === "string") {
          sanitizedData.creditPolicy.creditLimit =
            parseFloat(
              sanitizedData.creditPolicy.creditLimit.replace(/[₹,\s]/g, "")
            ) || 0;
        }
        if (typeof sanitizedData.creditPolicy.creditDays === "string") {
          sanitizedData.creditPolicy.creditDays =
            parseInt(
              sanitizedData.creditPolicy.creditDays.replace(/[,\s]/g, "")
            ) || 0;
        }
        if (typeof sanitizedData.creditPolicy.graceDays === "string") {
          sanitizedData.creditPolicy.graceDays =
            parseInt(
              sanitizedData.creditPolicy.graceDays.replace(/[,\s]/g, "")
            ) || 0;
        }
      }

      // Convert businessInfo numeric fields
      if (sanitizedData.businessInfo?.targetSalesMeters) {
        if (typeof sanitizedData.businessInfo.targetSalesMeters === "string") {
          sanitizedData.businessInfo.targetSalesMeters =
            parseFloat(
              sanitizedData.businessInfo.targetSalesMeters.replace(
                /[₹,\s]/g,
                ""
              )
            ) || 0;
        }
      }

      const normalizedGroups = Array.isArray(sanitizedData.customerGroupIds)
        ? sanitizedData.customerGroupIds.filter(Boolean)
        : [];

      if (!normalizedGroups.length) {
        showNotification("Select at least one customer group", "error");
        return;
      }

      sanitizedData.customerGroupIds = normalizedGroups;
      sanitizedData.customerGroupId = normalizedGroups[0];

      if (selectedCustomer) {
        await masterService.updateCustomer(selectedCustomer._id, sanitizedData);
        showNotification("Customer updated successfully", "success");
      } else {
        const created = await masterService.createCustomer(sanitizedData);
        const newCustomerId = created?._id || created?.id;
        showNotification(
          "Customer created successfully. You can now add rates.",
          "success"
        );
        if (newCustomerId) {
          // If agent was selected during creation, ensure commission is created
          // after the customer exists.
          if (sanitizedData.agentId) {
            await handleAgentChange(sanitizedData.agentId, newCustomerId);
          }
          setSelectedCustomer(created);
          setTabValue(3);
          fetchCustomers();
          return;
        }
      }

      setOpenDialog(false);
      fetchCustomers();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "customerCode", headerName: "Customer Code" },
    { field: "companyName", headerName: "Customer Name" },
    // { field: "state", headerName: "Location" },
    {
      field: "city",
      headerName: "Location",
      renderCell: (params) => {
        const row = params.row;
        const parts = [];
        if (row.address.billing.city) parts.push(row.address.billing.city);
        if (row.state) parts.push(row.state);
        return parts.length > 0 ? parts.join(", ") : "-";
      },
    },
    {
      field: "customerGroups",
      headerName: "Customer Groups",
      renderCell: (params) => {
        const groupsSource =
          (params.row.customerGroupIds && params.row.customerGroupIds.length
            ? params.row.customerGroupIds
            : params.row.customerGroupId
            ? [params.row.customerGroupId]
            : []) || [];

        const groups = groupsSource.filter(Boolean);
        if (!groups.length) return "-";

        return (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {groups.map((group) => {
              const id = group._id || group.id || group;
              const label =
                group.name && group.code
                  ? `${group.name} (${group.code})`
                  : group.name || group.code || group;
              return (
                <Chip
                  key={id}
                  label={label}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              );
            })}
          </Box>
        );
      },
    },
    {
      field: "agent",
      headerName: "Agent",
      renderCell: (params) => {
        const agent = params.row.agentId;
        if (!agent) return "-";

        if (typeof agent === "string") {
          return agent;
        }

        const name = agent.name || agent.agentCode || agent._id || "-";
        const code = agent.agentCode ? ` (${agent.agentCode})` : "";
        return `${name}${code}`;
      },
    },
    {
      field: "creditPolicy",
      headerName: "Credit Limit",
      renderCell: (params) => formatCurrency(params.value?.creditLimit || 0),
    },
    {
      field: "creditDays",
      headerName: "Credit Days",
      renderCell: (params) => params.row.creditPolicy?.creditDays ?? 0,
    },
    {
      field: "graceDays",
      headerName: "Grace Days",
      renderCell: (params) => params.row.creditPolicy?.graceDays ?? 0,
    },
    {
      field: "isBlocked",
      headerName: "Status",
      renderCell: (params) => {
        const isBlocked = params.row.creditPolicy?.isBlocked || false;
        return (
          <Chip
            label={isBlocked ? "Blocked" : "Active"}
            color={isBlocked ? "error" : "success"}
            size="small"
          />
        );
      },
    },
  ];

  const customActions = [
    {
      icon: <CreditIcon />,
      label: "Check Credit",
      onClick: handleCreditCheck,
    },
    {
      icon: <BlockIcon />,
      label: "Block",
      onClick: handleBlock,
      show: (row) => !row.creditPolicy?.isBlocked,
    },
    {
      icon: <UnblockIcon />,
      label: "Unblock",
      onClick: handleUnblock,
      show: (row) => row.creditPolicy?.isBlocked,
    },
  ];

  return (
    <Box>
      <DataTable
        title="Customers"
        columns={columns}
        rows={customers}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
            {selectedCustomer ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
          <DialogContent>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label="Basic Info" />
              <Tab label="Contact Details" />
              <Tab label="Credit Policy" />
              <Tab label="Rates (Default)" />
              <Tab label="Commission" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="companyName"
                    control={control}
                    rules={{ required: "Customer name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Company Name"
                        error={!!errors.companyName}
                        helperText={errors.companyName?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="gstin"
                    control={control}
                    rules={{ required: "GSTIN is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="GSTIN"
                        error={!!errors.gstin}
                        helperText={errors.gstin?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="address.billing.line1"
                    control={control}
                    rules={{ required: "Address line 1 is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Address Line 1"
                        error={!!errors.address?.billing?.line1}
                        helperText={errors.address?.billing?.line1?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="address.billing.line2"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Address Line 2" />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Controller
                    name="state"
                    control={control}
                    rules={{ required: "State is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="State"
                        error={!!errors.state}
                        helperText={errors.state?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Controller
                    name="address.billing.city"
                    control={control}
                    rules={{ required: "City is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="City"
                        error={!!errors.address?.billing?.city}
                        helperText={errors.address?.billing?.city?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Controller
                    name="address.billing.pincode"
                    control={control}
                    rules={{ required: "Pincode is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Pincode"
                        error={!!errors.address?.billing?.pincode}
                        helperText={errors.address?.billing?.pincode?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="agentId"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        {...buildSingleSelectAutocompleteProps(
                          agentOptions,
                          field.value || "",
                          (value) => {
                            field.onChange(value);
                            handleAgentChange(value);
                          }
                        )}
                        fullWidth
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Agent"
                            error={!!errors.agentId}
                            helperText={errors.agentId?.message}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="customerGroupIds"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value && value.length
                          ? true
                          : "Select at least one customer group",
                    }}
                    render={({ field }) => {
                      const selectedValues = field.value || [];
                      const toggleGroup = (groupId) => {
                        if (selectedValues.includes(groupId)) {
                          field.onChange(
                            selectedValues.filter((id) => id !== groupId)
                          );
                        } else {
                          field.onChange([...selectedValues, groupId]);
                        }
                      };

                      return (
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Customer Groups
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 1,
                            }}
                          >
                            {customerGroups.map((group) => {
                              const id = group._id || group.id;
                              const isSelected = selectedValues.includes(id);
                              return (
                                <Chip
                                  key={id}
                                  label={`${group.name} (${group.code})`}
                                  onClick={() => toggleGroup(id)}
                                  color={isSelected ? "primary" : "default"}
                                  variant={isSelected ? "filled" : "outlined"}
                                  clickable
                                  sx={{
                                    borderRadius: 1,
                                    px: 1.5,
                                    borderWidth: 1,
                                    borderStyle: "solid",
                                    borderColor: isSelected
                                      ? "primary.main"
                                      : "grey.400",
                                    bgcolor: isSelected
                                      ? "primary.light"
                                      : "transparent",
                                  }}
                                />
                              );
                            })}
                          </Box>
                          {(!customerGroups || customerGroups.length === 0) && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              No customer groups available. Add one below.
                            </Typography>
                          )}
                          {errors.customerGroupIds && (
                            <Typography
                              color="error"
                              variant="caption"
                              sx={{ display: "block", mt: 1 }}
                            >
                              {errors.customerGroupIds.message}
                            </Typography>
                          )}
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<AddIcon fontSize="small" />}
                            sx={{ mt: 1 }}
                            onClick={handleOpenGroupDialog}
                          >
                            Add Customer Group
                          </Button>
                        </Box>
                      );
                    }}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Contact Persons
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({
                      name: "",
                      phone: "",
                      email: "",
                      isPrimary: false,
                    })
                  }
                  size="small"
                >
                  Add Contact
                </Button>
              </Box>

              {fields.map((field, index) => (
                <Paper key={field.id} sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Controller
                        name={`contactPersons.${index}.name`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Name"
                            size="small"
                            error={!!errors.contactPersons?.[index]?.name}
                            helperText={
                              errors.contactPersons?.[index]?.name?.message
                            }
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Controller
                        name={`contactPersons.${index}.phone`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Phone"
                            size="small"
                            error={!!errors.contactPersons?.[index]?.phone}
                            helperText={
                              errors.contactPersons?.[index]?.phone?.message
                            }
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Controller
                        name={`contactPersons.${index}.email`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Email"
                            size="small"
                            type="email"
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Controller
                        name={`contactPersons.${index}.isPrimary`}
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Switch {...field} checked={field.value} />
                            }
                            label="Primary"
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      {fields.length > 1 && (
                        <IconButton onClick={() => remove(index)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Grid>
                  </Grid>
                </Paper>
              ))}

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom>
                Referral Source
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="referralSource.source"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Referral Source" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="referralSource.name"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Referral Name" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="referralSource.contact"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Contact Number" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="referralSource.company"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Company Name" />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="referralSource.remarks"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Remarks"
                        multiline
                        rows={5}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="businessInfo.targetSalesMeters"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <NumericFormat
                        {...field}
                        value={value || 0}
                        onValueChange={(values) => {
                          // Store the numeric value, not the formatted string
                          onChange(values.floatValue || 0);
                        }}
                        customInput={TextField}
                        fullWidth
                        label="Monthly Target (meters)"
                        thousandSeparator=","
                        decimalScale={0}
                        allowNegative={false}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="creditPolicy.creditLimit"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <NumericFormat
                        {...field}
                        value={value || 0}
                        onValueChange={(values) => {
                          // Store the numeric value, not the formatted string
                          onChange(values.floatValue || 0);
                        }}
                        customInput={TextField}
                        fullWidth
                        label="Credit Limit (₹)"
                        thousandSeparator=","
                        decimalScale={2}
                        prefix="₹"
                        allowNegative={false}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <Controller
                    name="creditPolicy.creditDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Credit Days"
                        type="number"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <Controller
                    name="creditPolicy.graceDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Grace Days"
                        type="number"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="creditPolicy.blockRule"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        {...buildSingleSelectAutocompleteProps(
                          blockRuleOptions,
                          field.value,
                          field.onChange
                        )}
                        fullWidth
                        renderInput={(params) => (
                          <TextField {...params} label="Block Rule" />
                        )}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="creditPolicy.autoBlock"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Auto Block on Credit Breach"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              {!selectedCustomer?._id ? (
                <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                  Please save the customer first to manage commission.
                </Typography>
              ) : !watchAgentId ? (
                <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                  Please select an agent first to manage commission.
                </Typography>
              ) : (
                <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Commission (for this customer)
                  </Typography>

                  {commissionLoading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading commission…
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <InputLabel id="commission-type-label">
                            Commission Type
                          </InputLabel>
                          <Select
                            labelId="commission-type-label"
                            label="Commission Type"
                            value={commissionForm.commissionType}
                            onChange={(e) =>
                              setCommissionForm((prev) => ({
                                ...prev,
                                commissionType: e.target.value,
                                amountPerMeter: "",
                                percentage: 0,
                              }))
                            }
                          >
                            <MenuItem value="per_meter">Per Meter</MenuItem>
                            <MenuItem value="percentage">Percentage</MenuItem>
                          </Select>
                        </FormControl>

                        {commissionForm.commissionType === "per_meter" ? (
                          <TextField
                            size="small"
                            label="Amount / Meter (₹)"
                            type="number"
                            value={commissionForm.amountPerMeter}
                            onChange={(e) =>
                              setCommissionForm((prev) => ({
                                ...prev,
                                amountPerMeter: e.target.value,
                              }))
                            }
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                          <TextField
                            size="small"
                            label="Percentage (%)"
                            type="number"
                            value={commissionForm.percentage}
                            onChange={(e) =>
                              setCommissionForm((prev) => ({
                                ...prev,
                                percentage: e.target.value,
                              }))
                            }
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        )}

                        <TextField
                          size="small"
                          label="Effective From"
                          type="date"
                          value={commissionForm.effectiveFrom}
                          onChange={(e) =>
                            setCommissionForm((prev) => ({
                              ...prev,
                              effectiveFrom: e.target.value,
                            }))
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </Box>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(commissionForm.applyByDefault)}
                            onChange={(e) =>
                              setCommissionForm((prev) => ({
                                ...prev,
                                applyByDefault: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Apply by default"
                      />

                      <TextField
                        size="small"
                        label="Notes"
                        value={commissionForm.notes}
                        onChange={(e) =>
                          setCommissionForm((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        multiline
                        minRows={2}
                        placeholder="Optional"
                      />

                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="contained"
                          onClick={handleSaveCustomerCommission}
                        >
                          Save Commission
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={handleRemoveCustomerCommission}
                          disabled={!commissionEntry}
                        >
                          Remove
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Agent: {commissionAgent?.name || "—"}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Paper>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {!selectedCustomer ? (
                <Typography
                  color="text.secondary"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  Please save the customer first to manage rates.
                </Typography>
              ) : (
                <Box>
                  {/* Add Base Rate Form */}
                  <Paper sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
                    <Typography variant="subtitle2" gutterBottom>
                    Add New Base Rate (44" Benchmark)
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <Autocomplete
                          value={selectedProduct}
                          onChange={(event, newValue) => {
                            setSelectedProduct(newValue);
                            setBaseRateValue("");
                          }}
                          options={availableProducts}
                          getOptionLabel={(option) =>
                            option.productCode || option.productAlias || ""
                          }
                          filterOptions={(options, { inputValue }) => {
                            const search = inputValue.toLowerCase().trim();
                            if (!search) return options;
                            return options.filter((option) => {
                              const searchableFields = [
                                option.productCode,
                                option.productAlias,
                                option?.categoryId?.name,
                                option?.gsmId?.name,
                                option?.qualityId?.name,
                              ];
                              return searchableFields.some(
                                (field) =>
                                  field && field.toLowerCase().includes(search)
                              );
                            });
                          }}
                          renderOption={(props, option) => (
                            <li {...props} key={option._id}>
                              {option.productCode || option.productAlias || option._id}
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Select Product"
                              placeholder="Search by product code/alias, category..."
                              size="small"
                            />
                          )}
                          isOptionEqualToValue={(option, value) =>
                            option._id === value._id
                          }
                          noOptionsText={
                            customerBaseRates.length === products.length
                              ? "All products have rates configured"
                              : "No matching products"
                          }
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Rate"
                          type="number"
                          value={baseRateValue}
                          onChange={(e) => setBaseRateValue(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">₹</InputAdornment>
                            ),
                          }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={handleAddBaseRate}
                          disabled={!selectedProduct || !baseRateValue}
                        >
                          Add
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Rates List */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2">Existing Base Rates</Typography>
                    <Tooltip title="View Full Rate History">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewRateHistory(null, null)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {loadingBaseRates ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : customerBaseRates.length === 0 ? (
                    <Typography
                      color="text.secondary"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      No rates configured for this customer.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell align="right">Rate (₹)</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {customerBaseRates.map((rate) => {
                            const product = rate.productId;
                            return (
                              <TableRow key={rate._id} hover>
                                <TableCell>
                                  {product?.productCode ||
                                    product?.productAlias ||
                                    "-"}
                                </TableCell>
                                <TableCell align="right">
                                  {rate?.baseRate?.toLocaleString("en-IN") || "-"}
                                </TableCell>
                                <TableCell align="center">
                                  <Tooltip title="View History">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() =>
                                        handleViewRateHistory(product?._id, product)
                                      }
                                    >
                                      <HistoryIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEditBaseRate(rate)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() =>
                                      handleDeleteBaseRate(product?._id)
                                    }
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedCustomer ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={creditCheckDialog}
        onClose={() => setCreditCheckDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Credit Check Result</DialogTitle>
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
                    {creditCheckResult.reasons.map((reason, index) => (
                      <Typography key={index} variant="body2" color="error">
                        • {reason}
                      </Typography>
                    ))}
                  </Box>
                )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditCheckDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer?"
      />

      {/* Rate History Dialog */}
      <Dialog
        open={rateHistoryDialog}
        onClose={() => setRateHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Rate History — {selectedCustomer?.companyName || "Customer"}
          {rateHistorySku
            ? ` / ${rateHistorySku.productCode || rateHistorySku.productAlias}`
            : " (All Products)"}
        </DialogTitle>
        <DialogContent>
          {loadingRateHistory ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading rate history…
              </Typography>
            </Box>
          ) : rateHistory.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No rate history found.
            </Typography>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Rate (₹)</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Valid From</TableCell>
                    <TableCell>Valid To</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rateHistory.map((entry, index) => {
                    const product = entry.productId;
                    return (
                      <TableRow key={index}>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        <TableCell>
                          {product?.productCode || product?.productAlias || "—"}
                        </TableCell>
                        <TableCell align="right">
                          {entry.baseRate?.toLocaleString("en-IN") || "—"}
                        </TableCell>
                        <TableCell>{entry.notes || "—"}</TableCell>
                        <TableCell>{formatDate(entry.validFrom)}</TableCell>
                        <TableCell>
                          {entry.validTo ? (
                            formatDate(entry.validTo)
                          ) : (
                            <Chip label="Current" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Rate Dialog */}
      <Dialog
        open={openEditRateDialog}
        onClose={() => setOpenEditRateDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Update Rate</DialogTitle>
        <DialogContent>
          {editingRate && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
              Product:{" "}
              <strong>
                {editingRate.productId?.productCode ||
                  editingRate.productId?.productAlias ||
                  "—"}
              </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Rate:{" "}
                <strong>₹{editingRate.baseRate?.toLocaleString("en-IN")}</strong>
              </Typography>
              <TextField
                fullWidth
                label="New Rate"
                type="number"
                value={editRateValue}
                onChange={(e) => setEditRateValue(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                inputProps={{ min: 0, step: 0.01 }}
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditRateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEditedRate}
            disabled={!editRateValue}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={openBaseRateConfirm}
        onClose={() => setOpenBaseRateConfirm(false)}
        onConfirm={confirmDeleteBaseRate}
        title="Delete Rate"
        message="Are you sure you want to delete this rate?"
      />

      <Dialog open={groupDialogOpen} onClose={handleCloseGroupDialog}>
        <DialogTitle>Add Customer Group</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Group Name"
              value={newGroupForm.name}
              onChange={(event) =>
                setNewGroupForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              required
              fullWidth
            />
            <TextField
              label="Group Code"
              value={newGroupForm.code}
              onChange={(event) =>
                setNewGroupForm((prev) => ({
                  ...prev,
                  code: event.target.value,
                }))
              }
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={newGroupForm.description}
              onChange={(event) =>
                setNewGroupForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseGroupDialog} disabled={creatingGroup}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustomerGroup}
            disabled={creatingGroup}
            variant="contained"
          >
            {creatingGroup ? "Adding..." : "Add Group"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Customers;


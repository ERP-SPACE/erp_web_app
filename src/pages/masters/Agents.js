import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Grid,
  Tabs,
  Tab,
  Typography,
  FormControlLabel,
  Switch,
  Chip,
  FormControl,
  MenuItem,
  Divider,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  UploadFile as UploadFileIcon,
  AttachMoney as AttachMoneyIcon,
  Paid as PaidIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import masterService from "../../services/masterService";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "../../utils/formatters";

const COMMISSION_METHOD_OPTIONS = [
  { value: "per_meter", label: "Amount per meter" },
  { value: "percentage", label: "Percentage of sales" },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "passport", label: "Passport" },
  { value: "license", label: "Driving License" },
  { value: "pan", label: "PAN" },
  { value: "other", label: "Other" },
];

const PAYOUT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "on_hold", label: "On Hold" },
];

const defaultFormValues = {
  name: "",
  state: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    pincode: "",
  },
  targetSalesMeters: 0,
  defaultSkuRates: [],
  defaultCreditLimit: 0,
  defaultCreditDays: 0,
  blockNewSalesForAllParties: false,
  blockNewDeliveriesForAllParties: false,
  blockedDeliveryCustomers: [],
  customers: [],
  notes: "",
  active: true,
};

const getDateInputValue = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const TabPanel = ({ children, value, index }) => {
  if (value !== index) return null;
  return <Box sx={{ py: 2 }}>{children}</Box>;
};

const generateLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value._id || value.id || value.value || "";
  }
  return "";
};

const Agents = () => {
  const { showNotification, setLoading } = useApp();
  const [agents, setAgents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmConfig, setConfirmConfig] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [commissionForm, setCommissionForm] = useState({
    customerId: "",
    commissionType: "per_meter",
    amountPerMeter: "",
    percentage: "",
    applyByDefault: true,
    effectiveFrom: getDateInputValue(new Date()),
    notes: "",
    isEditing: false,
  });
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    customerId: "",
    reference: "",
    periodStart: "",
    periodEnd: "",
    amount: "",
    payoutStatus: "pending",
    paidOn: "",
    paymentReference: "",
    notes: "",
  });
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [kycForm, setKycForm] = useState({
    documentType: "other",
    fileName: "",
    fileUrl: "",
    notes: "",
  });
  const [localPartyCommissions, setLocalPartyCommissions] = useState([]);
  const [localCommissionPayouts, setLocalCommissionPayouts] = useState([]);
  const [localKycDocuments, setLocalKycDocuments] = useState([]);
  const [selectedDefaultSkuId, setSelectedDefaultSkuId] = useState("");
  const [defaultSkuRateValue, setDefaultSkuRateValue] = useState("");
  const [editingDefaultSkuRateIndex, setEditingDefaultSkuRateIndex] =
    useState(null);
  const [rateHistoryDialogOpen, setRateHistoryDialogOpen] = useState(false);
  const [rateHistory, setRateHistory] = useState([]);
  const [loadingRateHistory, setLoadingRateHistory] = useState(false);
  const [rateHistorySku, setRateHistorySku] = useState(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: defaultFormValues,
  });

  const watchManagedCustomers = watch("customers");
  const watchedDefaultSkuRates = watch("defaultSkuRates");
  const watchDefaultSkuRates = useMemo(
    () => watchedDefaultSkuRates || [],
    [watchedDefaultSkuRates]
  );

  const watchCommissionType = commissionForm.commissionType;

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    await Promise.all([fetchAgents(), fetchCustomers(), fetchSKUs()]);
  };

  const fetchAgents = async (params = {}) => {
    setLoading(true);
    try {
      const res = await masterService.getAgents(params);
      setAgents(res.agents || []);
    } catch (error) {
      showNotification("Failed to fetch agents", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await masterService.getCustomers({ limit: 500 });
      const list = res.data || res.customers || [];
      setCustomers(list);
    } catch (error) {
      console.error("Failed to fetch customers", error);
    }
  };

  const fetchSKUs = async () => {
    try {
      const res = await masterService.getSKUs({ active: true, limit: 2000 });
      setSkus(res.skus || []);
    } catch (error) {
      console.error("Failed to fetch SKUs", error);
    }
  };

  const partyCommissions =
    selectedAgent?.partyCommissions ?? localPartyCommissions;
  const commissionPayouts =
    selectedAgent?.commissionPayouts ?? localCommissionPayouts;
  const kycDocuments = selectedAgent?.kycDocuments ?? localKycDocuments;

  const customerLookup = useMemo(() => {
    const map = new Map();

    const addToMap = (entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        return;
      }
      const id = (
        entry._id ||
        entry.id ||
        entry.customerId ||
        entry.value ||
        ""
      ).toString();
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, entry);
      }
    };

    customers.forEach(addToMap);
    selectedAgent?.customers?.forEach(addToMap);
    selectedAgent?.customerList?.forEach(addToMap);
    partyCommissions.forEach((commission) => {
      addToMap(commission?.customer);
    });

    return map;
  }, [customers, selectedAgent, partyCommissions]);

  const resolveCustomerName = useCallback(
    (customerRef) => {
      if (!customerRef) return "-";

      if (typeof customerRef === "string") {
        const match = customerLookup.get(customerRef.toString());
        if (match) {
          return (
            match.name || match.companyName || match.customerCode || customerRef
          );
        }
        return customerRef;
      }

      const id =
        customerRef._id || customerRef.id || customerRef.customerId || "";
      if (id) {
        const match = customerLookup.get(id.toString());
        if (match) {
          return (
            match.name ||
            match.companyName ||
            match.customerCode ||
            id.toString()
          );
        }
      }

      return (
        customerRef.name ||
        customerRef.companyName ||
        customerRef.customerCode ||
        id?.toString() ||
        "-"
      );
    },
    [customerLookup]
  );

  const openConfirmDialog = (config) => {
    setConfirmConfig({
      open: true,
      ...config,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmConfig((prev) => ({ ...prev, open: false, onConfirm: null }));
  };

  const handleAdd = () => {
    setSelectedAgent(null);
    reset(defaultFormValues);
    setLocalPartyCommissions([]);
    setLocalCommissionPayouts([]);
    setLocalKycDocuments([]);
    setSelectedDefaultSkuId("");
    setDefaultSkuRateValue("");
    setEditingDefaultSkuRateIndex(null);
    setTabIndex(0);
    setDialogOpen(true);
  };

  const mapAgentToForm = (agent) => ({
    name: agent.name || "",
    state: agent.state || "",
    phone: agent.phone || "",
    whatsapp: agent.whatsapp || "",
    email: agent.email || agent.contactPersonEmail || "",
    address: {
      line1: agent.address?.line1 || "",
      line2: agent.address?.line2 || "",
      city: agent.address?.city || "",
      pincode: agent.address?.pincode || "",
    },
    targetSalesMeters: agent.targetSalesMeters || 0,
    defaultSkuRates: (agent.defaultSkuRates || []).map((entry) => ({
      sku: normalizeEntityId(entry.sku),
      rate: entry.rate || 0,
      notes: entry.notes || "",
    })),
    defaultCreditLimit: agent.defaultCreditLimit || 0,
    defaultCreditDays: agent.defaultCreditDays || 0,
    blockNewSalesForAllParties: agent.blockNewSalesForAllParties || false,
    blockNewDeliveriesForAllParties:
      agent.blockNewDeliveriesForAllParties || false,
    blockedDeliveryCustomers: (agent.blockedDeliveryCustomers || []).map(
      (customer) =>
        typeof customer === "string" ? customer : customer?._id || ""
    ),
    customers: (agent.customers || []).map((customer) =>
      typeof customer === "string" ? customer : customer?._id || ""
    ),
    notes: agent.notes || "",
    active: agent.active !== undefined ? agent.active : true,
  });

  const updateAgentList = (agent) => {
    if (!agent) return;
    setAgents((prev) => {
      const existingIndex = prev.findIndex((item) => item._id === agent._id);
      if (existingIndex === -1) {
        return [agent, ...prev];
      }
      const updated = [...prev];
      updated[existingIndex] = agent;
      return updated;
    });
    setSelectedAgent(agent);
  };

  const handleEdit = async (agentRow) => {
    setLoading(true);
    try {
      const agent = await masterService.getAgent(agentRow._id);
      setSelectedAgent(agent);
      setLocalPartyCommissions([]);
      setLocalCommissionPayouts([]);
      setLocalKycDocuments([]);
      setSelectedDefaultSkuId("");
      setDefaultSkuRateValue("");
      setEditingDefaultSkuRateIndex(null);
      reset(mapAgentToForm(agent));
      setTabIndex(0);
      setDialogOpen(true);
    } catch (error) {
      showNotification("Failed to load agent details", "error");
    } finally {
      setLoading(false);
    }
  };

  const sanitizeNumber = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const buildDefaultPartyCommission = (customerId) => ({
    customer: customerId,
    commissionType: "per_meter",
    amountPerMeter: 0,
    applyByDefault: true,
    effectiveFrom: getDateInputValue(new Date()),
    notes: "Auto-created default commission when customer was assigned to agent",
  });

  const getCommissionCustomerIds = (commissionEntries = []) =>
    (commissionEntries || []).map((entry) => normalizeEntityId(entry.customer));

  const syncAgentToCustomers = async (agentData, customerIds) => {
    const ids = (customerIds || [])
      .map((id) => (id === undefined || id === null ? "" : id.toString()))
      .filter(Boolean);
    const agentId = agentData?._id || agentData?.id || agentData;

    if (!agentId || !ids.length) return;

    try {
      await Promise.all(
        ids.map((customerId) =>
          masterService.updateCustomer(customerId, { agentId })
        )
      );

      setCustomers((prev) => {
        const idSet = new Set(ids);
        return prev.map((customer) => {
          const currentId = (customer._id || customer.id || "").toString();
          if (!idSet.has(currentId)) return customer;
          return {
            ...customer,
            agentId:
              typeof agentData === "object" && agentData !== null
                ? { ...(agentData || {}), _id: agentId }
                : agentId,
          };
        });
      });
    } catch (error) {
      console.error("Failed to map agent to customers", error);
      showNotification(
        "Agent saved, but mapping to selected customers failed. Please retry.",
        "warning"
      );
    }
  };

  const onSubmit = async (formData) => {
    const payload = {
      ...formData,
      targetSalesMeters: sanitizeNumber(formData.targetSalesMeters) || 0,
      defaultSkuRates: (formData.defaultSkuRates || [])
        .map((entry) => ({
          sku: normalizeEntityId(entry.sku),
          rate: sanitizeNumber(entry.rate) || 0,
          notes: entry.notes || "",
        }))
        .filter((entry) => entry.sku),
      defaultCreditLimit: sanitizeNumber(formData.defaultCreditLimit) || 0,
      defaultCreditDays: sanitizeNumber(formData.defaultCreditDays) || 0,
      customers: (formData.customers || []).filter(Boolean),
      blockedDeliveryCustomers: (
        formData.blockedDeliveryCustomers || []
      ).filter(Boolean),
    };

    const customerIds = payload.customers.map((id) => normalizeEntityId(id));
    const previousCustomerIds = selectedAgent
      ? (selectedAgent.customers || []).map((id) => normalizeEntityId(id))
      : [];
    const newlyAssignedCustomerIds = selectedAgent
      ? customerIds.filter((customerId) => !previousCustomerIds.includes(customerId))
      : [];

    const existingCommissionIds = selectedAgent
      ? getCommissionCustomerIds(selectedAgent.partyCommissions)
      : getCommissionCustomerIds(localPartyCommissions);
    const customersMissingCommission = customerIds.filter(
      (customerId) => !existingCommissionIds.includes(customerId)
    );

    if (!selectedAgent) {
      const payloadPartyCommissions = [
        ...(localPartyCommissions || []).map((commission) => ({
          ...commission,
          customer: normalizeEntityId(commission.customer),
        })),
      ];
      customersMissingCommission.forEach((customerId) => {
        if (!payloadPartyCommissions.some(
          (entry) => normalizeEntityId(entry.customer) === customerId
        )) {
          payloadPartyCommissions.push(buildDefaultPartyCommission(customerId));
        }
      });

      if (payloadPartyCommissions.length) {
        payload.partyCommissions = payloadPartyCommissions;
      }
    }

    setLoading(true);
    let savedAgent = selectedAgent;
    try {
      if (selectedAgent) {
        const response = await masterService.updateAgent(
          selectedAgent._id,
          payload
        );
        savedAgent = response?.data || response;
        updateAgentList(savedAgent);
        showNotification("Agent updated successfully", "success");
      } else {
        const response = await masterService.createAgent(payload);
        savedAgent = response?.data || response;
        updateAgentList(savedAgent);
        showNotification("Agent created successfully", "success");
      }
      await syncAgentToCustomers(savedAgent, payload.customers);

      if (selectedAgent && newlyAssignedCustomerIds.length > 0) {
        const commissionCustomerIds = getCommissionCustomerIds(
          selectedAgent.partyCommissions
        );
        const commissionCustomersToCreate = newlyAssignedCustomerIds.filter(
          (customerId) => !commissionCustomerIds.includes(customerId)
        );

        if (commissionCustomersToCreate.length) {
          const commissionResponses = await Promise.all(
            commissionCustomersToCreate.map((customerId) =>
              masterService.upsertAgentPartyCommission(
                savedAgent._id,
                buildDefaultPartyCommission(customerId)
              )
            )
          );
          
          // Update selectedAgent with the latest agent data from the last response
          if (commissionResponses.length > 0) {
            setSelectedAgent(commissionResponses[commissionResponses.length - 1]);
          }
        }
      }

      setDialogOpen(false);
      fetchAgents();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (agentRow) => {
    openConfirmDialog({
      title: `${agentRow.active ? "Deactivate" : "Activate"} Agent`,
      message: `Are you sure you want to ${
        agentRow.active ? "deactivate" : "activate"
      } ${agentRow.name}?`,
      onConfirm: async () => {
        closeConfirmDialog();
        setLoading(true);
        try {
          const response = await masterService.toggleAgentStatus(agentRow._id);
          const agent = response?.data || response;
          updateAgentList(agent);
          showNotification("Agent status updated", "success");
        } catch (error) {
          showNotification(error.message || "Failed to update status", "error");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleAddCommission = () => {
    setCommissionForm({
      customerId: "",
      commissionType: "per_meter",
      amountPerMeter: "",
      percentage: "",
      applyByDefault: true,
      effectiveFrom: getDateInputValue(new Date()),
      notes: "",
      isEditing: false,
    });
    setCommissionDialogOpen(true);
  };

  const handleEditCommission = (commission) => {
    setCommissionForm({
      customerId: normalizeEntityId(commission.customer),
      commissionType: commission.commissionType || "per_meter",
      amountPerMeter:
        commission.commissionType === "per_meter"
          ? commission.amountPerMeter
          : "",
      percentage:
        commission.commissionType === "percentage"
          ? commission.percentage
          : "",
      applyByDefault: commission.applyByDefault || false,
      effectiveFrom:
        getDateInputValue(
          commission.history?.length
            ? commission.history[commission.history.length - 1]?.effectiveFrom
            : new Date()
        ) || getDateInputValue(new Date()),
      notes: commission.notes || "",
      isEditing: true,
    });
    setCommissionDialogOpen(true);
  };

  const submitCommission = async () => {
    if (!commissionForm.customerId) {
      showNotification(
        "Please select a customer for the commission",
        "warning"
      );
      return;
    }
    const payload = {
      customer: commissionForm.customerId,
      commissionType: commissionForm.commissionType,
      amountPerMeter:
        commissionForm.commissionType === "per_meter"
          ? sanitizeNumber(commissionForm.amountPerMeter)
          : undefined,
      percentage:
        commissionForm.commissionType === "percentage"
          ? sanitizeNumber(commissionForm.percentage)
          : undefined,
      applyByDefault: commissionForm.applyByDefault,
      effectiveFrom: commissionForm.effectiveFrom || undefined,
      notes: commissionForm.notes || undefined,
    };

    if (!selectedAgent) {
      setLocalPartyCommissions((prev) => {
        const existingIndex = prev.findIndex(
          (entry) => entry.customer === payload.customer
        );
        const entry = {
          ...payload,
          entryId: payload.customer,
          history: [],
        };
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = entry;
          return updated;
        }
        return [entry, ...prev];
      });
      showNotification(
        "Party commission added. It will be saved when you create the agent.",
        "info"
      );
      setCommissionDialogOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await masterService.upsertAgentPartyCommission(
        selectedAgent._id,
        payload
      );
      const agent = response?.data || response;
      updateAgentList(agent);
      showNotification("Party commission saved", "success");
      setCommissionDialogOpen(false);
    } catch (error) {
      showNotification(error.message || "Failed to save commission", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCommission = (commission) => {
    if (!selectedAgent) {
      setLocalPartyCommissions((prev) =>
        prev.filter(
          (entry) =>
            entry.customer !== (commission.customer?._id || commission.customer)
        )
      );
      showNotification(
        "Commission removed locally. It will be saved when you create the agent.",
        "info"
      );
      return;
    }
    openConfirmDialog({
      title: "Remove Party Commission",
      message: `Remove commission mapping for ${resolveCustomerName(
        commission.customer
      )}?`,
      onConfirm: async () => {
        closeConfirmDialog();
        setLoading(true);
        try {
          const response = await masterService.removeAgentPartyCommission(
            selectedAgent._id,
            commission.customer?._id || commission.customer
          );
          const agent = response?.data || response;
          updateAgentList(agent);
          showNotification("Party commission removed", "success");
        } catch (error) {
          showNotification(
            error.message || "Failed to remove commission",
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleAddPayout = () => {
    setPayoutForm({
      customerId: "",
      reference: "",
      periodStart: "",
      periodEnd: "",
      amount: "",
      payoutStatus: "pending",
      paidOn: "",
      paymentReference: "",
      notes: "",
    });
    setPayoutDialogOpen(true);
  };

  const submitPayout = async () => {
    if (!payoutForm.amount) {
      showNotification("Please enter payout amount", "warning");
      return;
    }

    const payload = {
      customer: payoutForm.customerId || undefined,
      reference: payoutForm.reference || undefined,
      periodStart: payoutForm.periodStart || undefined,
      periodEnd: payoutForm.periodEnd || undefined,
      amount: sanitizeNumber(payoutForm.amount) || 0,
      payoutStatus: payoutForm.payoutStatus,
      paidOn: payoutForm.paidOn || undefined,
      paymentReference: payoutForm.paymentReference || undefined,
      notes: payoutForm.notes || undefined,
    };

    if (!selectedAgent) {
      setLocalCommissionPayouts((prev) => [
        {
          ...payload,
          payoutId: generateLocalId(),
        },
        ...prev,
      ]);
      showNotification(
        "Payout recorded locally. It will be saved when you create the agent.",
        "info"
      );
      setPayoutDialogOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await masterService.addAgentCommissionPayout(
        selectedAgent._id,
        payload
      );
      const agent = response?.data || response;
      updateAgentList(agent);
      showNotification("Commission payout recorded", "success");
      setPayoutDialogOpen(false);
    } catch (error) {
      showNotification(error.message || "Failed to record payout", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayoutStatus = (payout, status) => {
    if (!selectedAgent) {
      setLocalCommissionPayouts((prev) =>
        prev.map((entry) =>
          entry.payoutId === payout.payoutId
            ? {
                ...entry,
                payoutStatus: status,
                paidOn:
                  status === "paid" ? new Date().toISOString() : entry.paidOn,
              }
            : entry
        )
      );
      showNotification(
        "Payout status updated locally. It will be saved when you create the agent.",
        "info"
      );
      return;
    }
    openConfirmDialog({
      title: "Update Payout Status",
      message: `Mark payout ${
        payout.reference || ""
      } as ${status.toUpperCase()}?`,
      onConfirm: async () => {
        closeConfirmDialog();
        setLoading(true);
        try {
          const response = await masterService.updateAgentCommissionPayout(
            selectedAgent._id,
            payout.payoutId,
            {
              payoutStatus: status,
              paidOn:
                status === "paid" ? new Date().toISOString() : payout.paidOn,
            }
          );
          const agent = response?.data || response;
          updateAgentList(agent);
          showNotification("Payout status updated", "success");
        } catch (error) {
          showNotification(error.message || "Failed to update payout", "error");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleAddKyc = () => {
    setKycForm({
      documentType: "other",
      fileName: "",
      fileUrl: "",
      notes: "",
    });
    setKycDialogOpen(true);
  };

  const submitKyc = async () => {
    if (!kycForm.fileName || !kycForm.fileUrl) {
      showNotification("File name and URL are required", "warning");
      return;
    }

    if (!selectedAgent) {
      setLocalKycDocuments((prev) => [
        {
          documentId: generateLocalId(),
          documentType: kycForm.documentType,
          fileName: kycForm.fileName,
          fileUrl: kycForm.fileUrl,
          notes: kycForm.notes,
        },
        ...prev,
      ]);
      showNotification(
        "KYC document added locally. It will be saved when you create the agent.",
        "info"
      );
      setKycDialogOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await masterService.addAgentKycDocument(
        selectedAgent._id,
        {
          documentType: kycForm.documentType,
          fileName: kycForm.fileName,
          fileUrl: kycForm.fileUrl,
          notes: kycForm.notes || undefined,
        }
      );
      const agent = response?.data || response;
      updateAgentList(agent);
      showNotification("KYC document added", "success");
      setKycDialogOpen(false);
    } catch (error) {
      showNotification(error.message || "Failed to add KYC document", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKyc = (document) => {
    if (!selectedAgent) {
      setLocalKycDocuments((prev) =>
        prev.filter(
          (doc) => doc.documentId !== (document.documentId || document.id)
        )
      );
      showNotification(
        "KYC document removed locally. Changes will apply when you save the agent.",
        "info"
      );
      return;
    }
    openConfirmDialog({
      title: "Remove KYC Document",
      message: `Remove ${document.fileName}?`,
      onConfirm: async () => {
        closeConfirmDialog();
        setLoading(true);
        try {
          const response = await masterService.removeAgentKycDocument(
            selectedAgent._id,
            document.documentId
          );
          const agent = response?.data || response;
          updateAgentList(agent);
          showNotification("KYC document removed", "success");
        } catch (error) {
          showNotification(
            error.message || "Failed to remove KYC document",
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const customerMenuItems = useMemo(
    () =>
      customers.map((customer) => ({
        id: customer._id || customer.id,
        label: `${customer.companyName || "Unnamed Customer"}${
          customer.customerCode ? ` (${customer.customerCode})` : ""
        }`,
      })),
    [customers]
  );
  const customerSelectOptions = useMemo(
    () => [
      { value: "", label: "Select customer" },
      ...customerMenuItems.map((item) => ({ value: item.id, label: item.label })),
    ],
    [customerMenuItems]
  );
  const payoutCustomerOptions = useMemo(
    () => [
      { value: "", label: "All customers" },
      ...customerMenuItems.map((item) => ({ value: item.id, label: item.label })),
    ],
    [customerMenuItems]
  );

  const skuLookup = useMemo(() => {
    const map = new Map();
    skus.forEach((sku) => {
      const id = normalizeEntityId(sku);
      if (id) map.set(id, sku);
    });
    (selectedAgent?.defaultSkuRates || []).forEach((entry) => {
      const sku = entry?.sku;
      const id = normalizeEntityId(sku);
      if (id && typeof sku === "object") {
        map.set(id, sku);
      }
    });
    return map;
  }, [skus, selectedAgent]);

  const availableDefaultSkus = useMemo(() => {
    const currentSkuId = normalizeEntityId(selectedDefaultSkuId);
    const usedSkuIds = new Set(
      watchDefaultSkuRates
        .map((entry, index) =>
          index === editingDefaultSkuRateIndex ? null : normalizeEntityId(entry.sku)
        )
        .filter(Boolean)
    );

    return skus.filter((sku) => {
      const skuId = normalizeEntityId(sku);
      if (!skuId) return false;
      if (skuId === currentSkuId) return true;
      return !usedSkuIds.has(skuId);
    });
  }, [
    skus,
    selectedDefaultSkuId,
    watchDefaultSkuRates,
    editingDefaultSkuRateIndex,
  ]);

  const persistDefaultSkuRates = async (nextRates, successMessage) => {
    if (!selectedAgent?._id) {
      setValue("defaultSkuRates", nextRates, {
        shouldDirty: true,
        shouldValidate: true,
      });
      return true;
    }

    setLoading(true);
    try {
      const response = await masterService.updateAgent(selectedAgent._id, {
        defaultSkuRates: nextRates.map((entry) => ({
          sku: normalizeEntityId(entry.sku),
          rate: sanitizeNumber(entry.rate) || 0,
          notes: entry.notes || "",
        })),
      });
      const agent = response?.data || response;
      updateAgentList(agent);
      setValue(
        "defaultSkuRates",
        (agent?.defaultSkuRates || nextRates).map((entry) => ({
          sku: normalizeEntityId(entry.sku),
          rate: sanitizeNumber(entry.rate) || 0,
          notes: entry.notes || "",
        })),
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
      showNotification(successMessage, "success");
      return true;
    } catch (error) {
      showNotification(error.message || "Failed to save SKU rate", "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addOrUpdateDefaultSkuRate = async () => {
    const skuId = normalizeEntityId(selectedDefaultSkuId);
    const parsedRate = sanitizeNumber(defaultSkuRateValue);

    if (!skuId) {
      showNotification("Please select a SKU", "warning");
      return;
    }
    if (parsedRate === undefined || parsedRate < 0) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }

    const existingIndex = watchDefaultSkuRates.findIndex(
      (entry, index) =>
        normalizeEntityId(entry.sku) === skuId && index !== editingDefaultSkuRateIndex
    );

    if (existingIndex !== -1) {
      showNotification("Rate for this SKU already exists", "warning");
      return;
    }

    const nextRates = [...watchDefaultSkuRates];
    const nextEntry = {
      sku: skuId,
      rate: parsedRate,
      notes:
        editingDefaultSkuRateIndex !== null
          ? nextRates[editingDefaultSkuRateIndex]?.notes || ""
          : "",
    };

    if (editingDefaultSkuRateIndex !== null) {
      nextRates[editingDefaultSkuRateIndex] = nextEntry;
    } else {
      nextRates.push(nextEntry);
    }

    const saved = await persistDefaultSkuRates(
      nextRates,
      editingDefaultSkuRateIndex !== null
        ? "Default SKU rate updated successfully"
        : "Default SKU rate added successfully"
    );
    if (!saved) {
      return;
    }

    setSelectedDefaultSkuId("");
    setDefaultSkuRateValue("");
    setEditingDefaultSkuRateIndex(null);
  };

  const editDefaultSkuRate = (index) => {
    const row = watchDefaultSkuRates[index];
    if (!row) return;
    setSelectedDefaultSkuId(normalizeEntityId(row.sku));
    setDefaultSkuRateValue(String(row.rate ?? ""));
    setEditingDefaultSkuRateIndex(index);
  };

  const removeDefaultSkuRate = (index) => {
    const nextRates = watchDefaultSkuRates.filter((_, i) => i !== index);
    setValue("defaultSkuRates", nextRates, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (editingDefaultSkuRateIndex === index) {
      setSelectedDefaultSkuId("");
      setDefaultSkuRateValue("");
      setEditingDefaultSkuRateIndex(null);
    }
  };

  const getLocalAgentRateHistory = useCallback(
    (skuId = null) => {
      const selectedSkuId = normalizeEntityId(skuId);
      const agentRates = selectedAgent?.defaultSkuRates || [];

      return agentRates.flatMap((entry) => {
        const entrySku = entry?.skuId || entry?.sku || null;
        const entrySkuId = normalizeEntityId(entrySku);

        if (selectedSkuId && entrySkuId !== selectedSkuId) {
          return [];
        }

        const historyEntries = Array.isArray(entry?.history) ? entry.history : [];

        return historyEntries.map((historyEntry) => ({
          ...historyEntry,
          skuId: historyEntry?.skuId || entrySku,
          rate:
            historyEntry?.rate ??
            historyEntry?.baseRate ??
            historyEntry?.previousRate ??
            historyEntry?.defaultRate,
        }));
      });
    },
    [selectedAgent]
  );

  const handleViewRateHistory = async (skuId = null, sku = null) => {
    if (!selectedAgent?._id) {
      showNotification("Please save the agent first to view rate history", "warning");
      return;
    }

    setRateHistorySku(sku);
    setLoadingRateHistory(true);
    setRateHistoryDialogOpen(true);

    try {
      const history = await masterService.getAgentRateHistory(
        selectedAgent._id,
        skuId
      );
      setRateHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      const fallbackHistory = getLocalAgentRateHistory(skuId);

      if (fallbackHistory.length > 0) {
        setRateHistory(fallbackHistory);
        showNotification(
          "Using rate history available in the loaded agent data",
          "info"
        );
      } else {
        showNotification("Failed to fetch rate history", "error");
        setRateHistory([]);
      }
    } finally {
      setLoadingRateHistory(false);
    }
  };

  const toggleManagedCustomer = (customerId) => {
    const current = watchManagedCustomers || [];
    const exists = current.includes(customerId);
    const next = exists
      ? current.filter((id) => id !== customerId)
      : [...current, customerId];
    setValue("customers", next, { shouldDirty: true, shouldValidate: true });
  };

  const columns = [
    { field: "agentCode", headerName: "Agent Code" },
    { field: "name", headerName: "Name", flex: 1 },
    { field: "state", headerName: "State" },
    { field: "phone", headerName: "Phone" },
    {
      field: "targetSalesMeters",
      headerName: "Target (mtrs)",
      renderCell: (params) => formatNumber(params.value || 0),
    },
    {
      field: "active",
      headerName: "Status",
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          size="small"
          color={params.value ? "success" : "default"}
        />
      ),
    },
  ];

  const customActions = [
    {
      icon: <ToggleOnIcon fontSize="small" />,
      label: "Toggle Status",
      onClick: handleToggleStatus,
    },
  ];

  return (
    <Box>
      <DataTable
        title="Sales Agents / Brokers"
        columns={columns}
        rows={agents}
        onAdd={handleAdd}
        onEdit={handleEdit}
        customActions={customActions}
        onSearch={(value) => fetchAgents(value ? { search: value } : {})}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedAgent ? "Edit Agent / Broker" : "Add Agent / Broker"}
          </DialogTitle>
          <DialogContent>
            <Tabs value={tabIndex} onChange={(e, value) => setTabIndex(value)}>
              <Tab label="Profile" />
              <Tab label="Defaults & Controls" />
              <Tab label="Default Rates" />
              <Tab label="Customers" />
              <Tab label="Party Commission" />
              <Tab label="Payouts" />
              <Tab label="KYC Documents" />
            </Tabs>

            <TabPanel value={tabIndex} index={0}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: "Agent name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Agent / Broker Name"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="phone"
                    control={control}
                    rules={{ required: "Phone number is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Phone"
                        error={!!errors.phone}
                        helperText={errors.phone?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="whatsapp"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="WhatsApp" />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Contact Email"
                        type="email"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="address.line1"
                    control={control}
                    rules={{ required: "Address line 1 is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Address Line 1"
                        error={!!errors.address?.line1}
                        helperText={errors.address?.line1?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="address.line2"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Address Line 2" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Controller
                    name="address.city"
                    control={control}
                    rules={{ required: "City is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="City"
                        error={!!errors.address?.city}
                        helperText={errors.address?.city?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
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
                <Grid item xs={12} md={3}>
                  <Controller
                    name="address.pincode"
                    control={control}
                    rules={{ required: "Pincode is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Pincode"
                        error={!!errors.address?.pincode}
                        helperText={errors.address?.pincode?.message}
                      />
                    )}
                  />
                </Grid>

                {/* <Grid item xs={12} md={6}>
                  <Controller
                    name="targetSalesMeters"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <NumericFormat
                        {...field}
                        value={value}
                        onValueChange={(values) =>
                          onChange(
                            values.floatValue === undefined
                              ? ""
                              : values.floatValue
                          )
                        }
                        customInput={TextField}
                        fullWidth
                        label="Target Sales (meters)"
                        thousandSeparator=","
                        allowNegative={false}
                      />
                    )}
                  />
                </Grid> */}
              </Grid>
            </TabPanel>

            <TabPanel value={tabIndex} index={1}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="targetSalesMeters"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <NumericFormat
                        {...field}
                        value={value}
                        onValueChange={(values) =>
                          onChange(
                            values.floatValue === undefined
                              ? ""
                              : values.floatValue
                          )
                        }
                        customInput={TextField}
                        fullWidth
                        label="Target Sales (meters)"
                        thousandSeparator=","
                        allowNegative={false}
                      />
                    )}
                  />
                </Grid>

                

                <Grid item xs={12} md={6}>
                  <Controller
                    name="defaultCreditLimit"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <NumericFormat
                        {...field}
                        value={value}
                        onValueChange={(values) =>
                          onChange(
                            values.floatValue === undefined
                              ? ""
                              : values.floatValue
                          )
                        }
                        customInput={TextField}
                        fullWidth
                        label="Default Credit Limit (₹)"
                        thousandSeparator=","
                        decimalScale={2}
                        allowNegative={false}
                        prefix="₹"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="defaultCreditDays"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Default Credit Days"
                        type="number"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="blockNewSalesForAllParties"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Block new sales invoices for all parties"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabIndex} index={2}>
              <Box>
                <Paper sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Add New Rate
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        value={
                          skuLookup.get(normalizeEntityId(selectedDefaultSkuId)) ||
                          null
                        }
                        onChange={(event, newValue) => {
                          setSelectedDefaultSkuId(normalizeEntityId(newValue));
                          setDefaultSkuRateValue("");
                        }}
                        options={availableDefaultSkus}
                        getOptionLabel={(option) => option?.skuCode || ""}
                        filterOptions={(options, { inputValue }) => {
                          const search = inputValue.toLowerCase().trim();
                          if (!search) return options;
                          return options.filter((option) => {
                            const product = option.productId;
                            const searchableFields = [
                              option.skuCode,
                              option.skuAlias,
                              String(option.widthInches),
                              product?.productCode,
                              product?.productAlias,
                              product?.categoryId?.name,
                              product?.gsmId?.name,
                              product?.qualityId?.name,
                            ];
                            return searchableFields.some(
                              (field) =>
                                field && field.toLowerCase().includes(search)
                            );
                          });
                        }}
                        renderOption={(props, option) => (
                          <li {...props} key={option._id}>
                            {option.skuCode}
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Select Product"
                            placeholder="Search by SKU, width, category..."
                            size="small"
                          />
                        )}
                        isOptionEqualToValue={(option, value) =>
                          normalizeEntityId(option) === normalizeEntityId(value)
                        }
                        noOptionsText={
                          watchDefaultSkuRates.length === skus.length
                            ? "All SKUs have rates configured"
                            : "No matching SKUs"
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Rate"
                        type="number"
                        value={defaultSkuRateValue}
                        onChange={(e) => setDefaultSkuRateValue(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">Rs.</InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={
                          editingDefaultSkuRateIndex !== null ? (
                            <EditIcon />
                          ) : (
                            <AddIcon />
                          )
                        }
                        onClick={addOrUpdateDefaultSkuRate}
                        disabled={!selectedDefaultSkuId || !defaultSkuRateValue}
                      >
                        {editingDefaultSkuRateIndex !== null ? "Update" : "Add"}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2">Existing Rates</Typography>
                  {selectedAgent?._id ? (
                    <Tooltip title="View Full Rate History">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewRateHistory(null, null)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Box>

                {watchDefaultSkuRates.length === 0 ? (
                  <Typography
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    No default SKU rates configured for this agent.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>SKU Code</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Rate (Rs.)</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {watchDefaultSkuRates.map((entry, index) => {
                          const sku =
                            skuLookup.get(normalizeEntityId(entry.sku)) ||
                            (typeof entry.sku === "object" ? entry.sku : null);
                          const product = sku?.productId;

                          return (
                            <TableRow
                              key={`${normalizeEntityId(entry.sku)}-${index}`}
                              hover
                            >
                              <TableCell>{sku?.skuCode || "-"}</TableCell>
                              <TableCell>{product?.productCode || "-"}</TableCell>
                              <TableCell align="right">
                                {entry.rate?.toLocaleString("en-IN") || "-"}
                              </TableCell>
                              <TableCell align="center">
                                {selectedAgent?._id ? (
                                  <Tooltip title="View History">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() =>
                                        handleViewRateHistory(
                                          normalizeEntityId(entry.sku),
                                          sku
                                        )
                                      }
                                    >
                                      <HistoryIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => editDefaultSkuRate(index)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeDefaultSkuRate(index)}
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
            </TabPanel>

            <TabPanel value={tabIndex} index={3}>
              <Typography variant="subtitle1" gutterBottom>
                Managed Customers
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell align="center">Active</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customers.map((customer) => {
                      const id = customer._id || customer.id;
                      const isManaged = (watchManagedCustomers || []).includes(id);

                      return (
                        <TableRow key={id}>
                          <TableCell>{customer.companyName || "-"}</TableCell>
                          <TableCell>{customer.customerCode || "-"}</TableCell>
                          <TableCell align="center">
                            <Switch
                              size="small"
                              checked={isManaged}
                              onChange={() => toggleManagedCustomer(id)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {customers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No customers available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {errors.customers && (
                <Typography color="error" variant="caption">
                  {errors.customers.message}
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={tabIndex} index={4}>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">Party-wise Commissions</Typography>
                <Button
                  variant="contained"
                  startIcon={<AttachMoneyIcon />}
                  onClick={handleAddCommission}
                >
                  Add Commission
                </Button>
              </Box>
              {partyCommissions.length ? (
                <Table
                  size="small"
                  sx={{
                    tableLayout: "auto",
                    width: "100%",
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell>Auto Apply</TableCell>
                      <TableCell>History</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {partyCommissions.map((commission) => (
                      <TableRow key={commission.entryId || commission.customer}>
                        <TableCell>
                          {resolveCustomerName(commission.customer)}
                        </TableCell>
                        <TableCell>
                          {commission.commissionType === "per_meter"
                            ? "Amount per meter"
                            : "Percentage"}
                        </TableCell>
                        <TableCell align="right">
                          {commission.commissionType === "per_meter"
                            ? formatCurrency(commission.amountPerMeter || 0)
                            : `${commission.percentage || 0}%`}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={commission.applyByDefault ? "Yes" : "No"}
                            size="small"
                            color={
                              commission.applyByDefault ? "success" : "default"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {commission.history?.length ? (
                            <Box>
                              <Typography variant="body2">
                                {formatDate(
                                  commission.history[
                                    commission.history.length - 1
                                  ]?.effectiveFrom
                                )}{" "}
                                →{" "}
                                {formatDate(
                                  commission.history[
                                    commission.history.length - 1
                                  ]?.effectiveTo
                                ) || "Current"}
                              </Typography>
                              {commission.history.length > 1 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {commission.history.length} records
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit Commission">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEditCommission(commission)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove Commission">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleRemoveCommission(commission)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="text.secondary">
                  No party commissions configured yet.
                </Typography>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2 }}>
                Commission Change Log
              </Typography>
              {selectedAgent?.commissionChanges?.length ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    {selectedAgent.commissionChanges.map((change) => (
                      <Box
                        key={change.changeId}
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          pb: 1.5,
                          "&:last-of-type": {
                            borderBottom: "none",
                            pb: 0,
                          },
                        }}
                      >
                        <Typography variant="subtitle2">
                          {formatDate(change.changeDate)} —{" "}
                          {resolveCustomerName(change.customer)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {change.previousCommissionType
                            ? `Updated from ${
                                change.previousCommissionType === "per_meter"
                                  ? `${formatCurrency(
                                      change.previousAmountPerMeter || 0
                                    )} / meter`
                                  : `${change.previousPercentage || 0}%`
                              } to ${
                                change.newCommissionType === "per_meter"
                                  ? `${formatCurrency(
                                      change.newAmountPerMeter || 0
                                    )} / meter`
                                  : `${change.newPercentage || 0}%`
                              }`
                            : `Set to ${
                                change.newCommissionType === "per_meter"
                                  ? `${formatCurrency(
                                      change.newAmountPerMeter || 0
                                    )} / meter`
                                  : `${change.newPercentage || 0}%`
                              }`}
                        </Typography>
                        {change.notes && (
                          <Typography variant="body2" color="text.secondary">
                            Notes: {change.notes}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              ) : (
                <Typography color="text.secondary">
                  No commission changes recorded yet.
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={tabIndex} index={5}>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">Commission Payouts</Typography>
                <Button
                  variant="contained"
                  startIcon={<PaidIcon />}
                  onClick={handleAddPayout}
                >
                  Record Payout
                </Button>
              </Box>
              {commissionPayouts.length ? (
                <Table
                  size="small"
                  sx={{
                    tableLayout: "auto",
                    width: "100%",
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Reference</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commissionPayouts.map((payout) => (
                      <TableRow key={payout.payoutId}>
                        <TableCell>{payout.reference || "-"}</TableCell>
                        <TableCell>
                          {resolveCustomerName(payout.customer)}
                        </TableCell>
                        <TableCell>
                          {payout.periodStart
                            ? `${formatDate(payout.periodStart)} → ${formatDate(
                                payout.periodEnd
                              )}`
                            : "-"}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(payout.amount || 0)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={payout.payoutStatus
                              ?.replace("_", " ")
                              .toUpperCase()}
                            size="small"
                            color={
                              payout.payoutStatus === "paid"
                                ? "success"
                                : payout.payoutStatus === "pending"
                                ? "warning"
                                : "default"
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() =>
                                  handleUpdatePayoutStatus(payout, "paid")
                                }
                              >
                                <ToggleOnIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Mark as Pending">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() =>
                                  handleUpdatePayoutStatus(payout, "pending")
                                }
                              >
                                <ToggleOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography color="text.secondary">
                  No commission payouts recorded yet.
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={tabIndex} index={6}>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">KYC Documents</Typography>
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={handleAddKyc}
                >
                  Add Document
                </Button>
              </Box>
              {kycDocuments.length ? (
                <Paper variant="outlined">
                  <List disablePadding>
                    {kycDocuments.map((document) => {
                      const docType =
                        DOCUMENT_TYPE_OPTIONS.find(
                          (option) => option.value === document.documentType
                        )?.label || document.documentType;
                      return (
                        <ListItem
                          key={document.documentId}
                          divider
                          secondaryAction={
                            <IconButton
                              edge="end"
                              color="error"
                              onClick={() => handleRemoveKyc(document)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={`${docType} • ${document.fileName}`}
                            secondary={
                              <>
                                <Typography
                                  component="span"
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {document.fileUrl}
                                </Typography>
                                {document.notes && (
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ display: "block" }}
                                  >
                                    Notes: {document.notes}
                                  </Typography>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Paper>
              ) : (
                <Typography color="text.secondary">
                  No KYC documents uploaded.
                </Typography>
              )}
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedAgent ? "Update Agent" : "Create Agent"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={rateHistoryDialogOpen}
        onClose={() => setRateHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Rate History - {selectedAgent?.name || "Agent"}
          {rateHistorySku
            ? ` / ${rateHistorySku.skuCode || rateHistorySku.skuAlias || "SKU"}`
            : " (All SKUs)"}
        </DialogTitle>
        <DialogContent>
          {loadingRateHistory ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading rate history...
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
                    <TableCell>SKU Code</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Rate (Rs.)</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Valid From</TableCell>
                    <TableCell>Valid To</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rateHistory.map((entry, index) => {
                    const sku = entry.skuId || entry.sku || null;
                    const product = sku?.productId || null;
                    const historyRate =
                      entry.rate ??
                      entry.baseRate ??
                      entry.previousRate ??
                      entry.defaultRate ??
                      0;

                    return (
                      <TableRow key={entry._id || entry.id || index}>
                        <TableCell>
                          {formatDate(
                            entry.createdAt || entry.updatedAt || entry.validFrom
                          )}
                        </TableCell>
                        <TableCell>{sku?.skuCode || sku?.skuAlias || "-"}</TableCell>
                        <TableCell>{product?.productCode || product?.name || "-"}</TableCell>
                        <TableCell align="right">
                          {historyRate?.toLocaleString("en-IN") || "-"}
                        </TableCell>
                        <TableCell>{entry.notes || "-"}</TableCell>
                        <TableCell>
                          {entry.validFrom ? formatDate(entry.validFrom) : "-"}
                        </TableCell>
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
          <Button onClick={() => setRateHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Commission Dialog */}
      <Dialog
        open={commissionDialogOpen}
        onClose={() => setCommissionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {commissionForm.isEditing
            ? "Edit Party Commission"
            : "Add / Update Party Commission"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    customerSelectOptions,
                    commissionForm.customerId,
                    (value) =>
                      setCommissionForm((prev) => ({
                        ...prev,
                        customerId: value,
                      }))
                  )}
                  disabled={commissionForm.isEditing}
                  renderInput={(params) => (
                    <TextField {...params} label="Customer" />
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    COMMISSION_METHOD_OPTIONS,
                    commissionForm.commissionType,
                    (value) =>
                      setCommissionForm((prev) => ({
                        ...prev,
                        commissionType: value,
                        amountPerMeter: "",
                        percentage: "",
                      }))
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Commission Method" />
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              {watchCommissionType === "per_meter" ? (
                <NumericFormat
                  value={commissionForm.amountPerMeter}
                  onValueChange={(values) =>
                    setCommissionForm((prev) => ({
                      ...prev,
                      amountPerMeter: values.floatValue,
                    }))
                  }
                  customInput={TextField}
                  fullWidth
                  label="Commission Amount (₹/meter)"
                  thousandSeparator=","
                  decimalScale={2}
                  allowNegative={false}
                  prefix="₹"
                />
              ) : (
                <TextField
                  value={commissionForm.percentage}
                  onChange={(event) =>
                    setCommissionForm((prev) => ({
                      ...prev,
                      percentage: event.target.value,
                    }))
                  }
                  fullWidth
                  label="Commission Percentage (%)"
                  type="number"
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                />
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={commissionForm.applyByDefault}
                    onChange={(event) =>
                      setCommissionForm((prev) => ({
                        ...prev,
                        applyByDefault: event.target.checked,
                      }))
                    }
                  />
                }
                label="Auto apply on invoices"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Effective From"
                type="date"
                value={commissionForm.effectiveFrom || ""}
                onChange={(event) =>
                  setCommissionForm((prev) => ({
                    ...prev,
                    effectiveFrom: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={commissionForm.notes}
                onChange={(event) =>
                  setCommissionForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommissionDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCommission}>
            Save Commission
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog
        open={payoutDialogOpen}
        onClose={() => setPayoutDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Commission Payout</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    payoutCustomerOptions,
                    payoutForm.customerId,
                    (value) =>
                      setPayoutForm((prev) => ({
                        ...prev,
                        customerId: value,
                      }))
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Customer (optional)" />
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Reference"
                value={payoutForm.reference}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Amount (₹)"
                value={payoutForm.amount}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                fullWidth
                type="number"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Period Start"
                type="date"
                value={payoutForm.periodStart || ""}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    periodStart: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Period End"
                type="date"
                value={payoutForm.periodEnd || ""}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    periodEnd: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    PAYOUT_STATUS_OPTIONS,
                    payoutForm.payoutStatus,
                    (value) =>
                      setPayoutForm((prev) => ({
                        ...prev,
                        payoutStatus: value,
                      }))
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Payout Status" />
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Paid On"
                type="date"
                value={payoutForm.paidOn || ""}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    paidOn: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Payment Reference"
                value={payoutForm.paymentReference}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    paymentReference: event.target.value,
                  }))
                }
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={payoutForm.notes}
                onChange={(event) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayoutDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitPayout}>
            Save Payout
          </Button>
        </DialogActions>
      </Dialog>

      {/* KYC Dialog */}
      <Dialog
        open={kycDialogOpen}
        onClose={() => setKycDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add KYC Document</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    DOCUMENT_TYPE_OPTIONS,
                    kycForm.documentType,
                    (value) =>
                      setKycForm((prev) => ({
                        ...prev,
                        documentType: value,
                      }))
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Document Type" />
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="File Name"
                value={kycForm.fileName}
                onChange={(event) =>
                  setKycForm((prev) => ({
                    ...prev,
                    fileName: event.target.value,
                  }))
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="File URL"
                value={kycForm.fileUrl}
                onChange={(event) =>
                  setKycForm((prev) => ({
                    ...prev,
                    fileUrl: event.target.value,
                  }))
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={kycForm.notes}
                onChange={(event) =>
                  setKycForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKycDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitKyc}>
            Add Document
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmConfig.open}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onClose={closeConfirmDialog}
        onConfirm={confirmConfig.onConfirm}
      />
    </Box>
  );
};

export default Agents;





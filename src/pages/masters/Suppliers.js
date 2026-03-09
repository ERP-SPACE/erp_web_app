import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
  Tab,
  Tabs,
  Typography,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import PersonIcon from "@mui/icons-material/Person";
import { useForm, Controller } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useApp } from "../../contexts/AppContext";
import masterService from "../../services/masterService";

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`supplier-tabpanel-${index}`}
      aria-labelledby={`supplier-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const Suppliers = () => {
  const { showNotification, setLoading } = useApp();
  const [suppliers, setSuppliers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Base Rate states
  const [skus, setSkus] = useState([]);
  const [supplierBaseRates, setSupplierBaseRates] = useState([]);
  const [selectedSku, setSelectedSku] = useState(null);
  const [baseRateValue, setBaseRateValue] = useState("");
  const [loadingBaseRates, setLoadingBaseRates] = useState(false);
  const [baseRateDeleteId, setBaseRateDeleteId] = useState(null);
  const [openBaseRateConfirm, setOpenBaseRateConfirm] = useState(false);

  // Edit Rate Dialog states
  const [openEditRateDialog, setOpenEditRateDialog] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [editRateValue, setEditRateValue] = useState("");

  // Rate History states
  const [rateHistory, setRateHistory] = useState([]);
  const [loadingRateHistory, setLoadingRateHistory] = useState(false);

  // Contact Person states
  const [contactPersons, setContactPersons] = useState([]);
  const [loadingContactPersons, setLoadingContactPersons] = useState(false);
  const initialContactPerson = {
    name: "",
    email: "",
    phone: "",
    isPrimary: false,
  };
  const [newContactPerson, setNewContactPerson] =
    useState(initialContactPerson);
  const [editingContactPerson, setEditingContactPerson] = useState(null);
  const [editContactPerson, setEditContactPerson] =
    useState(initialContactPerson);
  const [openEditContactDialog, setOpenEditContactDialog] = useState(false);
  const [contactPersonDeleteId, setContactPersonDeleteId] = useState(null);
  const [openContactPersonConfirm, setOpenContactPersonConfirm] =
    useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      supplierCode: "",
      name: "",
      gstin: "",
      phone: "",
      whatsappNumber: "",
      email: "",
      addressline1: "",
      addressline2: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      active: true,
    },
  });

  useEffect(() => {
    fetchSuppliers();
    fetchSKUs();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await masterService.getSuppliers();
      const list = response.suppliers || [];
      setSuppliers(list);
    } catch (error) {
      showNotification("Failed to fetch suppliers", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSKUs = async () => {
    try {
      const response = await masterService.getSKUs({ limit: 1000 });
      setSkus(response.skus || []);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
    }
  };

  const fetchSupplierBaseRates = useCallback(
    async (supplierId) => {
      if (!supplierId) return;
      setLoadingBaseRates(true);
      try {
        const rates = await masterService.getSupplierBaseRates(supplierId);
        setSupplierBaseRates(rates);
      } catch (error) {
        showNotification("Failed to fetch base rates", "error");
        setSupplierBaseRates([]);
      } finally {
        setLoadingBaseRates(false);
      }
    },
    [showNotification]
  );

  const fetchRateHistory = useCallback(
    async (supplierId) => {
      if (!supplierId) return;
      setLoadingRateHistory(true);
      try {
        const history = await masterService.getAllSupplierRateHistory(
          supplierId
        );
        setRateHistory(history);
      } catch (error) {
        showNotification("Failed to fetch rate history", "error");
        setRateHistory([]);
      } finally {
        setLoadingRateHistory(false);
      }
    },
    [showNotification]
  );

  const fetchContactPersons = useCallback(
    async (supplierId) => {
      if (!supplierId) return;
      setLoadingContactPersons(true);
      try {
        const persons = await masterService.getSupplierContactPersons(
          supplierId
        );
        setContactPersons(persons);
      } catch (error) {
        showNotification("Failed to fetch contact persons", "error");
        setContactPersons([]);
      } finally {
        setLoadingContactPersons(false);
      }
    },
    [showNotification]
  );

  // Filter out SKUs that already have rates configured
  const availableSkus = useMemo(() => {
    const existingSkuIds = new Set(
      supplierBaseRates.map((rate) => rate.skuId?._id).filter(Boolean)
    );
    return skus.filter((sku) => !existingSkuIds.has(sku._id));
  }, [skus, supplierBaseRates]);

  // Check if a primary contact already exists
  const hasPrimaryContact = useMemo(() => {
    return contactPersons.some((person) => person.isPrimary);
  }, [contactPersons]);

  const handleAdd = async () => {
    setSelectedSupplier(null);
    setTabValue(0);
    setSupplierBaseRates([]);
    setRateHistory([]);
    setContactPersons([]);
    setSelectedSku(null);
    setBaseRateValue("");
    setNewContactPerson(initialContactPerson);

    // Fetch next supplier code
    let nextCode = "";
    try {
      nextCode = await masterService.getNextSupplierCode();
    } catch (error) {
      console.error("Failed to fetch next supplier code:", error);
    }

    reset({
      supplierCode: nextCode,
      name: "",
      gstin: "",
      addressline1: "",
      addressline2: "",
      city: "",
      state: "",
      country: "India",
      pincode: "",
      active: true,
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setSelectedSupplier(row);
    setTabValue(0);
    setSelectedSku(null);
    setBaseRateValue("");
    setNewContactPerson(initialContactPerson);
    reset({
      supplierCode: row.supplierCode || "",
      name: row.name || "",
      gstin: row.gstin || "",
      phone: row.phone || "",
      whatsappNumber: row.whatsappNumber || "",
      email: row.email || "",
      addressline1: row.addressline1 || "",
      addressline2: row.addressline2 || "",
      city: row.city || "",
      state: row.state || "",
      country: row.country || "India",
      pincode: row.pincode || "",
      active: row.active !== undefined ? row.active : true,
    });
    setOpenDialog(true);
    // Fetch base rates, rate history, and contact persons for this supplier
    fetchSupplierBaseRates(row._id);
    fetchRateHistory(row._id);
    fetchContactPersons(row._id);
  };

  const handleDelete = (row) => {
    setDeleteId(row._id);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await masterService.deleteSupplier(deleteId);
      showNotification("Supplier deleted successfully", "success");
      fetchSuppliers();
    } catch (error) {
      showNotification("Failed to delete supplier", "error");
    }
    setOpenConfirm(false);
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        supplierCode: data.supplierCode,
        name: data.name,
        gstin: data.gstin,
        phone: data.phone,
        whatsappNumber: data.whatsappNumber,
        email: data.email,
        addressline1: data.addressline1,
        addressline2: data.addressline2,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode,
        active: data.active,
      };

      if (selectedSupplier) {
        await masterService.updateSupplier(selectedSupplier._id, payload);
        showNotification("Supplier updated successfully", "success");
        setOpenDialog(false);
      } else {
        // Create new supplier and stay on dialog to add base rates
        const response = await masterService.createSupplier(payload);
        const newSupplier = response?.data || response;
        showNotification(
          "Supplier created successfully. You can now add base rates.",
          "success"
        );

        // Set the newly created supplier and switch to Base Rates tab
        setSelectedSupplier(newSupplier);
        setSupplierBaseRates([]);
        setRateHistory([]);
        setTabValue(1);
      }
      fetchSuppliers();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Refresh rate history when switching to that tab
    if (newValue === 2 && selectedSupplier) {
      fetchRateHistory(selectedSupplier._id);
    }
    // Refresh contact persons when switching to that tab
    if (newValue === 3 && selectedSupplier) {
      fetchContactPersons(selectedSupplier._id);
    }
  };

  // Base Rate handlers
  const handleAddBaseRate = async () => {
    if (!selectedSupplier) {
      showNotification("Please save the supplier first", "warning");
      return;
    }

    if (!selectedSku) {
      showNotification("Please select a SKU", "warning");
      return;
    }

    if (!baseRateValue || isNaN(parseFloat(baseRateValue))) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }

    try {
      await masterService.upsertSupplierBaseRate(
        selectedSupplier._id,
        selectedSku._id,
        parseFloat(baseRateValue)
      );
      showNotification("Base rate added successfully", "success");
      setSelectedSku(null);
      setBaseRateValue("");
      fetchSupplierBaseRates(selectedSupplier._id);
    } catch (error) {
      showNotification(error.message || "Failed to save base rate", "error");
    }
  };

  const handleDeleteBaseRate = (baseRateId) => {
    setBaseRateDeleteId(baseRateId);
    setOpenBaseRateConfirm(true);
  };

  const confirmDeleteBaseRate = async () => {
    if (!selectedSupplier || !baseRateDeleteId) return;

    try {
      await masterService.deleteSupplierBaseRate(
        selectedSupplier._id,
        baseRateDeleteId
      );
      showNotification("Base rate deleted successfully", "success");
      fetchSupplierBaseRates(selectedSupplier._id);
    } catch (error) {
      showNotification("Failed to delete base rate", "error");
    }
    setOpenBaseRateConfirm(false);
    setBaseRateDeleteId(null);
  };

  // Edit Rate handlers
  const handleEditBaseRate = (rate) => {
    setEditingRate(rate);
    setEditRateValue(rate.rate?.toString() || "");
    setOpenEditRateDialog(true);
  };

  const handleSaveEditedRate = async () => {
    if (!selectedSupplier || !editingRate) return;

    if (!editRateValue || isNaN(parseFloat(editRateValue))) {
      showNotification("Please enter a valid rate", "warning");
      return;
    }

    const newRate = parseFloat(editRateValue);
    if (newRate === editingRate.rate) {
      showNotification("Rate is unchanged", "info");
      setOpenEditRateDialog(false);
      return;
    }

    try {
      await masterService.upsertSupplierBaseRate(
        selectedSupplier._id,
        editingRate.skuId._id,
        newRate
      );
      showNotification("Base rate updated successfully", "success");
      setOpenEditRateDialog(false);
      setEditingRate(null);
      setEditRateValue("");
      fetchSupplierBaseRates(selectedSupplier._id);
      // Also refresh rate history
      fetchRateHistory(selectedSupplier._id);
    } catch (error) {
      showNotification(error.message || "Failed to update base rate", "error");
    }
  };

  // Contact Person handlers
  const handleAddContactPerson = async () => {
    if (!selectedSupplier) {
      showNotification("Please save the supplier first", "warning");
      return;
    }

    if (!newContactPerson.name.trim()) {
      showNotification("Please enter contact person name", "warning");
      return;
    }

    try {
      await masterService.createSupplierContactPerson(selectedSupplier._id, {
        contactPersonName: newContactPerson.name.trim(),
        contactPersonEmail: newContactPerson.email.trim(),
        contactPersonPhone: newContactPerson.phone,
        isPrimary: newContactPerson.isPrimary,
      });
      showNotification("Contact person added successfully", "success");
      setNewContactPerson(initialContactPerson);
      fetchContactPersons(selectedSupplier._id);
    } catch (error) {
      showNotification(
        error.message || "Failed to add contact person",
        "error"
      );
    }
  };

  const handleEditContactPerson = (person) => {
    setEditingContactPerson(person);
    setEditContactPerson({
      name: person.contactPersonName || "",
      email: person.contactPersonEmail || "",
      phone: person.contactPersonPhone || "",
      isPrimary: person.isPrimary || false,
    });
    setOpenEditContactDialog(true);
  };

  const handleSaveEditedContactPerson = async () => {
    if (!selectedSupplier || !editingContactPerson) return;

    if (!editContactPerson.name.trim()) {
      showNotification("Please enter contact person name", "warning");
      return;
    }

    try {
      await masterService.updateSupplierContactPerson(
        selectedSupplier._id,
        editingContactPerson._id,
        {
          contactPersonName: editContactPerson.name.trim(),
          contactPersonEmail: editContactPerson.email.trim(),
          contactPersonPhone: editContactPerson.phone,
          isPrimary: editContactPerson.isPrimary,
        }
      );
      showNotification("Contact person updated successfully", "success");
      setOpenEditContactDialog(false);
      setEditingContactPerson(null);
      setEditContactPerson(initialContactPerson);
      fetchContactPersons(selectedSupplier._id);
    } catch (error) {
      showNotification(
        error.message || "Failed to update contact person",
        "error"
      );
    }
  };

  const handleDeleteContactPerson = (contactPersonId) => {
    setContactPersonDeleteId(contactPersonId);
    setOpenContactPersonConfirm(true);
  };

  const confirmDeleteContactPerson = async () => {
    if (!selectedSupplier || !contactPersonDeleteId) return;

    try {
      await masterService.deleteSupplierContactPerson(
        selectedSupplier._id,
        contactPersonDeleteId
      );
      showNotification("Contact person deleted successfully", "success");
      fetchContactPersons(selectedSupplier._id);
    } catch (error) {
      showNotification("Failed to delete contact person", "error");
    }
    setOpenContactPersonConfirm(false);
    setContactPersonDeleteId(null);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    { field: "supplierCode", headerName: "Supplier Code" },
    { field: "name", headerName: "Supplier Name" },
    { field: "gstin", headerName: "GSTIN" },
    { field: "phone", headerName: "Phone" },
    { field: "whatsappNumber", headerName: "Whatsapp Number" },
    { field: "email", headerName: "Email" },
    {
      field: "city",
      headerName: "Location",
      renderCell: (params) => {
        const row = params.row;
        const parts = [];
        if (row.city) parts.push(row.city);
        if (row.state) parts.push(row.state);
        return parts.length > 0 ? parts.join(", ") : "-";
      },
    },
    {
      field: "active",
      headerName: "Status",
      renderCell: (params) => (params.value ? "Active" : "Inactive"),
    },
  ];

  return (
    <Box>
      <DataTable
        title="Suppliers"
        columns={columns}
        rows={suppliers}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {selectedSupplier ? "Edit Supplier" : "Add New Supplier"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Details" />
                <Tab label="Contact Persons" disabled={!selectedSupplier} />
                <Tab label="Base Rates" disabled={!selectedSupplier} />
                <Tab label="Rate History" disabled={!selectedSupplier} />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: "Supplier name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Supplier Name"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="supplierCode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Supplier Code"
                        inputProps={{ style: { textTransform: "uppercase" } }}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                        disabled={!!selectedSupplier}
                        error={!!errors.supplierCode}
                        helperText={errors.supplierCode?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="gstin"
                    control={control}
                    rules={{
                      required: "GSTIN is required",
                      pattern: {
                        value:
                          /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                        message: "Invalid GSTIN format (e.g., 27ABCDE1234F1Z5)",
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="GSTIN"
                        error={!!errors.gstin}
                        helperText={errors.gstin?.message}
                        inputProps={{ style: { textTransform: "uppercase" } }}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="phone"
                    control={control}
                    rules={{
                      required: "Phone number is required",
                    }}
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
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="whatsappNumber"
                    control={control}
                    rules={{
                      required: "Whatsapp number is required",
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Whatsapp Number"
                        error={!!errors.whatsappNumber}
                        helperText={errors.whatsappNumber?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="email"
                    control={control}
                    rules={{
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message:
                          "Invalid email format (e.g., example@example.com)",
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Email"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="addressline1"
                    control={control}
                    rules={{ required: "Address line 1 is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Address Line 1"
                        error={!!errors.addressline1}
                        helperText={errors.addressline1?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="addressline2"
                    control={control}
                    rules={{ required: "Address line 2 is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Address Line 2"
                        error={!!errors.addressline2}
                        helperText={errors.addressline2?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="city"
                    control={control}
                    rules={{ required: "City is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="City"
                        error={!!errors.city}
                        helperText={errors.city?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="country"
                    control={control}
                    rules={{ required: "Country is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Country"
                        error={!!errors.country}
                        helperText={errors.country?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="pincode"
                    control={control}
                    rules={{
                      required: "Pincode is required",
                      pattern: {
                        value: /^[0-9]{6}$/,
                        message: "Pincode must be 6 digits",
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Pincode"
                        error={!!errors.pincode}
                        helperText={errors.pincode?.message}
                        inputProps={{ maxLength: 6 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      mt: 1,
                    }}
                  >
                    <Controller
                      name="active"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="Active"
                        />
                      )}
                    />
                  </Box>
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {!selectedSupplier ? (
                <Typography
                  color="text.secondary"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  Please save the supplier first to manage contact persons.
                </Typography>
              ) : (
                <Box>
                  {/* Add Contact Person Form */}
                  <Paper sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Add New Contact Person
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Name"
                          value={newContactPerson.name}
                          onChange={(e) =>
                            setNewContactPerson((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Enter contact name"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Email"
                          type="email"
                          value={newContactPerson.email}
                          onChange={(e) =>
                            setNewContactPerson((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Enter email address"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Phone"
                          type="number"
                          value={newContactPerson.phone}
                          onChange={(e) =>
                            setNewContactPerson((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="Enter phone number"
                        />
                      </Grid>
                      {!hasPrimaryContact && (
                        <Grid item xs={12} sm={2}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={newContactPerson.isPrimary}
                                onChange={(e) =>
                                  setNewContactPerson((prev) => ({
                                    ...prev,
                                    isPrimary: e.target.checked,
                                  }))
                                }
                                size="small"
                              />
                            }
                            label="Primary"
                          />
                        </Grid>
                      )}
                      <Grid item xs={12} sm={2}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={handleAddContactPerson}
                          disabled={!newContactPerson.name.trim()}
                        >
                          Add
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Contact Persons List */}
                  <Typography variant="subtitle2" gutterBottom>
                    Contact Persons
                  </Typography>
                  {loadingContactPersons ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : contactPersons.length === 0 ? (
                    <Typography
                      color="text.secondary"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      No contact persons added for this supplier.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell align="center">Primary</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {contactPersons.map((person) => (
                            <TableRow key={person._id} hover>
                              <TableCell>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <PersonIcon fontSize="small" color="action" />
                                  {person.contactPersonName}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {person.contactPersonEmail || "-"}
                              </TableCell>
                              <TableCell>
                                {person.contactPersonPhone || "-"}
                              </TableCell>
                              <TableCell align="center">
                                {person.isPrimary ? (
                                  <Chip
                                    icon={<StarIcon />}
                                    label="Primary"
                                    size="small"
                                    color="primary"
                                  />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() =>
                                    handleEditContactPerson(person)
                                  }
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    handleDeleteContactPerson(person._id)
                                  }
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
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {!selectedSupplier ? (
                <Typography
                  color="text.secondary"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  Please save the supplier first to manage base rates.
                </Typography>
              ) : (
                <Box>
                  {/* Add Base Rate Form */}
                  <Paper sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Add New Base Rate
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <Autocomplete
                          value={selectedSku}
                          onChange={(event, newValue) => {
                            setSelectedSku(newValue);
                            setBaseRateValue("");
                          }}
                          options={availableSkus}
                          getOptionLabel={(option) => option.skuCode || ""}
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
                              label="Select SKU"
                              placeholder="Search by SKU, width, category..."
                              size="small"
                            />
                          )}
                          isOptionEqualToValue={(option, value) =>
                            option._id === value._id
                          }
                          noOptionsText={
                            supplierBaseRates.length === skus.length
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
                          value={baseRateValue}
                          onChange={(e) => setBaseRateValue(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                ₹
                              </InputAdornment>
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
                          disabled={!selectedSku || !baseRateValue}
                        >
                          Add
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Base Rates List */}
                  <Typography variant="subtitle2" gutterBottom>
                    Existing Base Rates
                  </Typography>
                  {loadingBaseRates ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : supplierBaseRates.length === 0 ? (
                    <Typography
                      color="text.secondary"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      No base rates configured for this supplier.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>SKU Code</TableCell>
                            <TableCell>Product</TableCell>

                            <TableCell align="right">Rate (₹)</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {supplierBaseRates.map((rate) => {
                            const sku = rate.skuId;
                            const product = sku?.productId;
                            return (
                              <TableRow key={rate._id} hover>
                                <TableCell>{sku?.skuCode || "-"}</TableCell>
                                <TableCell>
                                  {product?.productCode || "-"}
                                </TableCell>

                                <TableCell align="right">
                                  {rate?.rate?.toLocaleString("en-IN") || "-"}
                                </TableCell>
                                <TableCell align="center">
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
                                      handleDeleteBaseRate(rate._id)
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

            <TabPanel value={tabValue} index={3}>
              {!selectedSupplier ? (
                <Typography
                  color="text.secondary"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  Please save the supplier first to view rate history.
                </Typography>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Rate Change History
                  </Typography>
                  {loadingRateHistory ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : rateHistory.length === 0 ? (
                    <Typography
                      color="text.secondary"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      No rate changes recorded for this supplier.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date & Time</TableCell>
                            <TableCell>SKU Code</TableCell>
                            <TableCell>Product</TableCell>
                            <TableCell align="right">
                              Previous Rate (₹)
                            </TableCell>
                            <TableCell align="right">
                              Current Rate (₹)
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rateHistory.map((history) => {
                            const baseRate = history.baseRateId;
                            const sku = baseRate?.skuId;
                            const product = sku?.productId;
                            return (
                              <TableRow key={history._id} hover>
                                <TableCell>
                                  {formatDateTime(history.createdAt)}
                                </TableCell>
                                <TableCell>{sku?.skuCode || "-"}</TableCell>
                                <TableCell>
                                  {product?.productCode || "-"}
                                </TableCell>
                                <TableCell align="right">
                                  {history?.previousRate?.toLocaleString(
                                    "en-IN"
                                  ) || "-"}
                                </TableCell>
                                <TableCell align="right">
                                  {baseRate?.rate?.toLocaleString("en-IN") ||
                                    "-"}
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
            {tabValue === 0 && (
              <Button type="submit" variant="contained">
                {selectedSupplier ? "Update" : "Create"}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Rate Dialog */}
      <Dialog
        open={openEditRateDialog}
        onClose={() => setOpenEditRateDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Update Base Rate</DialogTitle>
        <DialogContent>
          {editingRate && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                SKU: <strong>{editingRate.skuId?.skuCode}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Product:{" "}
                <strong>
                  {editingRate.skuId?.productId?.productCode || "-"}
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Rate:{" "}
                <strong>₹{editingRate.rate?.toLocaleString("en-IN")}</strong>
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
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This will also delete all associated base rates."
      />

      <ConfirmDialog
        open={openBaseRateConfirm}
        onClose={() => setOpenBaseRateConfirm(false)}
        onConfirm={confirmDeleteBaseRate}
        title="Delete Base Rate"
        message="Are you sure you want to delete this base rate?"
      />

      {/* Edit Contact Person Dialog */}
      <Dialog
        open={openEditContactDialog}
        onClose={() => setOpenEditContactDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Contact Person</DialogTitle>
        <DialogContent>
          {editingContactPerson && (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Name"
                value={editContactPerson.name}
                onChange={(e) =>
                  setEditContactPerson((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                sx={{ mb: 2 }}
                autoFocus
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editContactPerson.email}
                onChange={(e) =>
                  setEditContactPerson((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Phone"
                type="number"
                value={editContactPerson.phone}
                onChange={(e) =>
                  setEditContactPerson((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                sx={{ mb: 2 }}
              />
              {/* Only show Primary switch if this contact is already primary or no primary exists */}
              {(editingContactPerson?.isPrimary || !hasPrimaryContact) && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={editContactPerson.isPrimary}
                      onChange={(e) =>
                        setEditContactPerson((prev) => ({
                          ...prev,
                          isPrimary: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Primary"
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditContactDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEditedContactPerson}
            disabled={!editContactPerson.name.trim()}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={openContactPersonConfirm}
        onClose={() => setOpenContactPersonConfirm(false)}
        onConfirm={confirmDeleteContactPerson}
        title="Delete Contact Person"
        message="Are you sure you want to delete this contact person?"
      />
    </Box>
  );
};

export default Suppliers;

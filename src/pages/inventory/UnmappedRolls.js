import React, { useState, useEffect } from "react";
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
  Typography,
  Checkbox,
  Alert,
} from "@mui/material";
import { Map as MapIcon, CheckCircle as SaveIcon } from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import { useApp } from "../../contexts/AppContext";
import inventoryService from "../../services/inventoryService";
import masterService from "../../services/masterService";
import { formatDate } from "../../utils/formatters";

const UnmappedRolls = () => {
  const { showNotification, setLoading } = useApp();
  const [unmappedRolls, setUnmappedRolls] = useState([]);
  const [selectedRolls, setSelectedRolls] = useState([]);
  const [skus, setSKUs] = useState([]);
  const [openMappingDialog, setOpenMappingDialog] = useState(false);
  const [mappingData, setMappingData] = useState({});

  const { control, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    fetchUnmappedRolls();
    fetchSKUs();
  }, []);

  const fetchUnmappedRolls = async () => {
    setLoading(true);
    try {
      const response = await inventoryService.getUnmappedRolls();
      // API returns { success, count, data: [...] }; api.js already unwraps to the body
      setUnmappedRolls(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      showNotification("Failed to fetch unmapped rolls", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSKUs = async () => {
    try {
      // masterService.getSKUs returns { skus: [...], pagination: {} }
      const response = await masterService.getSKUs({ active: true });
      setSKUs(response.skus || []);
    } catch (error) {
      console.error("Failed to fetch SKUs:", error);
    }
  };

  const handleSelectRoll = (rollId) => {
    setSelectedRolls((prev) => {
      if (prev.includes(rollId)) {
        return prev.filter((id) => id !== rollId);
      }
      return [...prev, rollId];
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRolls(unmappedRolls.map((roll) => roll._id));
    } else {
      setSelectedRolls([]);
    }
  };

  // Helper to extract display names from a (possibly populated) SKU object
  const getSkuDisplayNames = (sku) => {
    if (!sku) return { categoryName: "", gsm: "", qualityName: "" };
    const product = sku.productId;
    return {
      // SKU model doesn't have these fields directly — they come from populated Product refs
      categoryName:
        product?.categoryId?.name || product?.category?.name || sku.categoryName || "",
      gsm:
        product?.gsmId?.value?.toString() ||
        product?.gsmId?.name ||
        product?.gsm?.name ||
        sku.gsm ||
        "",
      qualityName:
        product?.qualityId?.name || product?.quality?.name || sku.qualityName || "",
    };
  };

  const handleBulkMap = () => {
    if (selectedRolls.length === 0) {
      showNotification("Please select rolls to map", "warning");
      return;
    }

    const initialMapping = {};
    selectedRolls.forEach((rollId) => {
      const roll = unmappedRolls.find((r) => r._id === rollId);
      if (roll) {
        initialMapping[rollId] = {
          rollNumber: roll.rollNumber,
          skuId: "",
          widthInches: roll.widthInches || "",
          // Use currentLengthMeters first, fall back to originalLengthMeters
          lengthMeters: roll.currentLengthMeters ?? roll.originalLengthMeters ?? 0,
          categoryName: "",
          gsm: roll.gsm || "",
          qualityName: roll.qualityName || roll.qualityGrade || "",
        };
      }
    });

    setMappingData(initialMapping);
    setOpenMappingDialog(true);
  };

  const handleSKUChange = (rollId, skuId) => {
    const sku = skus.find((s) => s._id === skuId);
    if (sku) {
      const names = getSkuDisplayNames(sku);
      setMappingData((prev) => ({
        ...prev,
        [rollId]: {
          ...prev[rollId],
          skuId,
          widthInches: sku.widthInches,
          ...names,
        },
      }));
    }
  };

  const onSubmitMapping = async () => {
    try {
      const mappings = Object.entries(mappingData).map(([rollId, data]) => ({
        rollId,
        skuId: data.skuId,
        lengthMeters: data.lengthMeters,
      }));

      // mapUnmappedRolls is the correct method name in inventoryService
      await inventoryService.mapUnmappedRolls(mappings);
      showNotification(
        `Successfully mapped ${mappings.length} rolls`,
        "success"
      );
      setOpenMappingDialog(false);
      setSelectedRolls([]);
      fetchUnmappedRolls();
    } catch (error) {
      showNotification("Failed to map rolls", "error");
    }
  };

  const columns = [
    {
      field: "select",
      headerName: (
        <Checkbox
          checked={
            selectedRolls.length === unmappedRolls.length &&
            unmappedRolls.length > 0
          }
          indeterminate={
            selectedRolls.length > 0 &&
            selectedRolls.length < unmappedRolls.length
          }
          onChange={handleSelectAll}
        />
      ),
      minWidth: 60,
      flex: 0,
      sortable: false,
      renderCell: (params) => (
        <Checkbox
          checked={selectedRolls.includes(params.row._id)}
          onChange={() => handleSelectRoll(params.row._id)}
        />
      ),
    },
    { field: "rollNumber", headerName: "Roll Number" },
    { field: "gsm", headerName: "GSM" },
    { field: "qualityName", headerName: "Quality" },
    { field: "widthInches", headerName: 'Width"' },
    {
      field: "currentLengthMeters",
      headerName: "Length (m)",
      renderCell: (params) =>
        params.value ?? params.row?.originalLengthMeters ?? "—",
    },
    { field: "supplierName", headerName: "Supplier", flex: 1 },
    { field: "batchCode", headerName: "Batch" },
    {
      field: "inwardedAt",
      headerName: "Inwarded",
      renderCell: (params) => formatDate(params.value || params.row?.createdAt),
    },
  ];

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Alert severity="warning">
          {unmappedRolls.length} unmapped rolls require SKU mapping
        </Alert>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<MapIcon />}
          onClick={handleBulkMap}
          disabled={selectedRolls.length === 0}
        >
          Map Selected Rolls ({selectedRolls.length})
        </Button>
      </Box>

      <DataTable
        title="Unmapped Rolls"
        columns={columns}
        rows={unmappedRolls}
        hideAddButton
        showActions={false}
      />

      {/* Bulk Mapping Dialog */}
      <Dialog
        open={openMappingDialog}
        onClose={() => setOpenMappingDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Map Rolls to SKUs</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Mapping {selectedRolls.length} rolls. Select appropriate SKU for
            each roll.
          </Alert>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Roll Number</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>GSM</TableCell>
                  <TableCell>Quality</TableCell>
                  <TableCell>Width"</TableCell>
                  <TableCell>Length(m)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(mappingData).map(([rollId, data]) => (
                  <TableRow key={rollId}>
                    <TableCell>{data.rollNumber}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={data.skuId}
                        onChange={(e) =>
                          handleSKUChange(rollId, e.target.value)
                        }
                      >
                        <MenuItem value="">Select SKU</MenuItem>
                        {skus.map((sku) => (
                          <MenuItem key={sku._id} value={sku._id}>
                            {sku.skuCode}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>{data.categoryName || "-"}</TableCell>
                    <TableCell>{data.gsm || "-"}</TableCell>
                    <TableCell>{data.qualityName || "-"}</TableCell>
                    <TableCell>{data.widthInches || "-"}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={data.lengthMeters}
                        onChange={(e) =>
                          setMappingData((prev) => ({
                            ...prev,
                            [rollId]: {
                              ...prev[rollId],
                              lengthMeters: e.target.value,
                            },
                          }))
                        }
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMappingDialog(false)}>Cancel</Button>
          <Button
            onClick={onSubmitMapping}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnmappedRolls;

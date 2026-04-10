import React, { useState, useEffect } from "react";
import {
  Autocomplete,
  Box,
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import {
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  StraightenOutlined as MetersIcon,
} from "@mui/icons-material";
import DataTable from "../../components/common/DataTable";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import inventoryService from "../../services/inventoryService";
import { formatCurrency, formatInches, formatNumber } from "../../utils/formatters";

const StockSummary = () => {
  const { showNotification, setLoading } = useApp();
  const [stockData, setStockData] = useState([]);
  const [summary, setSummary] = useState({
    totalRolls: 0,
    totalMeters: 0,
    totalValue: 0,
    totalCategories: 0,
  });
  const [filters, setFilters] = useState({
    categoryId: "",
    status: "Mapped",
  });
  const [rollDetailsDialog, setRollDetailsDialog] = useState({
    open: false,
    row: null,
    rolls: [],
  });
  const statusOptions = [
    { value: "", label: "All" },
    { value: "Mapped", label: "Mapped (Available)" },
    { value: "Allocated", label: "Allocated" },
    { value: "Dispatched", label: "Dispatched" },
  ];

  useEffect(() => {
    fetchStockSummary();
  }, [filters]);

  const fetchStockSummary = async () => {
    setLoading(true);
    try {
      const response = await inventoryService.getStockSummary(filters);
      const payload = response?.data || response || {};

      const sourceItems =
        payload.items ||
        payload.summary || // API returns `summary` array for grouped stock
        [];

      const normalizedItems = (sourceItems || []).map((item, idx) => {
        const id = item._id || {};
        const totalRolls = Number(item.totalRolls) || 0;
        const totalMeters =
          Number(item.totalMeters ?? item.totalLengthMeters) || 0;
        const totalValue = Number(item.totalValue) || 0;
        const avgCostPerRoll =
          totalRolls > 0 ? totalValue / totalRolls : 0;

        return {
          id: item.id || idx,
          status: id.status || item.status || "-",
          skuId: id.skuId || item.skuId || "",
          skuCode: item.skuCode || id.skuCode || "-",
          categoryName: item.categoryName || id.categoryName || "-",
          gsm: item.gsm || id.gsm || "-",
          qualityName: item.qualityName || id.quality || "-",
          widthInches: item.widthInches || id.width || "-",
          totalRolls,
          totalLengthMeters: totalMeters,
          totalValue,
          avgCostPerRoll,
          allocatedRolls: item.allocatedRolls || 0,
          dispatchedRolls: item.dispatchedRolls || 0,
        };
      });

      // Derive summary if not provided explicitly
      const derivedSummary = normalizedItems.reduce(
        (acc, row) => {
          acc.totalRolls += row.totalRolls || 0;
          acc.totalMeters += row.totalLengthMeters || 0;
          acc.totalValue += row.totalValue || 0;
          return acc;
        },
        { totalRolls: 0, totalMeters: 0, totalValue: 0, totalCategories: normalizedItems.length }
      );

      setStockData(normalizedItems);
      setSummary(payload.summaryTotals || derivedSummary);
    } catch (error) {
      showNotification("Failed to fetch stock summary", "error");
    } finally {
      setLoading(false);
    }
  };

  const openRollDetails = async (row) => {
    if (!row?.skuId) {
      showNotification("SKU not available for this row", "warning");
      return;
    }
    try {
      setLoading(true);
      const res = await inventoryService.getRolls({
        skuId: row.skuId,
        status: row.status && row.status !== "-" ? row.status : undefined,
        limit: 200,
        page: 1,
      });
      setRollDetailsDialog({
        open: true,
        row,
        rolls: res.rolls || [],
      });
    } catch (e) {
      showNotification("Failed to fetch roll details", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeRollDetails = () => {
    setRollDetailsDialog({ open: false, row: null, rolls: [] });
  };

  const columns = [    
    {
      field: "skuCode",
      headerName: "SKU Code",
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {params.value}
        </Typography>
      ),
    },
    { field: "categoryName", headerName: "Category" },
    { field: "gsm", headerName: "GSM" },
    { field: "qualityName", headerName: "Quality" },
    {
      field: "widthInches",
      headerName: 'Width"',
      renderCell: (params) => formatInches(params.value),
    },
    {
      field: "totalRolls",
      headerName: "Inventory Rolls",
      renderCell: (params) => (
        <Chip label={formatNumber(params.value)} color="primary" size="small" />
      ),
    },
    {
      field: "totalLengthMeters",
      headerName: "Inventory Length (m)",
      renderCell: (params) => formatNumber(params.value, 2),
    },
    {
      field: "totalValue",
      headerName: "Inventory Value",
      renderCell: (params) => formatCurrency(params.value),
    },    
  ];

  const summaryCards = [
    {
      title: "SKU Varieties",
      // Use distinct SKU count from API if available; fall back to row count
      value: formatNumber(summary.distinctSKUs || summary.totalCategories || stockData.length),
      icon: <CategoryIcon sx={{ fontSize: 40, color: "warning.main" }} />,
    },
    {
      title: "Total Meters",
      value: `${formatNumber(summary.totalMeters, 0)} m`,
      icon: <MetersIcon sx={{ fontSize: 40, color: "info.main" }} />,
    },
    {
      title: "Total Value",
      value: formatCurrency(summary.totalValue),
      icon: <TrendingUpIcon sx={{ fontSize: 40, color: "success.main" }} />,
    },
    {
      title: "Total Rolls",
      value: formatNumber(summary.totalRolls),
      icon: <InventoryIcon sx={{ fontSize: 40, color: "primary.main" }} />,
    },
  ];

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {summaryCards.map((card, index) => (
          <Grid item xs={12} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  {card.icon}
                  <Box sx={{ ml: 2, flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                      {card.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Autocomplete
              {...buildSingleSelectAutocompleteProps(
                statusOptions,
                filters.status,
                (value) => setFilters({ ...filters, status: value })
              )}
              size="small"
              fullWidth
              renderInput={(params) => (
                <TextField {...params} label="Status Filter" />
              )}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Stock Summary Table */}
      {/* No onAdd/onEdit/onDelete: DataTable only shows those buttons when callbacks are provided */}
      <DataTable
        title="Stock Summary by SKU"
        columns={columns}
        rows={stockData}
        hideAddButton
        onRowClick={openRollDetails}
      />

      <Dialog
        open={rollDetailsDialog.open}
        onClose={closeRollDetails}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Roll Details
          {rollDetailsDialog.row
            ? ` — ${rollDetailsDialog.row.skuCode} (${rollDetailsDialog.row.status})`
            : ""}
        </DialogTitle>
        <DialogContent dividers>
          {rollDetailsDialog.rolls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No rolls found for this selection.
            </Typography>
          ) : (
            <DataTable
              title=""
              rows={rollDetailsDialog.rolls}
              hideAddButton
              showActions={false}
              columns={[
                { field: "rollNumber", headerName: "Roll No", flex: 1 },
                { field: "barcode", headerName: "Barcode", flex: 1 },
                { field: "status", headerName: "Status" },
                {
                  field: "lengthMeters",
                  headerName: "Length (m)",
                  renderCell: (p) => formatNumber(p.value, 2),
                },
                {
                  field: "landedCostPerMeter",
                  headerName: "Landed ₹/m",
                  renderCell: (p) => formatCurrency(p.value || 0),
                },
                {
                  field: "totalLandedCost",
                  headerName: "Total Landed",
                  renderCell: (p) => formatCurrency(p.value || 0),
                },
                { field: "batchCode", headerName: "Batch" },
                { field: "supplierName", headerName: "Supplier", flex: 1 },
              ]}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRollDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StockSummary;

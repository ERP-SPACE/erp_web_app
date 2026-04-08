import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Chip,
} from "@mui/material";
import {
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  Category as CategoryIcon,
  StraightenOutlined as MetersIcon,
} from "@mui/icons-material";
import DataTable from "../../components/common/DataTable";
import { useApp } from "../../contexts/AppContext";
import inventoryService from "../../services/inventoryService";
import { formatCurrency, formatNumber } from "../../utils/formatters";

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

  const columns = [
    { field: "status", headerName: "Status" },
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
    { field: "widthInches", headerName: 'Width"' },
    {
      field: "totalRolls",
      headerName: "Total Rolls",
      renderCell: (params) => (
        <Chip label={formatNumber(params.value)} color="primary" size="small" />
      ),
    },
    {
      field: "totalLengthMeters",
      headerName: "Total Length (m)",
      renderCell: (params) => formatNumber(params.value, 2),
    },
    {
      field: "totalValue",
      headerName: "Total Value",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "avgCostPerRoll",
      headerName: "Avg Cost/Roll",
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: "allocatedRolls",
      headerName: "Allocated",
      renderCell: (params) => formatNumber(params.value),
    },
    {
      field: "dispatchedRolls",
      headerName: "Dispatched",
      renderCell: (params) => formatNumber(params.value),
    },
  ];

  const summaryCards = [
    {
      title: "Total Rolls",
      value: formatNumber(summary.totalRolls),
      icon: <InventoryIcon sx={{ fontSize: 40, color: "primary.main" }} />,
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
      title: "SKU Varieties",
      // Use distinct SKU count from API if available; fall back to row count
      value: formatNumber(summary.distinctSKUs || summary.totalCategories || stockData.length),
      icon: <CategoryIcon sx={{ fontSize: 40, color: "warning.main" }} />,
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
            <TextField
              select
              fullWidth
              label="Status Filter"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              size="small"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Mapped">Mapped (Available)</MenuItem>
              <MenuItem value="Allocated">Allocated</MenuItem>
              <MenuItem value="Dispatched">Dispatched</MenuItem>
            </TextField>
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
      />
    </Box>
  );
};

export default StockSummary;

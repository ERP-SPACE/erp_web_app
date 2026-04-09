import React, { useState, useEffect, useCallback } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  History as HistoryIcon,
  Delete as ScrapIcon,
} from "@mui/icons-material";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import inventoryService from "../../services/inventoryService";
import {
  formatCurrency,
  formatDate,
  formatInches,
  formatNumber,
  getRollStatusColor,
} from "../../utils/formatters";

const Rolls = () => {
  const { showNotification, setLoading } = useApp();
  const [rolls, setRolls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [selectedRoll, setSelectedRoll] = useState(null);
  const [rollHistory, setRollHistory] = useState([]);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [confirmScrap, setConfirmScrap] = useState(false);
  const [scrapReason, setScrapReason] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    barcode: "",
  });
  const statusOptions = [
    { value: "", label: "All" },
    { value: "Unmapped", label: "Unmapped" },
    { value: "Mapped", label: "Mapped" },
    { value: "Allocated", label: "Allocated" },
    { value: "Dispatched", label: "Dispatched" },
    { value: "Returned", label: "Returned" },
    { value: "Scrap", label: "Scrap" },
  ];

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };
      const response = await inventoryService.getRolls(params);
      // rollController returns { success, rolls: [...], pagination: {...} }
      setRolls(response?.rolls || response?.data || []);
      if (response?.pagination) {
        setPagination((prev) => ({ ...prev, ...response.pagination }));
      }
    } catch (error) {
      showNotification("Failed to fetch rolls", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, showNotification, setLoading]);

  useEffect(() => {
    fetchRolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.page]);

  const handleView = async (row) => {
    try {
      const response = await inventoryService.getRoll(row._id);
      setSelectedRoll(response?.data || response);
      setOpenDetailDialog(true);
    } catch (error) {
      showNotification("Failed to fetch roll details", "error");
    }
  };

  const handleHistory = async (row) => {
    try {
      const response = await inventoryService.getRollHistory(row._id);
      setRollHistory(response?.data || response || []);
      setSelectedRoll(row);
      setOpenHistoryDialog(true);
    } catch (error) {
      showNotification("Failed to fetch roll history", "error");
    }
  };

  const handleScrap = (row) => {
    setSelectedRoll(row);
    setScrapReason("");
    setConfirmScrap(true);
  };

  const confirmScrapRoll = async () => {
    try {
      // Use the dedicated markAsScrap endpoint to run business logic (accounting write-off, etc.)
      await inventoryService.markAsScrap(selectedRoll._id, { reason: scrapReason || "Scrapped" });
      showNotification("Roll marked as scrap", "success");
      fetchRolls();
    } catch (error) {
      showNotification("Failed to mark roll as scrap", "error");
    }
    setConfirmScrap(false);
    setScrapReason("");
  };

  const columns = [
    {
      field: "rollNumber",
      headerName: "Roll Number",
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {params.value}
        </Typography>
      ),
    },
    { field: "barcode", headerName: "Barcode" },
    { field: "batchCode", headerName: "Batch" },
    { field: "categoryName", headerName: "Category" },
    { field: "gsm", headerName: "GSM" },
    { field: "qualityName", headerName: "Quality" },
    {
      field: "widthInches",
      headerName: 'Width"',
      renderCell: (params) => formatInches(params.value),
    },
    {
      field: "currentLengthMeters",
      headerName: "Length (m)",
      renderCell: (params) => formatNumber(params.value ?? params.row?.originalLengthMeters),
    },
    { field: "supplierName", headerName: "Supplier" },
    {
      field: "status",
      headerName: "Status",
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{ backgroundColor: getRollStatusColor(params.value), color: "white" }}
        />
      ),
    },
    {
      field: "inwardedAt",
      headerName: "Inwarded",
      renderCell: (params) => formatDate(params.value || params.row?.createdAt),
    },
  ];

  const customActions = [
    {
      icon: <HistoryIcon />,
      label: "History",
      onClick: handleHistory,
    },
    {
      icon: <ScrapIcon />,
      label: "Mark as Scrap",
      onClick: handleScrap,
      show: (row) => ["Mapped", "Returned"].includes(row.status),
    },
  ];

  return (
    <Box>
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
              renderInput={(params) => <TextField {...params} label="Status" />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search by Barcode"
              value={filters.barcode}
              onChange={(e) =>
                setFilters({ ...filters, barcode: e.target.value })
              }
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              onClick={() => setFilters({ status: "", barcode: "" })}
              size="small"
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <DataTable
        title="Roll Inventory"
        columns={columns}
        rows={rolls}
        onView={handleView}
        customActions={customActions}
        hideAddButton
      />

      {/* Roll Detail Dialog */}
      <Dialog
        open={openDetailDialog}
        onClose={() => setOpenDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Roll Details</DialogTitle>
        <DialogContent>
          {selectedRoll && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Roll Number</Typography>
                <Typography variant="body1" gutterBottom>{selectedRoll.rollNumber}</Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip
                  label={selectedRoll.status}
                  size="small"
                  sx={{
                    backgroundColor: getRollStatusColor(selectedRoll.status),
                    color: "white",
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Product Details</Typography>
                <Typography variant="body2">
                  {selectedRoll.categoryName || "—"} — {selectedRoll.gsm || "—"} GSM — {selectedRoll.qualityName || "—"}
                </Typography>
                <Typography variant="body2">
                  Width: {formatInches(selectedRoll.widthInches)} | Length: {formatNumber(selectedRoll.currentLengthMeters ?? selectedRoll.originalLengthMeters)}m
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Barcode</Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {selectedRoll.barcode || "Not generated"}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Cost Information</Typography>
                <Typography variant="body2">
                  Base Cost/m: {formatCurrency(selectedRoll.baseCostPerMeter || 0)}
                </Typography>
                <Typography variant="body2">
                  Landed Cost/m: {formatCurrency(selectedRoll.landedCostPerMeter || 0)}
                </Typography>
                <Typography variant="body2">
                  Total Landed Cost: {formatCurrency(selectedRoll.totalLandedCost || 0)}
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Source Information</Typography>
                <Typography variant="body2">
                  Supplier: {selectedRoll.supplierName || selectedRoll.supplierId?.name || "—"}
                </Typography>
                <Typography variant="body2">
                  Batch: {selectedRoll.batchCode || selectedRoll.batchId?.batchCode || "—"}
                </Typography>
                <Typography variant="body2">
                  Purchase Invoice: {selectedRoll.purchaseInvoiceId?.piNumber || selectedRoll.purchaseInvoiceId || "—"}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Allocation Information</Typography>
                {selectedRoll.allocationDetails?.soLineId ? (
                  <>
                    <Typography variant="body2">
                      SO: {selectedRoll.allocationDetails.soId?.soNumber || selectedRoll.allocationDetails.soId || "—"}
                    </Typography>
                    <Typography variant="body2">
                      Allocated at: {formatDate(selectedRoll.allocationDetails.allocatedAt)}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">Not allocated</Typography>
                )}
              </Grid>

              {selectedRoll.returnDetails?.returnReason && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Return Information</Typography>
                    <Typography variant="body2">Reason: {selectedRoll.returnDetails.returnReason}</Typography>
                    {selectedRoll.returnDetails.returnedAt && (
                      <Typography variant="body2">Returned: {formatDate(selectedRoll.returnDetails.returnedAt)}</Typography>
                    )}
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Timeline</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Inwarded" secondary={formatDate(selectedRoll.inwardedAt || selectedRoll.createdAt)} />
                  </ListItem>
                  {selectedRoll.mappedAt && (
                    <ListItem>
                      <ListItemText primary="Mapped" secondary={formatDate(selectedRoll.mappedAt)} />
                    </ListItem>
                  )}
                  {selectedRoll.allocationDetails?.allocatedAt && (
                    <ListItem>
                      <ListItemText
                        primary="Allocated"
                        secondary={formatDate(selectedRoll.allocationDetails.allocatedAt)}
                      />
                    </ListItem>
                  )}
                  {selectedRoll.dispatchDetails?.dispatchedAt && (
                    <ListItem>
                      <ListItemText
                        primary="Dispatched"
                        secondary={formatDate(selectedRoll.dispatchDetails.dispatchedAt)}
                      />
                    </ListItem>
                  )}
                  {selectedRoll.returnDetails?.returnedAt && (
                    <ListItem>
                      <ListItemText
                        primary="Returned"
                        secondary={formatDate(selectedRoll.returnDetails.returnedAt)}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Roll History Dialog */}
      <Dialog
        open={openHistoryDialog}
        onClose={() => setOpenHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Roll History — {selectedRoll?.rollNumber}</DialogTitle>
        <DialogContent>
          <List>
            {rollHistory.length === 0 ? (
              <ListItem>
                <ListItemText primary="No history available" />
              </ListItem>
            ) : (
              rollHistory.map((event, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemText
                      primary={event.action}
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            {formatDate(event.timestamp)}
                          </Typography>
                          <Typography variant="caption">{event.details}</Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {index < rollHistory.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Scrap Confirmation */}
      <ConfirmDialog
        open={confirmScrap}
        onClose={() => setConfirmScrap(false)}
        onConfirm={confirmScrapRoll}
        title="Mark as Scrap"
        message={
          <Box>
            <Typography gutterBottom>
              Are you sure you want to mark roll <strong>{selectedRoll?.rollNumber}</strong> as scrap?
            </Typography>
            <TextField
              fullWidth
              label="Reason (optional)"
              value={scrapReason}
              onChange={(e) => setScrapReason(e.target.value)}
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
        }
        confirmColor="error"
      />
    </Box>
  );
};

export default Rolls;

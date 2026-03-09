import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Typography,
  Chip,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  AccountBalance as BalanceIcon,
  TrendingUp as DebitIcon,
  TrendingDown as CreditIcon,
} from "@mui/icons-material";
import DataTable from "../../components/common/DataTable";
import { useApp } from "../../contexts/AppContext";
import accountingService from "../../services/accountingService";
import { formatCurrency, formatDate } from "../../utils/formatters";

const Ledgers = () => {
  const { showNotification, setLoading } = useApp();
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerBalance, setLedgerBalance] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });

  const fetchLedgers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await accountingService.getLedgers();
      setLedgers(response.data);
    } catch (error) {
      showNotification("Failed to fetch ledgers", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification, setLoading]);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  const handleView = async (row) => {
    setSelectedLedger(row);
    await fetchLedgerEntries(row._id);
    await fetchLedgerBalance(row._id);
    setOpenViewDialog(true);
  };

  const fetchLedgerEntries = async (ledgerId, filters = {}) => {
    try {
      const response = await accountingService.getLedgerEntries(ledgerId, {
        ...filters,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setLedgerEntries(response.data);
    } catch (error) {
      showNotification("Failed to fetch ledger entries", "error");
    }
  };

  const fetchLedgerBalance = async (ledgerId) => {
    try {
      const response = await accountingService.getLedgerBalance(ledgerId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setLedgerBalance(response.data);
    } catch (error) {
      showNotification("Failed to fetch ledger balance", "error");
    }
  };

  const handleDateRangeChange = () => {
    if (selectedLedger) {
      fetchLedgerEntries(selectedLedger._id);
      fetchLedgerBalance(selectedLedger._id);
    }
  };

  const columns = [
    {
      field: "ledgerCode",
      headerName: "Ledger Code",
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {params.value}
        </Typography>
      ),
    },
    { field: "name", headerName: "Ledger Name", flex: 1 },
    {
      field: "ledgerGroup",
      headerName: "Group",
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" />
      ),
    },
    {
      field: "currentBalance",
      headerName: "Current Balance",
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value >= 0 ? "success.main" : "error.main"}
          sx={{ fontWeight: "bold" }}
        >
          {formatCurrency(Math.abs(params.value || 0))}
          {params.value >= 0 ? "Dr" : "Cr"}
        </Typography>
      ),
    },
    {
      field: "isActive",
      headerName: "Status",
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "default"}
          size="small"
        />
      ),
    },
  ];

  return (
    <Box>
      <DataTable
        title="Ledgers"
        columns={columns}
        rows={ledgers}
        onView={handleView}
        hideAddButton
        hideEditButton
        hideDeleteButton
      />

      {/* Ledger Detail Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Ledger Statement - {selectedLedger?.name}</DialogTitle>
        <DialogContent>
          {selectedLedger && (
            <Box>
              {/* Ledger Info Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <BalanceIcon
                          sx={{ fontSize: 40, color: "primary.main", mr: 2 }}
                        />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Current Balance
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                            {formatCurrency(
                              Math.abs(ledgerBalance?.balance || 0)
                            )}
                            {(ledgerBalance?.balance || 0) >= 0 ? "Dr" : "Cr"}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <DebitIcon
                          sx={{ fontSize: 40, color: "success.main", mr: 2 }}
                        />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Total Debit
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                            {formatCurrency(ledgerBalance?.totalDebit || 0)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <CreditIcon
                          sx={{ fontSize: 40, color: "error.main", mr: 2 }}
                        />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Total Credit
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                            {formatCurrency(ledgerBalance?.totalCredit || 0)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Date Range Filter */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <DatePicker
                      label="Start Date"
                      value={dateRange.startDate}
                      onChange={(newValue) =>
                        setDateRange({ ...dateRange, startDate: newValue })
                      }
                      renderInput={(params) => (
                        <TextField {...params} fullWidth size="small" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <DatePicker
                      label="End Date"
                      value={dateRange.endDate}
                      onChange={(newValue) =>
                        setDateRange({ ...dateRange, endDate: newValue })
                      }
                      renderInput={(params) => (
                        <TextField {...params} fullWidth size="small" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="contained"
                      onClick={handleDateRangeChange}
                      fullWidth
                    >
                      Apply Filter
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {/* Ledger Entries */}
              <Typography variant="h6" gutterBottom>
                Ledger Entries
              </Typography>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Voucher No.</TableCell>
                      <TableCell>Particulars</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ledgerBalance?.openingBalance !== 0 && (
                      <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableCell colSpan={3}>
                          <Typography variant="subtitle2">
                            Opening Balance
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {ledgerBalance?.openingBalance > 0
                            ? formatCurrency(ledgerBalance?.openingBalance)
                            : "-"}
                        </TableCell>
                        <TableCell align="right">
                          {ledgerBalance?.openingBalance < 0
                            ? formatCurrency(
                                Math.abs(ledgerBalance?.openingBalance)
                              )
                            : "-"}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(
                              Math.abs(ledgerBalance?.openingBalance || 0)
                            )}
                            {(ledgerBalance?.openingBalance || 0) >= 0
                              ? "Dr"
                              : "Cr"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}

                    {ledgerEntries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>{entry.voucherNumber}</TableCell>
                        <TableCell>
                          {entry.narration || entry.particulars}
                        </TableCell>
                        <TableCell align="right">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                        </TableCell>
                        <TableCell align="right">
                          {entry.credit > 0
                            ? formatCurrency(entry.credit)
                            : "-"}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(Math.abs(entry.runningBalance))}
                            {entry.runningBalance >= 0 ? "Dr" : "Cr"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}

                    {ledgerEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No entries found for the selected period
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}

                    {ledgerEntries.length > 0 && (
                      <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableCell colSpan={3}>
                          <Typography variant="subtitle2">
                            Closing Balance
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">
                            {formatCurrency(ledgerBalance?.totalDebit || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2">
                            {formatCurrency(ledgerBalance?.totalCredit || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2" fontWeight="bold">
                            {formatCurrency(
                              Math.abs(ledgerBalance?.balance || 0)
                            )}
                            {(ledgerBalance?.balance || 0) >= 0 ? "Dr" : "Cr"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              {/* Ledger Details */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Ledger Code
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedLedger.ledgerCode}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Ledger Group
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedLedger.ledgerGroup}
                  </Typography>
                </Grid>

                {selectedLedger.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {selectedLedger.description}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => console.log("Print Ledger Statement")}
          >
            Print Statement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Ledgers;

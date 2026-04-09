import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
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
  Alert,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import {
  LocalShipping as ShippingIcon,
  Assignment as InvoiceIcon,
  Print as PrintIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import salesService from "../../services/salesService";
import inventoryService from "../../services/inventoryService";
import {
  formatDate,
  formatInches,
  formatNumber,
  getStatusColor,
} from "../../utils/formatters";

const DeliveryChallans = () => {
  const { showNotification, setLoading } = useApp();
  const [challans, setChallans] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [selectedSO, setSelectedSO] = useState(null);
  const salesOrderOptions = salesOrders.map((so) => ({
    value: so._id,
    label: `${so.soNumber} - ${so.customerName}`,
  }));

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      salesOrderId: "",
      dcDate: new Date(),
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      lines: [],
      notes: "",
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "lines",
  });

  const watchSalesOrderId = watch("salesOrderId");

  const deriveLineMeta = (line = {}) => {
    const skuObj =
      line && typeof line.skuId === "object" && !Array.isArray(line.skuId)
        ? line.skuId
        : null;
    const product =
      line.product ||
      line.productId ||
      line.productInfo ||
      skuObj?.productId ||
      skuObj?.product ||
      skuObj?.productInfo ||
      {};

    const categoryName =
      line.categoryName ||
      line.category?.name ||
      line.categoryId?.name ||
      line.categoryId?.label ||
      skuObj?.categoryName ||
      skuObj?.category?.name ||
      skuObj?.categoryId?.name ||
      product?.categoryName ||
      product?.category?.name ||
      product?.categoryId?.name ||
      product?.categoryId?.label ||
      "";

    const qualityName =
      line.qualityName ||
      line.quality?.name ||
      line.qualityId?.name ||
      line.qualityId?.label ||
      skuObj?.qualityName ||
      skuObj?.quality?.name ||
      skuObj?.qualityId?.name ||
      product?.qualityName ||
      product?.quality?.name ||
      product?.qualityId?.name ||
      product?.qualityId?.label ||
      "";

    const gsm =
      line.gsm ||
      line.gsmValue ||
      line.gsmId?.value ||
      line.gsmId?.label ||
      line.gsm?.value ||
      line.gsm?.label ||
      skuObj?.gsm ||
      skuObj?.gsmValue ||
      skuObj?.gsmId?.value ||
      skuObj?.gsmId?.label ||
      product?.gsm ||
      product?.gsmValue ||
      product?.gsmId?.value ||
      product?.gsmId?.label ||
      "";

    const widthInches =
      line.widthInches ||
      skuObj?.widthInches ||
      product?.widthInches ||
      product?.width ||
      "";

    const lengthMetersPerRoll =
      line.lengthMetersPerRoll ||
      skuObj?.lengthMetersPerRoll ||
      product?.lengthMetersPerRoll ||
      product?.lengthMeters ||
      product?.length ||
      "";

    return {
      categoryName,
      qualityName,
      gsm,
      widthInches,
      lengthMetersPerRoll,
    };
  };

  const resolveFromSku = (line, key) => {
    if (line && line[key] !== undefined && line[key] !== null) return line[key];
    return deriveLineMeta(line)[key] ?? "";
  };

  const resolveSkuCode = (line) => {
    const skuObj =
      line && typeof line.skuId === "object" && !Array.isArray(line.skuId)
        ? line.skuId
        : null;
        console.log("skuObj", skuObj);
    return (
      line?.skuCode ||
      skuObj?.skuCode ||
      skuObj?.code ||
      skuObj?._id ||
      line?.skuId ||
      ""
    );
  };

  useEffect(() => {
    fetchDeliveryChallans();
    fetchSalesOrders();
  }, []);

  useEffect(() => {
    if (watchSalesOrderId) {
      loadSalesOrderDetails(watchSalesOrderId);
    }
  }, [watchSalesOrderId]);

  const fetchDeliveryChallans = async () => {
    setLoading(true);
    try {
      const response = await salesService.getDeliveryChallans();
      setChallans(response.data);
    } catch (error) {
      showNotification("Failed to fetch delivery challans", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const response = await salesService.getSalesOrders({
        status: ["Confirmed", "PartiallyFulfilled"],
      });
      setSalesOrders(response.data);
    } catch (error) {
      console.error("Failed to fetch sales orders:", error);
    }
  };

  const loadSalesOrderDetails = async (soId, { populateDcLines = true } = {}) => {
    try {
      const soResponse = await salesService.getSalesOrder(soId);
      // some APIs return {data}, some return the object directly
      const soRaw = soResponse.data || soResponse;
      if (!soRaw || !soRaw.lines) {
        throw new Error("Invalid sales order payload");
      }
      const enrichedLines = (soRaw.lines || []).map((line) => ({
        ...line,
        ...deriveLineMeta(line),
      }));
      const so = { ...soRaw, lines: enrichedLines };
      setSelectedSO(so);

      if (populateDcLines) {
        // Fetch available rolls for each SO line
        const dcLines = [];
        for (const line of so.lines) {
          const rollsResponse = await inventoryService.getRolls({
            skuId: line.skuId,
            status: "Mapped",
          });

          const rollsData =
            rollsResponse?.data ||
            rollsResponse?.rolls ||
            rollsResponse?.rows ||
            rollsResponse ||
            [];
          const rollsArray = Array.isArray(rollsData)
            ? rollsData
            : Array.isArray(rollsData?.rows)
            ? rollsData.rows
            : Array.isArray(rollsData?.data)
            ? rollsData.data
            : Array.isArray(rollsData?.rolls)
            ? rollsData.rolls
            : [];

          const availableRolls = rollsArray.slice(
            0,
            (line.qtyRolls || 0) - (line.dispatchedQty || 0)
          );

          const meta = deriveLineMeta(line);

          availableRolls.forEach((roll) => {
            dcLines.push({
              soLineId: line._id || line.id,
              rollId: roll._id || roll.id,
              rollNumber: roll.rollNumber,
              skuId: line.skuId,
              skuCode: resolveSkuCode(line),
              categoryName: meta.categoryName,
              gsm: meta.gsm,
              qualityName: meta.qualityName,
              widthInches: meta.widthInches,
              shippedLengthMeters: roll.lengthMeters,
              shippedStatus: "Packed",
            });
          });
        }

        replace(dcLines);
        setAvailableRolls(dcLines);
      }
    } catch (error) {
      console.error("Failed to load sales order details", error);
      showNotification("Failed to load sales order details", "error");
    }
  };

  const handleAdd = () => {
    setSelectedChallan(null);
    setSelectedSO(null);
    reset({
      salesOrderId: "",
      dcDate: new Date(),
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      lines: [],
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleView = async (row) => {
    const soId = row.salesOrderId?._id || row.salesOrderId;
    await loadSalesOrderDetails(soId, { populateDcLines: false });
    setSelectedChallan(row);
    reset({
      salesOrderId: row.salesOrderId?._id || row.salesOrderId,
      dcDate: new Date(row.dcDate),
      vehicleNumber: row.vehicleNumber,
      driverName: row.driverName,
      driverPhone: row.driverPhone,
      lines: row.lines || [],
      notes: row.notes || "",
    });
    setOpenDialog(true);
  };

  const handleGenerateInvoice = async (row) => {
    try {
      // Create sales invoice from delivery challan
      const invoiceData = {
        salesOrderId: row.salesOrderId,
        deliveryChallanId: row._id,
        customerId: row.customerId,
        customerName: row.customerName,
        siDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lines: row.lines.map((line) => ({
          ...line,
          qtyRolls: 1,
          billedLengthMeters: line.shippedLengthMeters,
        })),
      };

      await salesService.createSalesInvoice(invoiceData);
      showNotification("Sales invoice generated successfully", "success");
    } catch (error) {
      showNotification("Failed to generate invoice", "error");
    }
  };

  const onSubmit = async (data) => {
    try {
      if (!selectedSO) {
        showNotification("Select a sales order before saving", "warning");
        return;
      }
      const dcData = {
        ...data,
        customerId: selectedSO.customerId,
        customerName: selectedSO.customerName,
        soNumber: selectedSO.soNumber,
      };

      if (selectedChallan) {
        await salesService.updateDeliveryChallan(selectedChallan._id, dcData);
        showNotification("Delivery challan updated successfully", "success");
      } else {
        await salesService.createDeliveryChallan(dcData);

        // Update roll status to Dispatched
        for (const line of data.lines) {
          await inventoryService.updateRoll(line.rollId, {
            status: "Dispatched",
            dispatchedInDCId: selectedChallan?._id,
            dispatchedAt: new Date(),
          });
        }

        showNotification("Delivery challan created successfully", "success");
      }
      setOpenDialog(false);
      fetchDeliveryChallans();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "dcNumber", headerName: "DC Number" },
    { field: "soNumber", headerName: "SO Number" },
    { field: "customerName", headerName: "Customer", flex: 1 },
    {
      field: "dcDate",
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
      field: "lines",
      headerName: "Rolls",
      renderCell: (params) => params.value?.length || 0,
    },
    { field: "vehicleNumber", headerName: "Vehicle" },
  ];

  const customActions = [
    {
      icon: <InvoiceIcon />,
      label: "Generate Invoice",
      onClick: handleGenerateInvoice,
      show: (row) => row.status === "Open" && !row.invoicedInSIId,
    },
    {
      icon: <PrintIcon />,
      label: "Print",
      onClick: (row) => console.log("Print DC", row),
    },
  ];

  return (
    <Box>
      <DataTable
        title="Delivery Challans"
        columns={columns}
        rows={challans}
        onAdd={handleAdd}
        onView={handleView}
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
            {selectedChallan
              ? `Delivery Challan: ${selectedChallan.dcNumber}`
              : "Create Delivery Challan"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="salesOrderId"
                  control={control}
                  rules={{ required: "Sales Order is required" }}
                  render={({ field }) => (
                    <Autocomplete
                      {...buildSingleSelectAutocompleteProps(
                        salesOrderOptions,
                        field.value,
                        field.onChange
                      )}
                      fullWidth
                      disabled={!!selectedChallan}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Sales Order"
                          error={!!errors.salesOrderId}
                          helperText={errors.salesOrderId?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="dcDate"
                  control={control}
                  rules={{ required: "Date is required" }}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="DC Date"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!errors.dcDate}
                          helperText={errors.dcDate?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="vehicleNumber"
                  control={control}
                  rules={{ required: "Vehicle number is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Vehicle Number"
                      error={!!errors.vehicleNumber}
                      helperText={errors.vehicleNumber?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="driverName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Driver Name" />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="driverPhone"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Driver Phone" />
                  )}
                />
              </Grid>
            </Grid>

            {selectedSO && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Customer: {selectedSO.customerName} | Order Date:
                {formatDate(selectedSO.date)} | Total Items:
                {selectedSO.lines?.length}
              </Alert>
            )}

            {selectedSO?.lines?.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Sales Order Lines
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Qty Rolls</TableCell>
                        <TableCell>Dispatched</TableCell>
                        <TableCell>Balance</TableCell>
                        <TableCell>Width"</TableCell>
                        <TableCell>Length (m/roll)</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Quality</TableCell>
                        <TableCell>GSM</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedSO.lines.map((line) => {
                        const dispatched = Number(line.dispatchedQty) || 0;
                        const qty = Number(line.qtyRolls) || 0;
                        const balance = qty - dispatched;
                        return (
                          <TableRow key={line._id || line.id}>
                            <TableCell>{resolveSkuCode(line)}</TableCell>
                            <TableCell>{qty}</TableCell>
                            <TableCell>{dispatched}</TableCell>
                            <TableCell>{balance}</TableCell>
                            <TableCell>{formatInches(resolveFromSku(line, "widthInches"))}</TableCell>
                            <TableCell>
                              {resolveFromSku(line, "lengthMetersPerRoll")}
                            </TableCell>
                            <TableCell>{resolveFromSku(line, "categoryName")}</TableCell>
                            <TableCell>{resolveFromSku(line, "qualityName")}</TableCell>
                            <TableCell>{resolveFromSku(line, "gsm")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            <Typography variant="h6" gutterBottom>
              Rolls to Dispatch
            </Typography>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Roll Number</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>GSM</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Width"</TableCell>
                    <TableCell>Length (m)</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>{resolveSkuCode(field)}</TableCell>
                      <TableCell>{field.rollNumber}</TableCell>
                      <TableCell>{resolveFromSku(field, "categoryName")}</TableCell>
                      <TableCell>{resolveFromSku(field, "gsm")}</TableCell>
                      <TableCell>{resolveFromSku(field, "qualityName")}</TableCell>
                      <TableCell>{formatInches(resolveFromSku(field, "widthInches"))}</TableCell>
                      <TableCell>{field.shippedLengthMeters}</TableCell>
                      <TableCell>
                        <Controller
                          name={`lines.${index}.shippedStatus`}
                          control={control}
                          render={({ field }) => (
                            <Chip
                              label={field.value}
                              color={
                                field.value === "Dispatched"
                                  ? "success"
                                  : "warning"
                              }
                              size="small"
                            />
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12}>
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
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !!selectedChallan && selectedChallan.status === "Closed"
              }
            >
              {selectedChallan ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default DeliveryChallans;

import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Checkbox,
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
  const [availableRollsBySku, setAvailableRollsBySku] = useState({});
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

  const normalizeId = (val) => {
    if (!val) return "";
    if (typeof val === "object") {
      if (val._id) return String(val._id);
      if (val.id) return String(val.id);
      if (val.value) return String(val.value); // common select option shape
      if (val.key) return String(val.key);
      if (typeof val.toString === "function" && val.toString !== Object.prototype.toString) {
        return String(val.toString());
      }
      return "";
    }
    return String(val);
  };

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
        // Eligible for DC creation: posted/confirmed or partially fulfilled
        status: ["Posted", "Confirmed", "PartiallyFulfilled"],
      });
      const rows = response.data || [];
      // Exclude SOs with no pending balance
      const eligible = rows.filter((so) => {
        const lines = so?.lines || [];
        if (!lines.length) return false;
        return lines.some((l) => (Number(l.qtyRolls) || 0) - (Number(l.dispatchedQty) || 0) > 0);
      });
      setSalesOrders(eligible);
    } catch (error) {
      console.error("Failed to fetch sales orders:", error);
    }
  };

  const fetchAvailableRollsForSku = async (skuId) => {
    const key = normalizeId(skuId);
    if (!key) return [];
    if (availableRollsBySku[key]) return availableRollsBySku[key];

    const rollsResponse = await inventoryService.getRolls({
      skuId: key,
      status: "Mapped,Allocated",
    });

    const rolls = Array.isArray(rollsResponse?.rolls) ? rollsResponse.rolls : [];
    setAvailableRollsBySku((prev) => ({ ...(prev || {}), [key]: rolls }));
    return rolls;
  };

  const remainingBySoLine = useMemo(() => {
    const map = {};
    (selectedSO?.lines || []).forEach((l) => {
      const qty = Number(l.qtyRolls) || 0;
      const dispatched = Number(l.dispatchedQty) || 0;
      map[normalizeId(l._id || l.id)] = Math.max(0, qty - dispatched);
    });
    return map;
  }, [selectedSO]);

  const selectedCountBySoLine = useMemo(() => {
    const map = {};
    (fields || []).forEach((l) => {
      if (!l.selected) return;
      const key = normalizeId(l.soLineId);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [fields]);

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
        const skuIds = [
          ...new Set(
            (so.lines || [])
              .map((l) => normalizeId(l.skuId))
              .filter((id) => Boolean(id))
          ),
        ];
        const loaded = await Promise.all(skuIds.map((id) => fetchAvailableRollsForSku(id)));
        // loaded is an array of roll arrays, but we rely on availableRollsBySku for rendering elsewhere

        const dcLines = [];
        for (const line of so.lines || []) {
          const meta = deriveLineMeta(line);
          const skuKey = normalizeId(line.skuId);
          const rolls =
            availableRollsBySku[skuKey] ||
            loaded[skuIds.indexOf(skuKey)] ||
            [];

          (rolls || []).forEach((roll) => {
            dcLines.push({
              soLineId: line._id || line.id,
              rollId: roll._id || roll.id,
              rollNumber: roll.rollNumber,
              skuId: skuKey,
              skuCode: resolveSkuCode(line),
              categoryName: meta.categoryName,
              gsm: meta.gsm,
              qualityName: meta.qualityName,
              widthInches: roll.widthInches ?? meta.widthInches,
              shippedLengthMeters:
                roll.currentLengthMeters ?? roll.lengthMeters ?? "",
              shippedStatus: "Packed",
              selected: false,
            });
          });
        }

        replace(dcLines);
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

  const handlePostChallan = async (row) => {
    try {
      await salesService.postDeliveryChallan(row._id);
      showNotification("Delivery challan posted (dispatched) successfully", "success");
      fetchDeliveryChallans();
      fetchSalesOrders();
    } catch (error) {
      showNotification(error.message || "Failed to post delivery challan", "error");
    }
  };

  const onSubmit = async (data) => {
    try {
      if (!selectedSO) {
        showNotification("Select a sales order before saving", "warning");
        return;
      }

      if (selectedChallan) {
        await salesService.updateDeliveryChallan(selectedChallan._id, {
          dcDate: data.dcDate,
          vehicleNumber: data.vehicleNumber,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          notes: data.notes,
        });
        showNotification("Delivery challan updated successfully", "success");
      } else {
        const selectedLines = (data.lines || []).filter((l) => l.selected);
        if (!selectedLines.length) {
          showNotification("Please select at least one roll to dispatch", "error");
          return;
        }

        const selectedCount = {};
        selectedLines.forEach((l) => {
          const key = normalizeId(l.soLineId);
          selectedCount[key] = (selectedCount[key] || 0) + 1;
        });
        const overSelected = Object.entries(selectedCount).find(
          ([soLineId, count]) => count > (remainingBySoLine[soLineId] ?? 0)
        );
        if (overSelected) {
          showNotification("Selected rolls exceed dispatch balance for one of the SO lines", "error");
          return;
        }

        const payload = {
          salesOrderId: normalizeId(data.salesOrderId),
          dcDate: data.dcDate,
          vehicleNumber: data.vehicleNumber,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          notes: data.notes,
          lines: selectedLines.map((l) => ({
            soLineId: l.soLineId,
            rollId: normalizeId(l.rollId),
            shippedLengthMeters: l.shippedLengthMeters ? Number(l.shippedLengthMeters) : undefined,
            shippedStatus: l.shippedStatus || "Packed",
          })),
        };

        await salesService.createDeliveryChallan(payload);

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

  const selectedRollIds = useMemo(() => {
    const ids = new Set();
    (fields || []).forEach((f) => {
      const id = normalizeId(f.rollId);
      if (id && f.selected) ids.add(id);
    });
    return ids;
  }, [fields]);

  // Render only up to the remaining dispatch balance per SO line (but always show selected rows).
  // This keeps the "Rolls to Dispatch" list aligned with what can actually be dispatched.
  const visibleLineIndices = useMemo(() => {
    const visible = new Set();
    const counts = {};
    (fields || []).forEach((row, index) => {
      const soLineId = normalizeId(row.soLineId);
      const remaining = remainingBySoLine[soLineId] ?? 0;

      if (row.selected) {
        visible.add(index);
        return;
      }
      if (remaining <= 0) return;

      counts[soLineId] = (counts[soLineId] || 0) + 1;
      if (counts[soLineId] <= remaining) {
        visible.add(index);
      }
    });
    return visible;
  }, [fields, remainingBySoLine]);

  const visibleRowsCount = useMemo(
    () => visibleLineIndices.size,
    [visibleLineIndices]
  );

  const customActions = [
    {
      icon: <InvoiceIcon />,
      label: "Generate Invoice",
      onClick: handleGenerateInvoice,
      show: (row) => row.status === "Posted" && !row.invoicedInSIId,
    },
    {
      icon: <ShippingIcon />,
      label: "Post / Dispatch",
      onClick: handlePostChallan,
      show: (row) => row.status === "Draft",
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
        <form
          onSubmit={handleSubmit(onSubmit, () => {
            showNotification(
              "Please fill required fields (Sales Order, Date, Vehicle Number)",
              "warning"
            );
          })}
        >
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
                        <TableCell>Category</TableCell>
                        <TableCell>Quality</TableCell>
                        <TableCell>GSM</TableCell>
                        <TableCell>Width"</TableCell>                        
                        <TableCell>Total Meters</TableCell>                        
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedSO.lines
                        .map((line) => {
                          const dispatched = Number(line.dispatchedQty) || 0;
                          const qty = Number(line.qtyRolls) || 0;
                          const balance = Math.max(0, qty - dispatched);
                          return { line, qty, dispatched, balance };
                        })
                        .map(({ line, qty, dispatched, balance }) => (
                          <TableRow key={line._id || line.id}>
                            <TableCell>{resolveFromSku(line, "categoryName")}</TableCell>
                          <TableCell>{resolveFromSku(line, "qualityName")}</TableCell>
                          <TableCell>{resolveFromSku(line, "gsm")}</TableCell>
                          <TableCell>{formatInches(resolveFromSku(line, "widthInches"))}</TableCell>
                          <TableCell>{formatNumber(line.totalMeters)}</TableCell>                            
                        </TableRow>
                      ))}
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
                    <TableCell>Select</TableCell>
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
                  {visibleRowsCount === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.secondary">
                          No dispatchable rolls remaining for this sales order.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    fields.map((row, index) => {
                      if (!visibleLineIndices.has(index)) return null;
                      const soLineId = normalizeId(row.soLineId);
                      const max = remainingBySoLine[soLineId] ?? 0;
                      const selectedCount = selectedCountBySoLine[soLineId] ?? 0;
                      const isChecked = Boolean(row.selected);
                      const isDisabled =
                        !!selectedChallan ||
                        max === 0 ||
                        (!isChecked && selectedCount >= max);

                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Controller
                              name={`lines.${index}.selected`}
                              control={control}
                              render={({ field }) => (
                                <Checkbox
                                  checked={Boolean(field.value)}
                                  disabled={isDisabled}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                />
                              )}
                            />
                          </TableCell>
                          <TableCell>{resolveSkuCode(row)}</TableCell>
                          <TableCell>{row.rollNumber}</TableCell>
                          <TableCell>{resolveFromSku(row, "categoryName")}</TableCell>
                          <TableCell>{resolveFromSku(row, "gsm")}</TableCell>
                          <TableCell>{resolveFromSku(row, "qualityName")}</TableCell>
                          <TableCell>{formatInches(resolveFromSku(row, "widthInches"))}</TableCell>
                          <TableCell>{formatNumber(row.shippedLengthMeters)}</TableCell>
                          <TableCell>
                            <Controller
                              name={`lines.${index}.shippedStatus`}
                              control={control}
                              render={({ field }) => (
                                <Chip
                                  label={field.value}
                                  color={field.value === "Dispatched" ? "success" : "warning"}
                                  size="small"
                                />
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
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

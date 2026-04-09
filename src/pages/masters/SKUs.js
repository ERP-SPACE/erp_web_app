import React, { useState, useEffect } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import masterService from "../../services/masterService";
import { formatInches } from "../../utils/formatters";

const SKUs = () => {
  const { showNotification, setLoading } = useApp();
  const [skus, setSKUs] = useState([]);
  const [products, setProducts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const productOptions = products.map((product) => ({
    value: product._id,
    label: product.productCode,
  }));
  const widthOptions = [24, 36, 44, 63].map((width) => ({
    value: width,
    label: `${width}"`,
  }));

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      productId: "",
      widthInches: "",
      skuCode: "",
      skuAlias: "",
      taxRate: 18,
      active: true,
    },
  });

  const selectedProductId = watch("productId");
  const selectedWidth = watch("widthInches");

  useEffect(() => {
    fetchSKUs();
    fetchProducts();
  }, []);

  const fetchSKUs = async () => {
    setLoading(true);
    try {
      const response = await masterService.getSKUs();
      const list = response.skus || [];
      setSKUs(list);
    } catch (error) {
      showNotification("Failed to fetch SKUs", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await masterService.getProducts({ active: true });
      const list = response.products || [];

      const mapped = list.map((p) => {
        const categorySource = p.categoryId || p.category || null;
        const gsmSource = p.gsmId || p.gsm || null;
        const qualitySource = p.qualityId || p.quality || null;

        const categoryId =
          categorySource && typeof categorySource === "object"
            ? categorySource._id || ""
            : categorySource || "";

        const categoryName =
          categorySource && typeof categorySource === "object"
            ? categorySource.name || ""
            : "";

        const categoryCode =
          categorySource && typeof categorySource === "object"
            ? categorySource.code || ""
            : "";

        const gsmId =
          gsmSource && typeof gsmSource === "object" ? gsmSource._id || "" : "";
        const gsmName =
          gsmSource && typeof gsmSource === "object" && gsmSource.name
            ? gsmSource.name
            : "";

        const qualityId =
          qualitySource && typeof qualitySource === "object"
            ? qualitySource._id || ""
            : qualitySource || "";

        const qualityName =
          qualitySource && typeof qualitySource === "object"
            ? qualitySource.name || ""
            : "";

        return {
          ...p,
          categoryId,
          categoryName,
          categoryCode,
          gsmId,
          gsmName,
          qualityId,
          qualityName,
        };
      });

      setProducts(mapped);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  // Auto-generate skuCode/skuAlias to match backend format: WIDTH-PRODUCT_CODE
  useEffect(() => {
    const product = products.find((p) => p._id === selectedProductId);
    const productCode =
      typeof product?.productCode === "string"
        ? product.productCode.trim()
        : "";
    const width = selectedWidth;

    setValue(
      "skuCode",
      product && width && productCode ? `${width}-${productCode}` : ""
    );
  }, [products, selectedProductId, selectedWidth, setValue]);

  useEffect(() => {
    const product = products.find((p) => p._id === selectedProductId);
    const productAlias =
      typeof product?.productAlias === "string"
        ? product.productAlias.trim()
        : "";
    const width = selectedWidth;

    setValue(
      "skuAlias",
      product && width && productAlias ? `${width}-${productAlias}` : ""
    );
  }, [products, selectedProductId, selectedWidth, setValue]);

  const handleAdd = () => {
    setSelectedSKU(null);
    reset({
      productId: "",
      widthInches: "",
      skuCode: "",
      skuAlias: "",
      taxRate: 18,
      active: true,
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setSelectedSKU(row);
    reset({
      productId: row.productId._id || row.productId,
      widthInches: row.widthInches,
      skuCode: row.skuCode || "",
      skuAlias:
        row.skuAlias ||
        (row.widthInches &&
        row.productId &&
        typeof row.productId === "object" &&
        row.productId.productAlias
          ? `${row.widthInches}-${row.productId.productAlias}`
          : ""),
      taxRate: row.taxRate,
      active: row.active,
    });
    setOpenDialog(true);
  };

  const handleDelete = (row) => {
    setDeleteId(row._id);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await masterService.deleteSKU(deleteId);
      showNotification("SKU deleted successfully", "success");
      fetchSKUs();
    } catch (error) {
      showNotification("Failed to delete SKU", "error");
    }
    setOpenConfirm(false);
  };

  const onSubmit = async (data) => {
    try {
      if (selectedSKU) {
        await masterService.updateSKU(selectedSKU._id, data);
        showNotification("SKU updated successfully", "success");
      } else {
        await masterService.createSKU(data);
        showNotification("SKU created successfully", "success");
      }
      setOpenDialog(false);
      fetchSKUs();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    { field: "skuCode", headerName: "SKU Code" },
    {
      field: "skuAlias",
      headerName: "SKU Alias",
      valueGetter: (params) => {
        if (params.row.skuAlias) return params.row.skuAlias;
        const product = params.row.productId;
        if (!product || typeof product !== "object") return "";
        if (!product.productAlias || !params.row.widthInches) return "";
        return `${params.row.widthInches} ${product.productAlias}`;
      },
    },
    {
      field: "productCode",
      headerName: "Product Code",
      valueGetter: (params) => {
        const product = params.row.productId;
        if (!product || typeof product !== "object") return "";
        return product.productCode || "";
      },
    },
    {
      field: "widthInches",
      headerName: "Width (inches)",
      renderCell: (params) => formatInches(params.value),
    },
    { field: "taxRate", headerName: "Tax %" },
    {
      field: "active",
      headerName: "Status",
      renderCell: (params) => (params.value ? "Active" : "Inactive"),
    },
  ];

  const getSelectedProduct = () => {
    return products.find((p) => p._id === selectedProductId);
  };

  return (
    <Box>
      <DataTable
        title="SKUs"
        columns={columns}
        rows={skus}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{selectedSKU ? "Edit SKU" : "Add SKU"}</DialogTitle>
          <DialogContent>
            <Controller
              name="productId"
              control={control}
              rules={{ required: "Product is required" }}
              render={({ field }) => (
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    productOptions,
                    field.value,
                    field.onChange
                  )}
                  fullWidth
                  disabled={!!selectedSKU}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Product"
                      margin="normal"
                      error={!!errors.productId}
                      helperText={errors.productId?.message}
                    />
                  )}
                />
              )}
            />

            {selectedProductId && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Selected: {getSelectedProduct()?.categoryName} -
                {getSelectedProduct()?.gsm} GSM -
                {getSelectedProduct()?.qualityName}
              </Typography>
            )}

            <Controller
              name="widthInches"
              control={control}
              rules={{ required: "Width is required" }}
              render={({ field }) => (
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    widthOptions,
                    field.value,
                    field.onChange
                  )}
                  fullWidth
                  disabled={!!selectedSKU}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Width (inches)"
                      margin="normal"
                      error={!!errors.widthInches}
                      helperText={errors.widthInches?.message}
                    />
                  )}
                />
              )}
            />

            {selectedProductId && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, mb: 1 }}
              >
                Default Length:{" "}
                {getSelectedProduct()?.defaultLengthMeters || ""} meters
              </Typography>
            )}

            <Controller
              name="skuCode"
              control={control}
              rules={{ required: "SKU code is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="SKU Code"
                  margin="normal"
                  error={!!errors.skuCode}
                  helperText={errors.skuCode?.message}
                  disabled
                />
              )}
            />

            <Controller
              name="skuAlias"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="SKU Alias"
                  margin="normal"
                  helperText="Auto-generated from width + product alias"                  
                />
              )}
            />

            <Controller
              name="taxRate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Tax Rate (%)"
                  type="number"
                  margin="normal"
                  inputProps={{ min: 0, step: 1 }}
                  error={!!errors.taxRate}
                  helperText={errors.taxRate?.message}
                />
              )}
            />

            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} />}
                  label="Active"
                  sx={{ mt: 2 }}
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              {selectedSKU ? "Update" : "Add"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete SKU"
        message="Are you sure you want to delete this SKU?"
      />
    </Box>
  );
};

export default SKUs;

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
  Chip,
  Typography,
  Divider,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import DataTable from "../../components/common/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { buildSingleSelectAutocompleteProps } from "../../utils/autocomplete";
import { useApp } from "../../contexts/AppContext";
import masterService from "../../services/masterService";

const Categories = () => {
  const { showNotification, setLoading } = useApp();
  const [categories, setCategories] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const categoryNameOptions = [
    { value: "Sublimation", label: "Sublimation" },
    { value: "Butter", label: "Butter" },
  ];

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      code: "",
      hsnCode: "",
      defaultTaxRate: 18,
      active: true,
    },
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await masterService.getCategories();
      setCategories(response.data);
    } catch (error) {
      showNotification("Failed to fetch categories", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedCategory(null);
    reset({
      name: "",
      code: "",
      hsnCode: "",
      defaultTaxRate: 18,
      active: true,
    });
    setOpenDialog(true);
  };

  const handleEdit = (row) => {
    setSelectedCategory(row);
    reset({
      name: row.name,
      code: row.code,
      hsnCode: row.hsnCode,
      defaultTaxRate: row.defaultTaxRate ?? 18,
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
      await masterService.deleteCategory(deleteId);
      showNotification("Category deleted successfully", "success");
      fetchCategories();
    } catch (error) {
      showNotification("Failed to delete category", "error");
    }
    setOpenConfirm(false);
  };

  const onSubmit = async (data) => {
    try {
      if (selectedCategory) {
        await masterService.updateCategory(selectedCategory._id, data);
        showNotification("Category updated successfully", "success");
      } else {
        await masterService.createCategory(data);
        showNotification("Category created successfully", "success");
      }
      setOpenDialog(false);
      fetchCategories();
    } catch (error) {
      showNotification(error.message || "Operation failed", "error");
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Category Name",
      flex: 1,
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 600, color: "grey.900" }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "code",
      headerName: "Code",
      flex: 1,
      renderCell: (params) => (
        <Typography sx={{ color: "grey.700", fontFamily: "monospace" }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "hsnCode",
      headerName: "HSN Code",
      flex: 1,
      renderCell: (params) => (
        <Typography sx={{ color: "grey.700", fontFamily: "monospace" }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "defaultTaxRate",
      headerName: "Default Tax %",
      flex: 1,
    },
    {
      field: "active",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          size="small"
          sx={{
            backgroundColor: params.value ? "success.50" : "grey.100",
            color: params.value ? "success.main" : "grey.600",
            fontWeight: 600,
            fontSize: "0.75rem",
            height: 24,
          }}
        />
      ),
    },
  ];

  return (
    <Box>
      <DataTable
        title="Categories"
        columns={columns}
        rows={categories}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle component="div" sx={{ pb: 2 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: "grey.900" }}
            >
              {selectedCategory ? "Edit Category" : "Add New Category"}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.600", mt: 0.5 }}>
              {selectedCategory
                ? "Update the category details below"
                : "Fill in the details to create a new category"}
            </Typography>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3 }}>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Category name is required" }}
              render={({ field }) => (
                <Autocomplete
                  {...buildSingleSelectAutocompleteProps(
                    categoryNameOptions,
                    field.value,
                    (value) => {
                      field.onChange(value);
                      const mapping = { Sublimation: "SUB", Butter: "BTR" };
                      setValue("code", mapping[value] || "");
                    }
                  )}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "grey.50",
                      "&:hover": {
                        backgroundColor: "white",
                      },
                      "&.Mui-focused": {
                        backgroundColor: "white",
                      },
                    },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Category Name"
                      margin="normal"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              )}
            />
            <Controller
              name="code"
              control={control}
              rules={{ required: "Category code is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Category Code"
                  margin="normal"
                  error={!!errors.code}
                  helperText={errors.code?.message}
                  inputProps={{ style: { textTransform: "uppercase" } }}
                  disabled
                />
              )}
            />
            <Controller
              name="hsnCode"
              control={control}
              rules={{ required: "HSN code is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="HSN Code"
                  margin="normal"
                  error={!!errors.hsnCode}
                  helperText={errors.hsnCode?.message}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "grey.50",
                      fontFamily: "monospace",
                      "&:hover": {
                        backgroundColor: "white",
                      },
                      "&.Mui-focused": {
                        backgroundColor: "white",
                      },
                    },
                  }}
                />
              )}
            />
            <Controller
              name="defaultTaxRate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  fullWidth
                  label="Default Tax Rate (%)"
                  margin="normal"
                  inputProps={{ min: 0, max: 100, step: 1 }}
                />
              )}
            />
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2,
                backgroundColor: "grey.50",
                border: "1px solid",
                borderColor: "grey.200",
              }}
            >
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                        sx={{
                          "& .MuiSwitch-thumb": {
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ fontWeight: 500, color: "grey.900" }}>
                        Active Status
                      </Typography>
                    }
                  />
                )}
              />
              <Typography variant="caption" sx={{ color: "grey.600", ml: 5 }}>
                {selectedCategory
                  ? "Toggle to activate/deactivate this category"
                  : "Category will be active by default"}
              </Typography>
            </Box>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              sx={{
                color: "grey.700",
                "&:hover": {
                  backgroundColor: "grey.100",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                px: 3,
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
                },
              }}
            >
              {selectedCategory ? "Update Category" : "Add Category"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
      />
    </Box>
  );
};

export default Categories;

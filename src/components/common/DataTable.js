import React from "react";
import { DataGrid, GridToolbar, GridActionsCellItem } from "@mui/x-data-grid";
import {
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Stack,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import { processColumnsWithDynamicWidths } from "../../utils/tableUtils";

const DataTable = ({
  title,
  columns,
  rows,
  loading = false,
  pageSize = 20,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onRowClick,
  onSearch,
  searchPlaceholder = "Search...",
  showActions = true,
  customActions = [],
  hideAddButton = false,
}) => {
  const [searchText, setSearchText] = React.useState("");
  const [paginationModel, setPaginationModel] = React.useState({
    page: 0,
    pageSize: pageSize,
  });

  const handleSearch = (event) => {
    const value = event.target.value;
    setSearchText(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  // Process columns to add dynamic widths
  const processedColumns = React.useMemo(() => {
    return processColumnsWithDynamicWidths(columns, rows);
  }, [columns, rows]);

  const renderActionIcon = React.useCallback((icon, label) => {
    if (!label) return icon;
    return (
      <Tooltip title={label} arrow>
        <Box component="span" sx={{ display: "inline-flex" }}>
          {icon}
        </Box>
      </Tooltip>
    );
  }, []);

  const actionColumnWidth = React.useMemo(() => {
    const baseCount = (onView ? 1 : 0) + (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
    const total = baseCount + customActions.length;
    // Allocate ~48px per action icon and enforce a sensible minimum
    return Math.max(160, total * 48);
  }, [onView, onEdit, onDelete, customActions.length]);

  const actionColumns = showActions
    ? [
        {
          field: "actions",
          type: "actions",
          headerName: "Actions",
          minWidth: actionColumnWidth,
          width: actionColumnWidth,
          flex: 0, // Actions column should not flex
          disableDynamicWidth: true,
          getActions: (params) => {
            const actions = [];

            if (onView) {
              actions.push(
                <GridActionsCellItem
                  icon={renderActionIcon(<ViewIcon />, "View")}
                  label="View"
                  onClick={() => onView(params.row)}
                />
              );
            }

            if (onEdit) {
              actions.push(
                <GridActionsCellItem
                  icon={renderActionIcon(<EditIcon />, "Edit")}
                  label="Edit"
                  onClick={() => onEdit(params.row)}
                />
              );
            }

            if (onDelete) {
              actions.push(
                <GridActionsCellItem
                  icon={renderActionIcon(<DeleteIcon />, "Delete")}
                  label="Delete"
                  onClick={() => onDelete(params.row)}
                />
              );
            }

            customActions.forEach((action) => {
              if (typeof action.show === "function" && !action.show(params.row)) {
                return;
              }
              actions.push(
                <GridActionsCellItem
                  icon={renderActionIcon(action.icon, action.label)}
                  label={action.label}
                  onClick={() => action.onClick(params.row)}
                />
              );
            });

            return actions;
          },
        },
      ]
    : [];

  return (
    <Box sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "white",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 3 }}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "grey.400" }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: "100%", sm: 350 },
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
            />
          </Box>
          {!hideAddButton && onAdd && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAdd}
              sx={{
                px: 3,
                py: 1,
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
                },
              }}
            >
              Add New
            </Button>
          )}
        </Stack>

        <Box
          sx={{
            height: 600,
            width: "100%",
            "& .MuiDataGrid-root": {
              border: "none",
            },
            "& .MuiDataGrid-cell": {
              fontSize: "0.875rem",
              color: "grey.800",
            },
            "& .MuiDataGrid-columnHeaders": {
              fontSize: "0.8125rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            },
          }}
        >
          <DataGrid
            rows={rows || []}
            columns={[...processedColumns, ...actionColumns]}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 20, 50, 100]}
            disableRowSelectionOnClick
            onRowClick={onRowClick ? (params) => onRowClick(params.row) : undefined}
            slots={{
              toolbar: GridToolbar,
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: false,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
            getRowId={(row) => row._id || row.id}
            sx={{
              "& .MuiDataGrid-toolbarContainer": {
                p: 2,
                pb: 1,
                gap: 2,
              },
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default DataTable;

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import {
  Button, Input, IconButton, Typography, Spinner, DeleteConfirmDialog,
  DataTable, type DataTableColumn,
} from "@/components/ui";
import { Icon, PiPlus, PiTrash } from "@/lib/icons";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import axios from "axios";
import { hotToast as toast } from "@/lib/hotToast";

interface TaskType {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export const TaskTypesForm: React.FC = () => {
  const { invalidateAll } = useTaskDataInvalidation();

  const [types, setTypes] = useState<TaskType[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskType | null>(null);

  // Cargar types
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/types");
        setTypes(response.data);
      } catch (error) {
        console.error("Error loading types:", error);
        toast.error({ title: "Error loading task types", description: "Couldn't reach the server." });
      } finally {
        setLoading(false);
      }
    };
    fetchTypes();
  }, []);

  // Iniciar edición
  const startEditing = (type: TaskType) => {
    setEditingId(type.id);
    setEditingName(type.name);
  };

  // Cancelar edición
  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Guardar edición
  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      setSaving(true);
      await axios.patch(`/api/types/${editingId}`, {
        name: editingName.trim(),
      });

      // Actualizar localmente
      setTypes((prev) =>
        prev.map((type) =>
          type.id === editingId ? { ...type, name: editingName.trim() } : type
        )
      );

      setEditingId(null);
      setEditingName("");
      invalidateAll();
      toast.success({ title: "Task type updated successfully", description: "Changes saved." });
    } catch (error) {
      console.error("Error updating type:", error);
      toast.error({ title: "Error updating task type", description: "Changes were not saved." });
    } finally {
      setSaving(false);
    }
  };

  // Agregar nuevo type
  const addNewType = async () => {
    if (!newTypeName.trim()) return;

    try {
      setSaving(true);
      const response = await axios.post("/api/types", {
        name: newTypeName.trim(),
      });

      setTypes((prev) => [...prev, response.data]);
      setNewTypeName("");
      invalidateAll();
      toast.success({ title: "Task type created successfully", description: "Added to the list." });
    } catch (error: any) {
      console.error("Error creating type:", error);
      const errorMessage =
        error.response?.data?.error || "Error creating task type";
      toast.error({ title: "Couldn't create task type", description: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  // Eliminar type
  const deleteType = async (typeId: number, typeName: string) => {
    try {
      setDeleting(typeId);
      await axios.delete(`/api/types/${typeId}`);

      setTypes((prev) => prev.filter((type) => type.id !== typeId));
      invalidateAll();
      toast.success({ title: "Task type deleted successfully", description: "Removed from the list." });
    } catch (error: any) {
      console.error("Error deleting type:", error);
      const errorMessage =
        error.response?.data?.error || "Error deleting task type";
      toast.error({ title: "Couldn't delete task type", description: errorMessage });
    } finally {
      setDeleting(null);
    }
  };

  // Description copy reflects whether the type has dependent categories.
  const deleteDescription = (type: TaskType) => `Are you sure you want to delete the task type "${type.name}"? This action cannot be undone.`


  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editingId) {
        saveEdit();
      } else {
        addNewType();
      }
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  // Columnas del DataTable. La edición del nombre sigue siendo inline (click → input);
  // el DataTable aporta búsqueda, paginación y auto-hide por ancho del contenedor.
  const columns: DataTableColumn<TaskType>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (type) => type.name,
      skeleton: "text",
      cell: (type) =>
        editingId === type.id ? (
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={saveEdit}
            autoFocus
            size="sm"
            className="w-full max-w-xs"
          />
        ) : (
          <span
            onClick={() => startEditing(type)}
            className="cursor-pointer hover:text-primary-600 transition-colors"
            title="Click to edit"
          >
            {type.name}
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 72,
      skeleton: "actions",
      expandedBare: true,
      cell: (type) => (
        <div className="flex justify-end">
          <IconButton
            aria-label="Delete task type"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => setPendingDelete(type)}
            disabled={editingId === type.id || deleting === type.id}
          >
            {deleting === type.id ? <Spinner colorClassName="" /> : <Icon icon={PiTrash} size={16} />}
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <DataTable<TaskType>
          data={types}
          columns={columns}
          rowKey={(type) => type.id}
          loading={loading}
          emptyState="No task types yet. Add one below."
          searchPlaceholder="Search task types…"
        />

        {/* Add New Type */}
        <div>
          <Typography variant="label" as="label">Add New Task Type</Typography>
          <div className="flex gap-2 mt-1.5">
            <Input
              placeholder="Enter task type name..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={handleKeyPress}
              size="md"
              className="flex-1"
              disabled={loading || saving || editingId !== null}
            />
            <Button
              startIcon={<Icon icon={PiPlus} size={16} />}
              onClick={addNewType}
              disabled={
                loading || !newTypeName.trim() || saving || editingId !== null
              }
              loading={saving && !editingId}
              color="primary"
            >
              Add Type
            </Button>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteType(pendingDelete.id, pendingDelete.name);
          setPendingDelete(null);
        }}
        title="Delete Task Type"
        description={pendingDelete ? deleteDescription(pendingDelete) : undefined}
        confirmLabel="Delete Task Type"
      />
    </>
  );
};

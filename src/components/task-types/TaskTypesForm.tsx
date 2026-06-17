/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { Button, Input, IconButton, Typography, Spinner } from "@/components/ui";
import { Icon, PiPlus, PiTrash } from "@/lib/icons";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import axios from "axios";
import toast from "react-hot-toast";
import { TableTd, TableTh } from "@/components";
import { useConfirmationStore } from "@/stores/confirmationStore";

interface TaskType {
  id: number;
  name: string;
  description?: string;
  color?: string;
  categories: any[];
}

// Agregar este componente dentro del archivo, antes del componente principal:
const TaskTypeSkeleton: React.FC = () => (
  <tr className="border-t border-(--color-border-default) animate-pulse">
    <TableTd>
      <div className="h-3 bg-(--color-surface-hover) rounded w-32"></div>
    </TableTd>
    <TableTd>
      <div className="h-3 bg-(--color-surface-hover) rounded w-20"></div>
    </TableTd>
    <TableTd>
      <div className="size-8 bg-(--color-surface-hover) rounded"></div>
    </TableTd>
  </tr>
);

export const TaskTypesForm: React.FC = () => {
  const { invalidateAll } = useTaskDataInvalidation();

  const [types, setTypes] = useState<TaskType[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { openConfirmation } = useConfirmationStore();

  // Cargar types
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/types");
        setTypes(response.data);
      } catch (error) {
        console.error("Error loading types:", error);
        toast.error("Error loading task types");
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
      toast.success("Task type updated successfully");
    } catch (error) {
      console.error("Error updating type:", error);
      toast.error("Error updating task type");
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
      toast.success("Task type created successfully");
    } catch (error: any) {
      console.error("Error creating type:", error);
      const errorMessage =
        error.response?.data?.error || "Error creating task type";
      toast.error(errorMessage);
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
      toast.success("Task type deleted successfully");
    } catch (error: any) {
      console.error("Error deleting type:", error);
      const errorMessage =
        error.response?.data?.error || "Error deleting task type";
      toast.error(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  // Nueva función para confirmar eliminación:
  const confirmDelete = (type: TaskType) => {
    const categoriesCount = type.categories?.length || 0;
    const hasCategories = categoriesCount > 0;

    openConfirmation({
      title: "Delete Task Type",
      description: `Are you sure you want to delete the task type "${
        type.name
      }"?${
        hasCategories
          ? ` This will also delete ${categoriesCount} categories and may affect existing tasks.`
          : " This action cannot be undone."
      }`,
      type: "danger",
      confirmText: "Delete Task Type",
      cancelText: "Cancel",
      onConfirm: () => deleteType(type.id, type.name),
    });
  };

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

  return (
    <div className="p-8">
      {/* Existing Types Table */}
      {loading || types.length > 0 ? (
        <div className="mb-6">
          <div className="border border-(--color-border-default) rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-(--color-surface-hover)">
                <tr>
                  <TableTh>
                    <span>Name</span>
                  </TableTh>
                  <TableTh>
                    <span>Categories</span>
                  </TableTh>
                  <TableTh actions>
                    <span>Actions</span>
                  </TableTh>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    <TaskTypeSkeleton />
                    <TaskTypeSkeleton />
                  </>
                ) : (
                  // Datos reales
                  types.map((type) => (
                    <tr key={type.id} className="border-t border-(--color-border-default)">
                      <TableTd>
                        {editingId === type.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleKeyPress}
                            onBlur={saveEdit}
                            autoFocus
                            size="sm"
                            className="w-full"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(type)}
                            className="cursor-pointer hover:text-primary-600 transition-colors w-[10rem]"
                            title="Click to edit"
                          >
                            {type.name}
                          </span>
                        )}
                      </TableTd>
                      <TableTd>
                        <div>
                          <span className="text-sm text-(--color-text-muted)">
                            {type.categories?.length || 0} categories
                          </span>
                        </div>
                      </TableTd>
                      <TableTd>
                        <div>
                          <IconButton
                            aria-label="Delete task type"
                            size="sm"
                            color="error"
                            variant="soft"
                            onClick={() => confirmDelete(type)}
                            disabled={editingId === type.id || deleting === type.id}
                          >
                            {deleting === type.id ? (
                              <Spinner colorClassName="" />
                            ) : (
                              <Icon icon={PiTrash} size={16} />
                            )}
                          </IconButton>
                        </div>
                      </TableTd>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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

      {/* Instructions */}
      <div className="mt-6 pt-4 border-t border-(--color-border-default)">
        <p className="text-sm text-(--color-text-muted) text-center">
          Click on a task type name to edit it • Press Enter to save • Press
          Escape to cancel
        </p>
      </div>
    </div>
  );
};

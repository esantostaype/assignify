/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";
import { DeleteConfirmDialog, DataTable, type DataTableColumn } from "@/components/ui";
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

  const startEditing = (type: TaskType) => {
    setEditingId(type.id);
    setEditingName(type.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      setSaving(true);
      await axios.patch(`/api/types/${editingId}`, { name: editingName.trim() });
      setTypes((prev) => prev.map((type) => (type.id === editingId ? { ...type, name: editingName.trim() } : type)));
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

  const addNewType = async () => {
    if (!newTypeName.trim()) return;
    try {
      setSaving(true);
      const response = await axios.post("/api/types", { name: newTypeName.trim() });
      setTypes((prev) => [...prev, response.data]);
      setNewTypeName("");
      invalidateAll();
      toast.success({ title: "Task type created successfully", description: "Added to the list." });
    } catch (error: any) {
      console.error("Error creating type:", error);
      const errorMessage = error.response?.data?.error || "Error creating task type";
      toast.error({ title: "Couldn't create task type", description: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (typeId: number, _typeName: string) => {
    try {
      setDeleting(typeId);
      await axios.delete(`/api/types/${typeId}`);
      setTypes((prev) => prev.filter((type) => type.id !== typeId));
      invalidateAll();
      toast.success({ title: "Task type deleted successfully", description: "Removed from the list." });
    } catch (error: any) {
      console.error("Error deleting type:", error);
      const errorMessage = error.response?.data?.error || "Error deleting task type";
      toast.error({ title: "Couldn't delete task type", description: errorMessage });
    } finally {
      setDeleting(null);
    }
  };

  const deleteDescription = (type: TaskType) =>
    `Are you sure you want to delete the task type "${type.name}"? This action cannot be undone.`;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editingId) saveEdit();
      else addNewType();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  // Columnas del DataTable. La edición del nombre sigue siendo inline (click → input).
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
            className="h-8 w-full max-w-xs"
          />
        ) : (
          <span
            onClick={() => startEditing(type)}
            className="cursor-pointer transition-colors hover:text-primary"
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
          <Button
            aria-label="Delete task type"
            size="icon-sm"
            variant="soft"
            className="bg-destructive/15 text-destructive hover:bg-destructive/20"
            onClick={() => setPendingDelete(type)}
            disabled={editingId === type.id || deleting === type.id}
          >
            {deleting === type.id ? <Spinner /> : <HugeiconsIcon icon={Delete02Icon} size={16} />}
          </Button>
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
          showSearch={false}
          hidePageSizePicker
          skeletonRowCount={3}
          emptyState="No task types yet. Add one below."
        />

        {/* Add New Type */}
        <div>
          <label className="text-sm font-medium text-foreground">Add New Task Type</label>
          <div className="mt-1.5 flex gap-2">
            <Input
              placeholder="Enter task type name..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              disabled={loading || saving || editingId !== null}
            />
            <Button
              onClick={addNewType}
              disabled={loading || !newTypeName.trim() || saving || editingId !== null}
            >
              {saving && !editingId ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} size={16} />}
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

"use client";
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GridViewIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/shadcn/select";
import { TaskType } from "@/interfaces";

interface TaskTypeSelectProps {
  types: TaskType[];
  value: string | null;
  onChange: (value: string | null) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
}

// [SaaS] Tipos de tarea PROPIOS del workspace (cargados de /api/types).
export const TaskTypeSelect: React.FC<TaskTypeSelectProps> = ({
  types,
  value,
  onChange,
  touched,
  error,
  loading = false,
}) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
      <HugeiconsIcon icon={GridViewIcon} size={18} />
      Task Type
    </label>
    {/* value '' (no undefined) para que siga CONTROLADO al limpiar el formulario. */}
    <Select value={value ?? ""} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className={cn(touched && error && "ring-1 ring-destructive")}>
        <SelectValue placeholder={loading ? "Loading types..." : "Select a task type"} />
      </SelectTrigger>
      <SelectContent>
        {types.map((t) => (
          <SelectItem key={t.id} value={t.id.toString()}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

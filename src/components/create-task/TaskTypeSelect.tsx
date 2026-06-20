"use client";
import React from "react";
import { Select } from "@/components/ui";
import { Typography } from "@/components/ui/typography";
import { Icon, PiSquaresFour } from "@/lib/icons";
import { TaskType } from "@/interfaces";

interface TaskTypeSelectProps {
  types: TaskType[];
  value: string | null;
  onChange: (value: string | null) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
}

// [SaaS] Tipos de tarea PROPIOS del workspace (ya no el switch hardcodeado
// UX/UI|Graphic). Cada inquilino define los suyos: Digital/Traditional,
// FrontEnd/Backend, etc. Se cargan de /api/types (scopeado por workspace).
export const TaskTypeSelect: React.FC<TaskTypeSelectProps> = ({
  types,
  value,
  onChange,
  touched,
  error,
  loading = false,
}) => (
  <div>
    <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
      <Icon icon={PiSquaresFour} size={18} />
      Task Type
    </Typography>
    <Select
      placeholder={loading ? "Loading types..." : "Select a task type"}
      // '' (no undefined) para que el Select siga CONTROLADO al limpiar: con undefined
      // pasa a no-controlado y conserva el tipo viejo tras resetear el formulario.
      value={value ?? ''}
      onChange={(val) => onChange(val)}
      disabled={loading}
      error={touched && error ? error : undefined}
      options={types.map((t) => ({
        value: t.id.toString(),
        label: t.name,
        searchValue: t.name,
      }))}
    />
  </div>
);

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Skeleton,
  AlertDialog,
  DeleteConfirmDialog,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { Icon, PiPlus, PiTrash, PiDownloadSimple, PiUploadSimple } from "@/lib/icons";
import axios from "axios";
import { hotToast as toast } from "@/lib/hotToast";

interface HolidayRow {
  id: number;
  name: string;
  month: number;
  day: number;
  year: number | null; // null → recurrente cada año; con año → fecha única
}

type EditField = "name" | "month" | "day" | "year";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthName = (m: number) => MONTHS[m - 1] ?? String(m);

// Plantilla CSV de ejemplo. Columna Year vacía = recurrente (cada año).
const TEMPLATE_CSV = [
  "Name,Month,Day,Year",
  "New Year's Day,1,1,",
  "Memorial Day,5,26,2025",
  "Independence Day,7,4,",
  "Thanksgiving Day,11,27,2025",
  "Christmas Day,12,25,",
  "",
].join("\n");

export const HolidaysSettings: React.FC = () => {
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HolidayRow | null>(null);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ id: number; field: EditField } | null>(null);
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await axios.get<HolidayRow[]>("/api/holidays");
    setRows(res.data);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        console.error("Error loading holidays:", e);
        toast.error({ title: "Couldn't load holidays", description: "Please try again." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startEdit = (row: HolidayRow, field: EditField) => {
    setEditing({ id: row.id, field });
    setDraft(field === "year" ? (row.year == null ? "" : String(row.year)) : String(row[field]));
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  // Guarda la celda editada: PATCH la fila COMPLETA con el campo cambiado.
  // `raw` permite pasar el valor explícito (p. ej. el <select> de mes en su onChange,
  // sin esperar al re-render de `draft`).
  const commitEdit = async (row: HolidayRow, field: EditField, raw: string = draft) => {
    if (!editing) return;
    const next: HolidayRow = { ...row };
    if (field === "name") next.name = raw.trim();
    else if (field === "year") next.year = raw.trim() === "" ? null : Number(raw);
    else if (field === "month") next.month = Number(raw);
    else next.day = Number(raw);

    // Sin cambios → solo cerrar.
    if (
      next.name === row.name && next.month === row.month &&
      next.day === row.day && next.year === row.year
    ) {
      cancelEdit();
      return;
    }

    // Validación local (la API revalida igual).
    const bad =
      (field === "name" && !next.name && "Name can't be empty") ||
      (field === "month" && (!Number.isInteger(next.month) || next.month < 1 || next.month > 12) && "Month must be 1–12") ||
      (field === "day" && (!Number.isInteger(next.day) || next.day < 1 || next.day > 31) && "Day must be 1–31") ||
      (field === "year" && next.year != null && (!Number.isInteger(next.year) || next.year < 1970 || next.year > 2100) && "Year must be 1970–2100 or empty");
    if (bad) {
      toast.error({ title: "Invalid value", description: bad as string });
      cancelEdit();
      return;
    }

    // Optimista + cerrar; revertir si la API falla.
    setRows((prev) => prev.map((r) => (r.id === row.id ? next : r)));
    cancelEdit();
    try {
      await axios.patch(`/api/holidays/${row.id}`, {
        name: next.name, month: next.month, day: next.day, year: next.year,
      });
    } catch (e) {
      console.error("Error updating holiday:", e);
      toast.error({ title: "Couldn't save holiday", description: "Change reverted." });
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    }
  };

  const addRow = async () => {
    try {
      setAdding(true);
      const res = await axios.post<HolidayRow>("/api/holidays", {
        name: "New holiday", month: 1, day: 1, year: null,
      });
      setRows((prev) => [...prev, res.data]);
      // Editar el nombre de inmediato (queda seleccionado para sobrescribir).
      setEditing({ id: res.data.id, field: "name" });
      setDraft(res.data.name);
    } catch (e) {
      console.error("Error adding holiday:", e);
      toast.error({ title: "Couldn't add holiday", description: "Please try again." });
    } finally {
      setAdding(false);
    }
  };

  const deleteRow = async (row: HolidayRow) => {
    const prev = rows;
    setRows((p) => p.filter((r) => r.id !== row.id)); // optimista
    try {
      await axios.delete(`/api/holidays/${row.id}`);
    } catch (e) {
      console.error("Error deleting holiday:", e);
      toast.error({ title: "Couldn't delete holiday", description: "Restored." });
      setRows(prev);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingCsv(String(reader.result ?? ""));
    reader.onerror = () =>
      toast.error({ title: "Couldn't read file", description: "Try a different file." });
    reader.readAsText(file);
  };

  const doImport = async () => {
    const csv = pendingCsv;
    if (csv == null) return;
    try {
      setImporting(true);
      const res = await axios.post("/api/holidays/import", { csv, mode: "replace" });
      await load();
      const imported = res.data?.imported ?? 0;
      const skipped = res.data?.skipped ?? 0;
      toast.success({
        title: `Imported ${imported} holiday${imported === 1 ? "" : "s"}`,
        description: skipped ? `${skipped} row(s) skipped.` : "Replaced current holidays.",
      });
    } catch (e: any) {
      console.error("Error importing holidays:", e);
      toast.error({
        title: "Import failed",
        description: e?.response?.data?.error || "Check the file format and try again.",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holidays-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Input "que sigue pareciendo texto": transparente, sin borde, foco con subrayado tenue.
  const cellInputCls =
    "w-full bg-transparent px-0 py-0.5 text-sm text-(--color-text-strong) outline-none " +
    "border-b border-(--color-primary-500)";

  const renderCell = (row: HolidayRow, field: EditField) => {
    const isEditing = editing?.id === row.id && editing.field === field;

    if (isEditing && field === "month") {
      return (
        <select
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commitEdit(row, field, e.target.value);
          }}
          onBlur={() => commitEdit(row, field)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelEdit();
          }}
          className={cn(cellInputCls, "cursor-pointer")}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
      );
    }

    if (isEditing) {
      return (
        <input
          autoFocus
          value={draft}
          inputMode={field === "name" ? "text" : "numeric"}
          placeholder={field === "year" ? "Every year" : undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit(row, field)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(row, field);
            else if (e.key === "Escape") cancelEdit();
          }}
          className={cellInputCls}
        />
      );
    }

    let text: string;
    if (field === "name") text = row.name;
    else if (field === "month") text = monthName(row.month);
    else if (field === "day") text = String(row.day);
    else text = row.year == null ? "Every year" : String(row.year);

    return (
      <span
        onDoubleClick={() => startEdit(row, field)}
        title="Double-click to edit"
        className={cn(
          "-mx-1 block cursor-text rounded px-1 py-0.5 hover:bg-(--color-text-muted)/[0.06]",
          field === "year" && row.year == null && "text-(--color-text-muted)",
        )}
      >
        {text}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar: descripción + plantilla + importar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-(--color-text-muted)">
          Double-click a cell to edit.{" "}
          <span className="text-(--color-text-default)">Every year</span> repeats annually; set a year for a one-off date.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startIcon={<Icon icon={PiDownloadSimple} size={16} />}
            onClick={downloadTemplate}
          >
            Template
          </Button>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startIcon={<Icon icon={PiUploadSimple} size={16} />}
            onClick={() => fileInputRef.current?.click()}
            loading={importing}
          >
            Import CSV
          </Button>
        </div>
      </div>

      {/* Tabla editable (doble click en una celda → input) */}
      <div className="overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-surface-card)">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface-hover)">
            <tr>
              <th className="p-2 text-left font-medium text-(--color-text-muted) first:pl-4">Name</th>
              <th className="w-[8rem] p-2 text-left font-medium text-(--color-text-muted)">Month</th>
              <th className="w-[4.5rem] p-2 text-left font-medium text-(--color-text-muted)">Day</th>
              <th className="w-[8rem] p-2 text-left font-medium text-(--color-text-muted)">Repeats</th>
              <th className="w-[4rem] p-2 text-right font-medium text-(--color-text-muted) last:pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-t border-(--color-border-default)">
                  <td className="p-2 first:pl-4"><Skeleton variant="text" width={160} /></td>
                  <td className="p-2"><Skeleton variant="text" width={70} /></td>
                  <td className="p-2"><Skeleton variant="text" width={28} /></td>
                  <td className="p-2"><Skeleton variant="text" width={70} /></td>
                  <td className="p-2 last:pr-4"><Skeleton variant="rect" width={32} height={32} className="ml-auto" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr className="border-t border-(--color-border-default)">
                <td colSpan={5} className="p-6 text-center text-sm text-(--color-text-muted)">
                  No holidays yet. Add one or import a CSV.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-(--color-border-default)">
                  <td className="p-2 first:pl-4">{renderCell(row, "name")}</td>
                  <td className="p-2">{renderCell(row, "month")}</td>
                  <td className="p-2">{renderCell(row, "day")}</td>
                  <td className="p-2">{renderCell(row, "year")}</td>
                  <td className="p-2 last:pr-4">
                    <div className="flex justify-end">
                      <IconButton
                        aria-label={`Delete ${row.name}`}
                        size="sm"
                        color="error"
                        variant="soft"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Icon icon={PiTrash} size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Agregar fila */}
      <div>
        <Button
          variant="soft"
          color="primary"
          startIcon={<Icon icon={PiPlus} size={16} />}
          onClick={addRow}
          loading={adding}
          disabled={loading}
        >
          Add holiday
        </Button>
      </div>

      {/* Confirmar borrado */}
      <DeleteConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteRow(pendingDelete);
          setPendingDelete(null);
        }}
        title="Delete holiday"
        description={
          pendingDelete ? `Delete "${pendingDelete.name}"? This can't be undone.` : undefined
        }
        confirmLabel="Delete"
      />

      {/* Confirmar importación (reemplaza todo) */}
      <AlertDialog
        open={pendingCsv != null}
        onClose={() => setPendingCsv(null)}
        tone="warning"
        title="Replace holidays?"
        description="Importing replaces ALL current holidays with the file contents. This can't be undone."
        confirmLabel="Replace from file"
        cancelLabel="Cancel"
        onConfirm={doImport}
      />
    </div>
  );
};

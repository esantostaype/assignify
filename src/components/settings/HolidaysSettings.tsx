/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Input,
  Select,
  Skeleton,
  AlertDialog,
  DeleteConfirmDialog,
} from "@/components/ui";
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

// Fila en edición: los campos numéricos viven como STRING (lo que el <Input> necesita);
// se parsean a number/null solo al guardar. year "" = recurrente.
interface DraftRow {
  id: number;
  name: string;
  month: string;
  day: string;
  year: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

const toDraft = (h: HolidayRow): DraftRow => ({
  id: h.id,
  name: h.name,
  month: String(h.month),
  day: String(h.day),
  year: h.year == null ? "" : String(h.year),
});

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
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DraftRow | null>(null);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [focusNewId, setFocusNewId] = useState<number | null>(null);

  // Última versión CONFIRMADA por el servidor de cada fila → para detectar cambios
  // (no re-guardar si no cambió) y para revertir si la API falla.
  const savedRef = useRef<Map<number, DraftRow>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await axios.get<HolidayRow[]>("/api/holidays");
    const drafts = (res.data ?? []).map(toDraft);
    savedRef.current = new Map(drafts.map((d) => [d.id, d]));
    setRows(drafts);
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

  const setField = (id: number, key: keyof DraftRow, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  // Guarda la fila si cambió respecto a lo confirmado. `override` permite pasar el valor
  // nuevo del <Select> de mes sin esperar al re-render de `rows`.
  const commit = async (id: number, override?: Partial<DraftRow>) => {
    const base = rows.find((r) => r.id === id);
    if (!base) return;
    const draft: DraftRow = { ...base, ...override };
    const prev = savedRef.current.get(id);

    if (
      prev && prev.name === draft.name && prev.month === draft.month &&
      prev.day === draft.day && prev.year === draft.year
    ) {
      return; // sin cambios
    }

    const name = draft.name.trim();
    const month = Number(draft.month);
    const day = Number(draft.day);
    const year = draft.year.trim() === "" ? null : Number(draft.year);

    const msg =
      (!name && "Name can't be empty") ||
      ((!Number.isInteger(month) || month < 1 || month > 12) && "Month must be 1–12") ||
      ((!Number.isInteger(day) || day < 1 || day > 31) && "Day must be 1–31") ||
      (year != null && (!Number.isInteger(year) || year < 1970 || year > 2100) && "Year must be 1970–2100 or empty");
    if (msg) {
      toast.error({ title: "Invalid value", description: msg as string });
      if (prev) setRows((p) => p.map((r) => (r.id === id ? prev : r))); // revertir
      return;
    }

    // Normalizado (refleja trim + year vacío) en UI + como nuevo "guardado".
    const normalized: DraftRow = {
      id, name, month: String(month), day: String(day), year: year == null ? "" : String(year),
    };
    setRows((p) => p.map((r) => (r.id === id ? normalized : r)));
    savedRef.current.set(id, normalized);

    try {
      await axios.patch(`/api/holidays/${id}`, { name, month, day, year });
    } catch (e) {
      console.error("Error updating holiday:", e);
      toast.error({ title: "Couldn't save holiday", description: "Change reverted." });
      if (prev) {
        savedRef.current.set(id, prev);
        setRows((p) => p.map((r) => (r.id === id ? prev : r)));
      }
    }
  };

  const addRow = async () => {
    try {
      setAdding(true);
      const res = await axios.post<HolidayRow>("/api/holidays", {
        name: "New holiday", month: 1, day: 1, year: null,
      });
      const d = toDraft(res.data);
      savedRef.current.set(d.id, d);
      setRows((prev) => [...prev, d]);
      setFocusNewId(d.id); // enfoca + selecciona el nombre del nuevo
    } catch (e) {
      console.error("Error adding holiday:", e);
      toast.error({ title: "Couldn't add holiday", description: "Please try again." });
    } finally {
      setAdding(false);
    }
  };

  const deleteRow = async (row: DraftRow) => {
    const before = rows;
    const beforeSaved = savedRef.current.get(row.id);
    savedRef.current.delete(row.id);
    setRows((p) => p.filter((r) => r.id !== row.id)); // optimista
    try {
      await axios.delete(`/api/holidays/${row.id}`);
    } catch (e) {
      console.error("Error deleting holiday:", e);
      toast.error({ title: "Couldn't delete holiday", description: "Restored." });
      if (beforeSaved) savedRef.current.set(row.id, beforeSaved);
      setRows(before);
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

  // Enter en un <Input> dispara el blur (→ commit) y quita el foco.
  const onCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar: hint + plantilla + importar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-(--color-text-muted)">
          Leave <span className="text-(--color-text-default)">Year</span> empty to repeat every year, or set one for a single date.
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

      {/* Tabla editable: cada celda es un Input/Select (sm) de la librería */}
      <div className="overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-surface-card)">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface-hover)">
            <tr>
              <th className="p-2 text-left font-medium text-(--color-text-muted) first:pl-4">Name</th>
              <th className="w-[9rem] p-2 text-left font-medium text-(--color-text-muted)">Month</th>
              <th className="w-[5.5rem] p-2 text-left font-medium text-(--color-text-muted)">Day</th>
              <th className="w-[8rem] p-2 text-left font-medium text-(--color-text-muted)">Year</th>
              <th className="w-[3.5rem] p-2 text-right font-medium text-(--color-text-muted) last:pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-t border-(--color-border-default)">
                  <td className="p-1.5 first:pl-4"><Skeleton variant="rect" height={32} /></td>
                  <td className="p-1.5"><Skeleton variant="rect" height={32} /></td>
                  <td className="p-1.5"><Skeleton variant="rect" height={32} /></td>
                  <td className="p-1.5"><Skeleton variant="rect" height={32} /></td>
                  <td className="p-1.5 last:pr-4"><Skeleton variant="rect" width={32} height={32} className="ml-auto" /></td>
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
                  <td className="p-1.5 align-middle first:pl-4">
                    <Input
                      size="sm"
                      value={row.name}
                      autoFocus={row.id === focusNewId}
                      onFocus={(e) => {
                        if (row.id === focusNewId) {
                          e.currentTarget.select();
                          setFocusNewId(null);
                        }
                      }}
                      onChange={(e) => setField(row.id, "name", e.target.value)}
                      onBlur={() => commit(row.id)}
                      onKeyDown={onCellKeyDown}
                    />
                  </td>
                  <td className="p-1.5 align-middle">
                    <Select
                      size="sm"
                      value={row.month}
                      onChange={(val) => {
                        setField(row.id, "month", val);
                        commit(row.id, { month: val });
                      }}
                      options={MONTH_OPTIONS}
                    />
                  </td>
                  <td className="p-1.5 align-middle">
                    <Input
                      size="sm"
                      value={row.day}
                      inputMode="numeric"
                      onChange={(e) => setField(row.id, "day", e.target.value)}
                      onBlur={() => commit(row.id)}
                      onKeyDown={onCellKeyDown}
                    />
                  </td>
                  <td className="p-1.5 align-middle">
                    <Input
                      size="sm"
                      value={row.year}
                      inputMode="numeric"
                      placeholder="Every year"
                      onChange={(e) => setField(row.id, "year", e.target.value)}
                      onBlur={() => commit(row.id)}
                      onKeyDown={onCellKeyDown}
                    />
                  </td>
                  <td className="p-1.5 align-middle last:pr-4">
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

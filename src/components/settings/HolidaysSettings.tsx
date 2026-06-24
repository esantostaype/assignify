/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Input,
  Select,
  Switch,
  DataTable,
  AlertDialog,
  DeleteConfirmDialog,
  type DataTableColumn,
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

const CURRENT_YEAR = new Date().getFullYear();
// Años disponibles para fechas únicas: un par atrás y varios adelante.
const YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => CURRENT_YEAR - 2 + i).map((y) => ({
  value: String(y),
  label: String(y),
}));

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
  // nuevo de un control (Select/Switch) sin esperar al re-render de `rows`.
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

  // Repeats ON = recurrente (year vacío); OFF = fecha única (año actual por defecto).
  const setRepeats = (row: DraftRow, recurring: boolean) => {
    const year = recurring ? "" : row.year || String(CURRENT_YEAR);
    setField(row.id, "year", year);
    commit(row.id, { year });
  };
  const setYear = (row: DraftRow, val: string) => {
    setField(row.id, "year", val);
    commit(row.id, { year: val });
  };

  const addRow = async () => {
    try {
      setAdding(true);
      const res = await axios.post<HolidayRow>("/api/holidays", {
        name: "New holiday", month: 1, day: 1, year: null,
      });
      const d = toDraft(res.data);
      savedRef.current.set(d.id, d);
      setRows((prev) => [d, ...prev]); // arriba → visible en la primera página
      setFocusNewId(d.id);
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

  // Columnas del DataTable: cada celda es un Input/Select/Switch (sm) de la librería.
  // El auto-hide por ancho del contenedor, la paginación y la búsqueda vienen del DataTable.
  const columns: DataTableColumn<DraftRow>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (r) => r.name,
      width: 220,
      skeleton: "text",
      cell: (r) => (
        <Input
          size="sm"
          value={r.name}
          autoFocus={r.id === focusNewId}
          onFocus={(e) => {
            if (r.id === focusNewId) {
              e.currentTarget.select();
              setFocusNewId(null);
            }
          }}
          onChange={(e) => setField(r.id, "name", e.target.value)}
          onBlur={() => commit(r.id)}
          onKeyDown={onCellKeyDown}
        />
      ),
    },
    {
      key: "month",
      header: "Month",
      width: 150,
      accessor: (r) => MONTHS[Number(r.month) - 1] ?? r.month,
      skeleton: "text",
      cell: (r) => (
        <Select
          size="sm"
          value={r.month}
          onChange={(val) => {
            setField(r.id, "month", val);
            commit(r.id, { month: val });
          }}
          options={MONTH_OPTIONS}
        />
      ),
    },
    {
      key: "day",
      header: "Day",
      width: 84, // pequeño
      accessor: (r) => r.day,
      skeleton: "text",
      cell: (r) => (
        <Input
          size="sm"
          value={r.day}
          inputMode="numeric"
          onChange={(e) => setField(r.id, "day", e.target.value)}
          onBlur={() => commit(r.id)}
          onKeyDown={onCellKeyDown}
        />
      ),
    },
    {
      key: "repeats",
      header: "Repeats",
      width: 172,
      accessor: (r) => (r.year === "" ? "Every year" : r.year),
      skeleton: "chip",
      expandedInteractive: true,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={r.year === ""}
            onChange={(e) => setRepeats(r, e.target.checked)}
            aria-label="Repeats every year"
          />
          {r.year === "" ? (
            <span className="text-xs text-(--color-text-muted)">Every year</span>
          ) : (
            <div className="w-[84px]">
              <Select size="sm" value={r.year} onChange={(val) => setYear(r, val)} options={YEAR_OPTIONS} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 64,
      skeleton: "actions",
      expandedBare: true,
      cell: (r) => (
        <div className="flex justify-end">
          <IconButton
            aria-label={`Delete ${r.name}`}
            size="sm"
            color="error"
            variant="soft"
            onClick={() => setPendingDelete(r)}
          >
            <Icon icon={PiTrash} size={16} />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable<DraftRow>
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        pageSize={10}
        searchPlaceholder="Search holidays…"
        emptyState="No holidays yet. Add one or import a CSV."
        toolbar={
          <>
            <Button
              size="sm"
              variant="soft"
              color="primary"
              startIcon={<Icon icon={PiPlus} size={16} />}
              onClick={addRow}
              loading={adding}
              disabled={loading}
            >
              Add holiday
            </Button>
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onPickFile}
              className="hidden"
            />
          </>
        }
      />

      <p className="text-sm text-(--color-text-muted)">
        Toggle <span className="text-(--color-text-default)">Repeats</span> off to pin a holiday to a single year; leave it on to repeat every year.
      </p>

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

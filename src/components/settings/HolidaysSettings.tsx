/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Select,
  Switch,
  DataTable,
  actionsColumn,
  Modal,
  FormField,
  AlertDialog,
  DeleteConfirmDialog,
  type DataTableColumn,
} from "@/components/ui";
import { Icon, PiPlus, PiDownloadSimple, PiUploadSimple } from "@/lib/icons";
import axios from "axios";
import { hotToast as toast } from "@/lib/hotToast";

interface HolidayRow {
  id: number;
  name: string;
  month: number;
  day: number;
  year: number | null; // null → recurrente cada año; con año → fecha única
}

// Estado del formulario del modal (campos como string; se parsean al guardar).
// id null = crear; id set = editar. year "" = recurrente.
interface FormState {
  id: number | null;
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
const monthName = (m: number) => MONTHS[m - 1] ?? String(m);

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => CURRENT_YEAR - 2 + i).map((y) => ({
  value: String(y),
  label: String(y),
}));

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
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HolidayRow | null>(null);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);

  // Modal de crear/editar.
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await axios.get<HolidayRow[]>("/api/holidays");
    setRows(res.data ?? []);
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

  const openCreate = () =>
    setForm({ id: null, name: "", month: "1", day: "1", year: "" });
  const openEdit = (r: HolidayRow) =>
    setForm({
      id: r.id,
      name: r.name,
      month: String(r.month),
      day: String(r.day),
      year: r.year == null ? "" : String(r.year),
    });
  const closeModal = () => setForm(null);

  const saveForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    const month = Number(form.month);
    const day = Number(form.day);
    const year = form.year.trim() === "" ? null : Number(form.year);

    const msg =
      (!name && "Name is required") ||
      ((!Number.isInteger(day) || day < 1 || day > 31) && "Day must be between 1 and 31") ||
      (year != null && (!Number.isInteger(year) || year < 1970 || year > 2100) && "Year must be 1970–2100 or empty");
    if (msg) {
      toast.error({ title: "Invalid value", description: msg as string });
      return;
    }

    try {
      setSaving(true);
      if (form.id == null) {
        const res = await axios.post<HolidayRow>("/api/holidays", { name, month, day, year });
        setRows((prev) => [res.data, ...prev]);
      } else {
        const res = await axios.patch<HolidayRow>(`/api/holidays/${form.id}`, { name, month, day, year });
        const id = form.id;
        setRows((prev) => prev.map((r) => (r.id === id ? res.data : r)));
      }
      setForm(null);
    } catch (e: any) {
      console.error("Error saving holiday:", e);
      toast.error({
        title: "Couldn't save holiday",
        description: e?.response?.data?.error || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: HolidayRow) => {
    const before = rows;
    setRows((p) => p.filter((r) => r.id !== row.id)); // optimista
    try {
      await axios.delete(`/api/holidays/${row.id}`);
    } catch (e) {
      console.error("Error deleting holiday:", e);
      toast.error({ title: "Couldn't delete holiday", description: "Restored." });
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

  // Tabla de SOLO LECTURA con scroll horizontal; la columna de acciones (Edit/Delete)
  // queda fija a la derecha. La edición ocurre en el modal, no en la celda.
  const columns: DataTableColumn<HolidayRow>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (r) => r.name,
      width: 240,
      skeleton: "text",
      cell: (r) => <span className="font-medium text-(--color-text-strong)">{r.name}</span>,
    },
    {
      key: "month",
      header: "Month",
      accessor: (r) => monthName(r.month),
      width: 140,
      skeleton: "text",
      cell: (r) => monthName(r.month),
    },
    {
      key: "day",
      header: "Day",
      accessor: (r) => r.day,
      width: 80,
      skeleton: "text",
      cell: (r) => r.day,
    },
    {
      key: "repeats",
      header: "Repeats",
      accessor: (r) => (r.year == null ? "Every year" : r.year),
      width: 130,
      skeleton: "chip",
      cell: (r) =>
        r.year == null ? (
          <span className="text-(--color-text-muted)">Every year</span>
        ) : (
          String(r.year)
        ),
    },
    {
      ...actionsColumn<HolidayRow>({
        onEdit: (r) => openEdit(r),
        onDelete: (r) => setPendingDelete(r),
      }),
      pin: "right",
      width: 188,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable<HolidayRow>
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={loading}
        overflow="scroll"
        pageSize={10}
        searchPlaceholder="Search holidays…"
        emptyState="No holidays yet. Add one or import a CSV."
        toolbarBottom={
          <>
            <Button
              size="sm"
              variant="soft"
              color="primary"
              startIcon={<Icon icon={PiPlus} size={16} />}
              onClick={openCreate}
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

      {/* Modal crear / editar */}
      <Modal
        open={!!form}
        onClose={closeModal}
        size="sm"
        title={form?.id == null ? "Add holiday" : "Edit holiday"}
        footer={
          <>
            <Button variant="soft" color="neutral" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveForm} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {form && (
          <div className="flex flex-col gap-4">
            <FormField label="Name">
              <Input
                size="md"
                value={form.name}
                autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveForm();
                }}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Month">
                <Select
                  size="md"
                  value={form.month}
                  onChange={(val) => setForm({ ...form, month: val })}
                  options={MONTH_OPTIONS}
                />
              </FormField>
              <FormField label="Day">
                <Input
                  size="md"
                  value={form.day}
                  inputMode="numeric"
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveForm();
                  }}
                />
              </FormField>
            </div>

            <FormField label="Repeats" helper="On = every year. Off = a single date.">
              <div className="flex items-center gap-3">
                <Switch
                  size="sm"
                  checked={form.year === ""}
                  onChange={(e) =>
                    setForm({ ...form, year: e.target.checked ? "" : String(CURRENT_YEAR) })
                  }
                  aria-label="Repeats every year"
                />
                {form.year === "" ? (
                  <span className="text-sm text-(--color-text-muted)">Every year</span>
                ) : (
                  <div className="w-32">
                    <Select
                      size="md"
                      value={form.year}
                      onChange={(val) => setForm({ ...form, year: val })}
                      options={YEAR_OPTIONS}
                    />
                  </div>
                )}
              </div>
            </FormField>
          </div>
        )}
      </Modal>

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

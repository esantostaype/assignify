/* eslint-disable react/no-unescaped-entities */
"use client";
import React, { useState, useEffect } from "react";
import { Button, Input, Alert, Select, DataTable, type DataTableColumn } from "@/components/ui";
import { Icon, PiDownloadSimple, PiWarning } from "@/lib/icons";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import { daysToUnit, unitToDays, DURATION_UNITS, type DurationUnit } from "@/utils/duration-utils";
import axios from "axios";
import { hotToast as toast } from "@/lib/hotToast";

interface TierData {
  id: number;
  name: string;
  // Duración en DÍAS BASE (lo que guarda el motor); se muestra/edita en `unit`.
  duration: number;
}

const UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "hours", label: "Hours" },
  { value: "minutes", label: "Minutes" },
];

// Redondea el valor mostrado en la unidad (evita 29.999…).
const toUnit = (days: number, unit: DurationUnit) => Math.round(daysToUnit(days, unit) * 100) / 100;

export const TierListForm: React.FC = () => {
  const { invalidateTiers } = useTaskDataInvalidation();

  const [tiers, setTiers] = useState<TierData[]>([]);
  const [unit, setUnit] = useState<DurationUnit>("days");
  // Cambios pendientes, EN LA UNIDAD activa (lo que el usuario teclea).
  const [tierChanges, setTierChanges] = useState<Record<number, number>>({});
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [savingTiers, setSavingTiers] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);

  const loadTiers = async () => {
    const { data } = await axios.get("/api/tiers");
    setTiers(data.tiers ?? []);
    setUnit((data.durationUnit as DurationUnit) ?? "days");
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingTiers(true);
        await loadTiers();
      } catch (error) {
        console.error("Error loading tiers:", error);
        toast.error({ title: "Error loading tier settings", description: "Couldn't reach the server." });
      } finally {
        setLoadingTiers(false);
      }
    })();
  }, []);

  // Cambiar la unidad: persiste de inmediato y re-muestra los valores en ella.
  // (Descarta ediciones de duración sin guardar: primero se elige la unidad, luego se ajusta.)
  const handleUnitChange = async (newUnit: DurationUnit) => {
    if (newUnit === unit) return;
    try {
      setSavingUnit(true);
      await axios.patch("/api/tiers", { durationUnit: newUnit });
      setTierChanges({});
      await loadTiers();
      invalidateTiers(); // el form de crear tarea lee la unidad desde aquí
    } catch (error) {
      console.error("Error updating unit:", error);
      toast.error({ title: "Couldn't change the unit", description: "Please try again." });
    } finally {
      setSavingUnit(false);
    }
  };

  const handleTierDurationChange = (tierId: number, newValueInUnit: number) => {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) return;
    const currentInUnit = toUnit(tier.duration, unit);
    if (currentInUnit === newValueInUnit) {
      const next = { ...tierChanges };
      delete next[tierId];
      setTierChanges(next);
    } else {
      setTierChanges((prev) => ({ ...prev, [tierId]: newValueInUnit }));
    }
  };

  const hasChanges = Object.keys(tierChanges).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    try {
      setSavingTiers(true);
      // Convertir cada cambio (en la unidad) a DÍAS BASE antes de guardar.
      await Promise.all(
        Object.entries(tierChanges).map(([tierId, valueInUnit]) =>
          axios.patch(`/api/tiers/${tierId}`, { duration: unitToDays(valueInUnit, unit) })
        )
      );
      await loadTiers();
      setTierChanges({});
      invalidateTiers();
      toast.success({ title: "Tier durations updated", description: "Changes saved." });
    } catch (error) {
      console.error("Error saving:", error);
      toast.error({ title: "Error saving tier durations", description: "Changes were not saved." });
    } finally {
      setSavingTiers(false);
    }
  };

  // Cada tier es una FILA (Tier · Duration). El DataTable aporta auto-hide por ancho
  // del contenedor; la edición de la duración persiste al pulsar Save.
  const columns: DataTableColumn<TierData>[] = [
    {
      key: "name",
      header: "Tier",
      accessor: (t) => t.name,
      skeleton: "text",
      cell: (t) => (
        <span className="font-medium text-(--color-text-strong)">
          Tier {t.name}
          {tierChanges[t.id] !== undefined && (
            <span
              className="ml-2 inline-block h-2 w-2 rounded-full bg-warning-500 align-middle"
              title="Changed"
            />
          )}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      width: 220,
      skeleton: "text",
      cell: (t) => {
        const hasChanged = tierChanges[t.id] !== undefined;
        const currentValue = tierChanges[t.id] ?? toUnit(t.duration, unit);
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={currentValue.toString()}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) handleTierDurationChange(t.id, value);
              }}
              min={unit === "minutes" ? 1 : 0.1}
              step={unit === "days" ? 0.1 : 1}
              size="sm"
              className={`w-24 [&_input]:text-center${hasChanged ? " border-warning-500" : ""}`}
            />
            <span className="text-xs text-(--color-text-muted)">{unit}</span>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-(--color-text-muted)">
          Set how long each tier takes. Pick the unit your team works in.
        </p>
        <div className="w-40 shrink-0">
          <Select
            size="sm"
            value={unit}
            onChange={(val) => handleUnitChange(val as DurationUnit)}
            disabled={loadingTiers || savingUnit}
            options={UNIT_OPTIONS.filter((o) => DURATION_UNITS.includes(o.value))}
          />
        </div>
      </div>

      {!loadingTiers && hasChanges && (
        <Alert tone="warning" variant="soft" icon={null} className="mb-4">
          <div className="flex items-center gap-2">
            <Icon icon={PiWarning} size={16} />
            <span className="text-sm">You have unsaved changes. Don't forget to save your settings.</span>
          </div>
        </Alert>
      )}

      <DataTable<TierData>
        data={tiers}
        columns={columns}
        rowKey={(t) => t.id}
        loading={loadingTiers}
        skeletonRowCount={4}
        showSearch={false}
        hidePageSizePicker
        emptyState="No tiers configured"
      />

      <div className="flex items-center justify-end mt-4">
        <Button
          startIcon={<Icon icon={PiDownloadSimple} size={16} />}
          onClick={handleSave}
          disabled={loadingTiers || !hasChanges}
          loading={savingTiers}
          color={hasChanges ? "warning" : "primary"}
        >
          {loadingTiers ? "Loading..." : hasChanges ? "Save Changes" : "No Changes"}
        </Button>
      </div>
    </>
  );
};

/* eslint-disable react/no-unescaped-entities */
"use client";
import React, { useState, useEffect } from "react";
import { Button, Input, Alert, Select } from "@/components/ui";
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

const TierSkeleton: React.FC = () => {
  const skeletonColumns = Array.from({ length: 6 }, (_, index) => (
    <th key={index} className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">
      <div className="flex items-center gap-2 justify-center animate-pulse">
        <div className="h-4 bg-(--color-surface-hover) rounded w-16"></div>
      </div>
    </th>
  ));
  const skeletonInputs = Array.from({ length: 6 }, (_, index) => (
    <td key={index} className="p-2 first:pl-4 last:pr-4">
      <div className="pt-2 w-full flex justify-center animate-pulse">
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 bg-(--color-surface-hover) rounded w-24"></div>
          <div className="h-3 bg-(--color-surface-hover) rounded w-8"></div>
        </div>
      </div>
    </td>
  ));
  return (
    <>
      <thead className="bg-(--color-surface-hover)"><tr>{skeletonColumns}</tr></thead>
      <tbody><tr>{skeletonInputs}</tr></tbody>
    </>
  );
};

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

      <div className="border border-(--color-border-default) rounded-lg overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          {loadingTiers ? (
            <TierSkeleton />
          ) : (
            <>
              <thead className="bg-(--color-surface-hover)">
                <tr>
                  {tiers.map((tier) => {
                    const hasChanged = tierChanges[tier.id] !== undefined;
                    return (
                      <th key={tier.id} className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">
                        <div className="flex items-center gap-2 justify-center">
                          <span>Tier {tier.name}</span>
                          {hasChanged && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Changed" />}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {tiers.map((tier) => {
                    const hasChanged = tierChanges[tier.id] !== undefined;
                    const currentValue = tierChanges[tier.id] ?? toUnit(tier.duration, unit);
                    return (
                      <td key={tier.id} className="p-2 first:pl-4 last:pr-4">
                        <div className="pt-2 w-full flex justify-center">
                          <div className="flex flex-col items-center gap-1">
                            <Input
                              type="number"
                              value={currentValue.toString()}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) handleTierDurationChange(tier.id, value);
                              }}
                              min={unit === "minutes" ? 1 : 0.1}
                              step={unit === "days" ? 0.1 : 1}
                              size="md"
                              className={`w-24 [&_input]:text-center${hasChanged ? " border-warning-500" : ""}`}
                            />
                            <span className="text-xs text-(--color-text-muted)">{unit}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </>
          )}
        </table>
      </div>
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

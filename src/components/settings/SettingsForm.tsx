/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
"use client";
import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Switch,
  IconButton,
  Progress,
  Alert,
  Spinner,
  AlertDialog,
  Select,
  Card,
  FormField,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  Icon,
  PiGear,
  PiDownloadSimple,
  PiWarning,
  PiArrowsClockwise,
} from "@/lib/icons";
import {
  useSettings,
  useUpdateSettings,
  useResetSettings,
} from "@/hooks/useSettings";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import { daysToUnit, unitToDays, DURATION_UNITS, type DurationUnit } from "@/utils/duration-utils";
import axios from "axios";
import { hotToast as toast } from "@/lib/hotToast";

interface SettingValue {
  category: string;
  key: string;
  value: any;
  hasChanged: boolean;
}

interface TierData {
  id: number;
  name: string;
  duration: number;
  categoryCount: number;
}

// Grupos permitidos
const ALLOWED_GROUPS = ["work_schedule", "task_assignment", "approvals"];

export const SettingsForm: React.FC = () => {
  const { data: settingsData, isLoading, error, refetch } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const resetSettingsMutation = useResetSettings();

  // Hook to invalidate task data cache
  const { invalidateTiers, invalidateAll } = useTaskDataInvalidation();

  const [settingValues, setSettingValues] = useState<
    Record<string, SettingValue>
  >({});
  const [hasChanges, setHasChanges] = useState(false);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [tierChanges, setTierChanges] = useState<Record<number, number>>({});
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [savingTiers, setSavingTiers] = useState(false);
  const [unit, setUnit] = useState<DurationUnit>("days");
  const [savingUnit, setSavingUnit] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  // Pestaña activa: 3 grupos de settings + "tiers".
  const [activeTab, setActiveTab] = useState<string>("work_schedule");

  // Duración (días base) → valor mostrado en la unidad activa (redondeado).
  const toUnit = (days: number) => Math.round(daysToUnit(days, unit) * 100) / 100;

  // Cargar tiers + la unidad de duración del workspace.
  const loadTiers = async () => {
    const response = await axios.get("/api/tiers");
    setTiers(response.data.tiers ?? []);
    setUnit((response.data.durationUnit as DurationUnit) ?? "days");
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingTiers(true);
        await loadTiers();
      } catch (error) {
        console.error("Error loading tiers:", error);
        toast.error({
          title: "Couldn't load tiers",
          description: "Tier durations failed to load.",
        });
      } finally {
        setLoadingTiers(false);
      }
    })();
  }, []);

  // Cambiar la unidad: persiste de inmediato y re-muestra los valores en ella.
  // (Descarta ediciones de duración sin guardar: primero se elige la unidad.)
  const handleUnitChange = async (newUnit: DurationUnit) => {
    if (newUnit === unit) return;
    try {
      setSavingUnit(true);
      await axios.patch("/api/tiers", { durationUnit: newUnit });
      setTierChanges({});
      await loadTiers();
      setHasChanges(Object.values(settingValues).some((s) => s.hasChanged));
      invalidateTiers();
    } catch (error) {
      console.error("Error updating unit:", error);
      toast.error({ title: "Couldn't change the unit", description: "Please try again." });
    } finally {
      setSavingUnit(false);
    }
  };

  // Initialize setting values when data loads
  useEffect(() => {
    if (settingsData?.settings) {
      const initialValues: Record<string, SettingValue> = {};

      Object.entries(settingsData.settings).forEach(([groupName, settings]) => {
        // Solo procesar grupos permitidos
        if (ALLOWED_GROUPS.includes(groupName)) {
          settings.forEach((setting) => {
            const key = `${setting.category}.${setting.key}`;
            initialValues[key] = {
              category: setting.category,
              key: setting.key,
              value: setting.value,
              hasChanged: false,
            };
          });
        }
      });

      setSettingValues(initialValues);
      setHasChanges(false);
    }
  }, [settingsData]);

  // Handle input changes
  const handleSettingChange = (
    category: string,
    key: string,
    newValue: any
  ) => {
    const settingKey = `${category}.${key}`;
    const originalSetting =
      settingsData?.settings &&
      Object.values(settingsData.settings)
        .flat()
        .find((s) => s.category === category && s.key === key);

    const hasChanged = originalSetting
      ? originalSetting.value !== newValue
      : false;

    setSettingValues((prev) => ({
      ...prev,
      [settingKey]: {
        category,
        key,
        value: newValue,
        hasChanged,
      },
    }));

    updateHasChanges(settingValues, settingKey, hasChanged, tierChanges);
  };

  // Handle tier duration changes
  const handleTierDurationChange = (tierId: number, newDuration: number) => {
    const originalTier = tiers.find((t) => t.id === tierId);
    if (!originalTier) return;

    if (toUnit(originalTier.duration) === newDuration) {
      // Si vuelve al valor original, remover del registro de cambios
      const newTierChanges = { ...tierChanges };
      delete newTierChanges[tierId];
      setTierChanges(newTierChanges);
      updateHasChanges(settingValues, null, false, newTierChanges);
    } else {
      setTierChanges((prev) => ({ ...prev, [tierId]: newDuration }));
      updateHasChanges(settingValues, null, false, { ...tierChanges, [tierId]: newDuration });
    }
  };

  // Check if any setting has changed
  const updateHasChanges = (
    settings: Record<string, SettingValue>,
    updatedKey: string | null,
    keyHasChanged: boolean,
    currentTierChanges: Record<number, number>
  ) => {
    const settingsChanged = Object.values(settings).some(
      (setting) =>
        setting.hasChanged ||
        (updatedKey === `${setting.category}.${setting.key}` && keyHasChanged)
    );
    const tiersChanged = Object.keys(currentTierChanges).length > 0;

    setHasChanges(settingsChanged || tiersChanged);
  };

  // Handle form submission
  const handleSave = async () => {
    try {
      // Guardar cambios en settings
      const changedSettings = Object.values(settingValues)
        .filter((setting) => setting.hasChanged)
        .map((setting) => ({
          category: setting.category,
          key: setting.key,
          value: setting.value,
        }));

      if (changedSettings.length > 0) {
        await updateSettingsMutation.mutateAsync(changedSettings);
      }

      // Guardar cambios en tiers
      if (Object.keys(tierChanges).length > 0) {
        setSavingTiers(true);

        const updatePromises = Object.entries(tierChanges).map(
          ([tierId, valueInUnit]) =>
            axios.patch(`/api/tiers/${tierId}`, { duration: unitToDays(valueInUnit, unit) })
        );

        await Promise.all(updatePromises);

        // Recargar tiers localmente
        await loadTiers();
        setTierChanges({});

        // Invalidate task data cache so other components refresh
        invalidateTiers();

        toast.success({
          title: "Tier durations updated",
          description: "New durations saved.",
        });
      }

      // Recargar settings
      await refetch();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error({
        title: "Couldn't save settings",
        description: "Your changes weren't saved.",
      });
    } finally {
      setSavingTiers(false);
    }
  };

  // Reset a valores por defecto (confirmado vía AlertDialog).
  const doReset = async () => {
    try {
      await resetSettingsMutation.mutateAsync();
      setTierChanges({});
      invalidateAll();
      toast.success({
        title: "Settings reset",
        description: "Restored to default values.",
      });
    } catch (error) {
      console.error("Error resetting settings:", error);
      toast.error({
        title: "Reset failed",
        description: "Couldn't restore the defaults.",
      });
    }
  };

  // Render input based on data type
  const renderSettingInput = (setting: any, size: "sm" | "md" = "sm") => {
    const settingKey = `${setting.category}.${setting.key}`;
    const currentValue = settingValues[settingKey]?.value ?? setting.value;
    const hasChanged = settingValues[settingKey]?.hasChanged ?? false;

    switch (setting.dataType) {
      case "boolean":
        return (
          <Switch
            checked={Boolean(currentValue)}
            onChange={(event) =>
              handleSettingChange(
                setting.category,
                setting.key,
                event.target.checked
              )
            }
            size={size}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={currentValue.toString()}
            onChange={(event) => {
              const value = parseFloat(event.target.value);
              if (!isNaN(value)) {
                handleSettingChange(setting.category, setting.key, value);
              }
            }}
            min={setting.minValue}
            max={setting.maxValue}
            step={setting.key.includes("duration") ? 0.1 : 1}
            size={size}
            className={`w-full${hasChanged ? " border-warning-500" : ""}`}
          />
        );

      default:
        // For tier_info, do not render an input
        if (setting.key === 'tier_info') {
          return null;
        }

        return (
          <Input
            value={currentValue.toString()}
            onChange={(event) =>
              handleSettingChange(
                setting.category,
                setting.key,
                event.target.value
              )
            }
            size={size}
            className={`w-full${hasChanged ? " border-warning-500" : ""}`}
          />
        );
    }
  };

  // Get setting display info: uses the label/description from the catalog
  // and appends the allowed range to the tooltip when present.
  const getSettingDisplayInfo = (setting: any) => {
    const range =
      setting.minValue !== undefined && setting.minValue !== null &&
      setting.maxValue !== undefined && setting.maxValue !== null
        ? ` (Range: ${setting.minValue}-${setting.maxValue})`
        : '';

    return {
      label: setting.label,
      tooltip: `${setting.description || setting.label}${range}`
    };
  };

  // Group name mapping
  const getGroupDisplayName = (groupName: string) => {
    const mapping: Record<string, string> = {
      work_schedule: "Work schedule",
      task_assignment: "Task assignment",
      approvals: "Approvals"
    };
    return mapping[groupName] || groupName;
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Icon icon={PiGear} size={20} />
          <span className="text-lg font-medium">Loading Settings...</span>
        </div>
        <Progress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert tone="error" variant="soft" icon={null}>
          <div className="text-sm font-medium">Failed to load settings</div>
          <div className="text-xs mt-1">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </div>
        </Alert>
      </div>
    );
  }

  if (!settingsData?.settings) {
    return (
      <div className="max-w-6xl mx-auto">
        <Alert tone="info" variant="soft" icon={null}>
          <span>No settings available</span>
        </Alert>
      </div>
    );
  }

  // Filtrar solo los grupos permitidos
  const filteredSettings = Object.entries(settingsData.settings).filter(
    ([groupName]) => ALLOWED_GROUPS.includes(groupName)
  );

  // Pestañas: los 3 grupos de settings + "Tier durations". Lista vertical a la izquierda
  // (~30%) y los campos de la sección activa a la derecha.
  const TABS = [
    { id: "work_schedule", label: "Work schedule", desc: "Working hours, lunch & timezone" },
    { id: "task_assignment", label: "Task assignment", desc: "Assignment engine thresholds" },
    { id: "approvals", label: "Approvals", desc: "Auto-complete delivered tasks" },
    { id: "tiers", label: "Tier durations", desc: "Default duration per tier" },
  ] as const;
  const activeInfo = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const activeGroup = filteredSettings.find(([g]) => g === activeTab);
  const fieldRange = (s: any) =>
    s.minValue != null && s.maxValue != null ? `Range: ${s.minValue}–${s.maxValue}.` : "";

  return (
    <>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Tabs (vertical en desktop; fila horizontal scrollable en mobile) */}
        <nav className="flex gap-1.5 overflow-x-auto pb-1 md:w-1/3 md:max-w-[260px] md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors md:w-full",
                  active
                    ? "border-primary-500/40 bg-primary-500/10"
                    : "border-transparent hover:bg-(--color-surface-hover)",
                )}
              >
                <div className={cn("text-sm font-semibold", active ? "text-(--color-text-strong)" : "text-(--color-text-default)")}>
                  {t.label}
                </div>
                <div className="hidden text-xs text-(--color-text-muted) md:block">{t.desc}</div>
              </button>
            );
          })}
        </nav>

        {/* Panel de la sección activa */}
        <div className="min-w-0 flex-1">
          <Card variant="outlined" padding="lg" className="flex flex-col gap-5">
            <div>
              <h3 className="text-base font-semibold text-(--color-text-strong)">{activeInfo.label}</h3>
              <p className="text-sm text-(--color-text-muted)">{activeInfo.desc}</p>
            </div>

            {activeTab === "tiers" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-(--color-text-muted)">Duration unit</span>
                  <div className="w-40">
                    <Select
                      size="sm"
                      value={unit}
                      onChange={(val) => handleUnitChange(val as DurationUnit)}
                      disabled={loadingTiers || savingUnit}
                      options={DURATION_UNITS.map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }))}
                    />
                  </div>
                </div>
                {loadingTiers ? (
                  <Progress />
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    {tiers.map((tier) => {
                      const hasChanged = tierChanges[tier.id] !== undefined;
                      const currentDuration = tierChanges[tier.id] ?? toUnit(tier.duration);
                      return (
                        <FormField key={tier.id} label={`Tier ${tier.name}`} helper={`In ${unit}`}>
                          <Input
                            type="number"
                            value={currentDuration.toString()}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value > 0) handleTierDurationChange(tier.id, value);
                            }}
                            min={unit === "minutes" ? 1 : 0.1}
                            step={unit === "days" ? 0.1 : 1}
                            size="md"
                            className={hasChanged ? "border-warning-500" : ""}
                          />
                        </FormField>
                      );
                    })}
                  </div>
                )}
              </>
            ) : activeGroup ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {activeGroup[1]
                  .filter((s) => s.key !== "tier_info")
                  .map((setting) => {
                    const { label } = getSettingDisplayInfo(setting);
                    const helper = `${setting.description ?? ""} ${fieldRange(setting)}`.trim();
                    return (
                      <FormField
                        key={`${setting.category}.${setting.key}`}
                        label={label}
                        helper={helper || undefined}
                      >
                        {renderSettingInput(setting, "md")}
                      </FormField>
                    );
                  })}
              </div>
            ) : null}
          </Card>

          {/* Acciones */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <IconButton
              aria-label="Reset settings to defaults"
              variant="outlined"
              color="error"
              onClick={() => setShowResetDialog(true)}
              disabled={resetSettingsMutation.isPending}
            >
              {resetSettingsMutation.isPending ? (
                <Spinner colorClassName="" />
              ) : (
                <Icon icon={PiArrowsClockwise} size={16} />
              )}
            </IconButton>
            <Button
              startIcon={<Icon icon={PiDownloadSimple} size={16} />}
              onClick={handleSave}
              disabled={!hasChanges}
              loading={updateSettingsMutation.isPending || savingTiers}
              color={hasChanges ? "warning" : "primary"}
            >
              {hasChanges ? "Save Changes" : "No Changes"}
            </Button>
          </div>

          {hasChanges && (
            <Alert tone="warning" variant="soft" icon={null} className="mt-4">
              <div className="flex items-center gap-2">
                <Icon icon={PiWarning} size={16} />
                <span className="text-sm">You have unsaved changes. Don&apos;t forget to save.</span>
              </div>
            </Alert>
          )}
        </div>
      </div>

      {/* Confirmación del reset a valores por defecto */}
      <AlertDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        tone="warning"
        title="Reset settings?"
        description="This restores work schedule, task assignment and tier durations to their default values. This can't be undone."
        confirmLabel="Reset to defaults"
        cancelLabel="Cancel"
        onConfirm={doReset}
      />
    </>
  );
};

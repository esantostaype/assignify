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
  Tooltip,
  Progress,
  Alert,
  Spinner,
  FormSeparator,
  AlertDialog,
  Select,
} from "@/components/ui";
import {
  Icon,
  PiGear,
  PiDownloadSimple,
  PiWarning,
  PiInfo,
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

  return (
    <>

      {/* Settings Groups */}
      <div className="space-y-8">
        {filteredSettings.map(([groupName, settings]) => {
          // Excluir tier_info de los settings a mostrar
          const settingsToShow = settings.filter(s => s.key !== 'tier_info');

          if (settingsToShow.length === 0 && groupName !== 'tier_settings') {
            return null;
          }

          return (
            <section key={groupName} className="space-y-4">
              <FormSeparator>{getGroupDisplayName(groupName)}</FormSeparator>

              {settingsToShow.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  {settingsToShow.map((setting) => {
                    const { label, tooltip } = getSettingDisplayInfo(setting);
                    const settingKey = `${setting.category}.${setting.key}`;
                    const hasChanged = settingValues[settingKey]?.hasChanged ?? false;

                    return (
                      <div key={settingKey} className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-(--color-text-muted)">
                          <span className="truncate">{label}</span>
                          {hasChanged && (
                            <div
                              className="w-2 h-2 bg-orange-500 rounded-full shrink-0"
                              title="Changed"
                            />
                          )}
                          <Tooltip content={tooltip}>
                            <span className="inline-flex cursor-help text-(--color-text-subtle) shrink-0">
                              <Icon icon={PiInfo} size={14} />
                            </span>
                          </Tooltip>
                        </div>
                        {renderSettingInput(setting)}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* Tier Settings */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <FormSeparator>Tier Durations</FormSeparator>
            <div className="w-36 shrink-0">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {tiers.map((tier) => {
                const hasChanged = tierChanges[tier.id] !== undefined;
                const currentDuration = tierChanges[tier.id] ?? toUnit(tier.duration);

                return (
                  <div key={tier.id} className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-(--color-text-muted)">
                      <span className="truncate">Tier {tier.name}</span>
                      {hasChanged && (
                        <div
                          className="w-2 h-2 bg-orange-500 rounded-full shrink-0"
                          title="Changed"
                        />
                      )}
                      <span className="text-xs text-(--color-text-subtle)">({unit})</span>
                    </div>
                    <Input
                      type="number"
                      value={currentDuration.toString()}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value > 0) {
                          handleTierDurationChange(tier.id, value);
                        }
                      }}
                      min={unit === "minutes" ? 1 : 0.1}
                      step={unit === "days" ? 0.1 : 1}
                      size="sm"
                      className={`w-full${hasChanged ? " border-warning-500" : ""}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <div className="flex justify-end items-center gap-2">
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
      </div>

      {/* Warning for changes */}
      {hasChanges && (
        <Alert tone="warning" variant="soft" icon={null} className="mb-6">
          <div className="flex items-center gap-2">
            <Icon icon={PiWarning} size={16} />
            <span className="text-sm">
              You have unsaved changes. Don't forget to save your settings.
            </span>
          </div>
        </Alert>
      )}

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

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
} from "@/components/ui";
import {
  Icon,
  PiGear,
  PiDownloadSimple,
  PiWarning,
  PiInfo,
  PiArrowsClockwise,
  PiClock,
  PiSquaresFour,
  PiBriefcase,
  type IconComponent,
} from "@/lib/icons";
import {
  useSettings,
  useUpdateSettings,
  useResetSettings,
} from "@/hooks/useSettings";
import { useTaskDataInvalidation } from "@/hooks/useTaskData"; // ✅ NUEVO IMPORT
import axios from "axios";
import toast from "react-hot-toast";
import { TableTh } from "../TableTh";
import { TableTd } from "../TableTd";

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
const ALLOWED_GROUPS = ["work_schedule", "task_assignment"];

export const SettingsForm: React.FC = () => {
  const { data: settingsData, isLoading, error, refetch } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const resetSettingsMutation = useResetSettings();

  // ✅ NUEVO: Hook para invalidar cache de task data
  const { invalidateTiers, invalidateAll } = useTaskDataInvalidation();

  const [settingValues, setSettingValues] = useState<
    Record<string, SettingValue>
  >({});
  const [hasChanges, setHasChanges] = useState(false);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [tierChanges, setTierChanges] = useState<Record<number, number>>({});
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [savingTiers, setSavingTiers] = useState(false);

  // Cargar tiers
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setLoadingTiers(true);
        const response = await axios.get("/api/tiers");
        setTiers(response.data);
      } catch (error) {
        console.error("Error loading tiers:", error);
        toast.error("Error loading tier settings");
      } finally {
        setLoadingTiers(false);
      }
    };
    fetchTiers();
  }, []);

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

    if (originalTier.duration === newDuration) {
      // Si vuelve al valor original, remover del registro de cambios
      const newTierChanges = { ...tierChanges };
      delete newTierChanges[tierId];
      setTierChanges(newTierChanges);
    } else {
      // Registrar el cambio
      setTierChanges((prev) => ({
        ...prev,
        [tierId]: newDuration,
      }));
    }

    updateHasChanges(settingValues, null, false, {
      ...tierChanges,
      [tierId]: newDuration,
    });
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
          ([tierId, duration]) =>
            axios.patch(`/api/tiers/${tierId}`, { duration })
        );

        await Promise.all(updatePromises);

        // Recargar tiers localmente
        const response = await axios.get("/api/tiers");
        setTiers(response.data);
        setTierChanges({});

        // ✅ NUEVO: Invalidar cache de task data para que otros componentes se actualicen
        console.log('🔄 Invalidating task data cache after tier changes...');
        invalidateTiers();

        toast.success("Tier durations updated successfully");
      }

      // Recargar settings
      await refetch();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Error saving settings");
    } finally {
      setSavingTiers(false);
    }
  };

  // Handle reset to defaults
  const handleReset = async () => {
    if (
      window.confirm(
        "Are you sure you want to reset these settings to their default values?"
      )
    ) {
      await resetSettingsMutation.mutateAsync();
      setTierChanges({});

      // ✅ NUEVO: Invalidar todo el cache después del reset
      console.log('🔄 Invalidating all task data cache after settings reset...');
      invalidateAll();
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
            className={`w-24${hasChanged ? " border-warning-500" : ""}`}
          />
        );

      default:
        // Para tier_info, no mostrar input
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
            className={`w-24${hasChanged ? " border-warning-500" : ""}`}
          />
        );
    }
  };

  // Get setting display info
  const getSettingDisplayInfo = (setting: any) => {
    // Mapeo de keys a labels más cortos y tooltips
    const displayMap: Record<string, { label: string; tooltip: string }> = {
      'start_hour': {
        label: 'Start Hour',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue})`
      },
      'lunch_start': {
        label: 'Lunch Start Hour',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue})`
      },
      'lunch_end': {
        label: 'Lunch End Hour',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue}h)`
      },
      'end_hour': {
        label: 'End Hour',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue})`
      },
      'normal_before_low_threshold': {
        label: 'Normal before Low',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue})`
      },
      'consecutive_low_threshold': {
        label: 'Max Low Tasks',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue})`
      },
      'deadline_difference_threshold': {
        label: 'Deadline Diff',
        tooltip: `${setting.label}: ${setting.description} (Range: ${setting.minValue}-${setting.maxValue} days)`
      }
    };

    return displayMap[setting.key] || {
      label: setting.label,
      tooltip: setting.description || setting.label
    };
  };

  // Group icons
  const getGroupIcon = (groupName: string): IconComponent => {
    switch (groupName) {
      case "work_schedule":
        return PiClock;
      case "task_assignment":
        return PiBriefcase;
      default:
        return PiGear;
    }
  };

  // Group name mapping
  const getGroupDisplayName = (groupName: string) => {
    const mapping: Record<string, string> = {
      work_schedule: "Work Schedule",
      task_assignment: "Task Assignment"
    };
    return mapping[groupName] || groupName;
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
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
      <div className="p-8 max-w-6xl mx-auto">
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
      <div className="p-8 max-w-6xl mx-auto">
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
    <div className="p-8">

      {/* Settings Groups */}
      <div className="space-y-6">
        {filteredSettings.map(([groupName, settings]) => {
          const GroupIcon = getGroupIcon(groupName);

          // Excluir tier_info de los settings a mostrar
          const settingsToShow = settings.filter(s => s.key !== 'tier_info');

          if (settingsToShow.length === 0 && groupName !== 'tier_settings') {
            return null;
          }

          return (
            <div key={groupName}>
              <div className="flex items-center gap-2 mb-4">
                <Icon
                  icon={GroupIcon}
                  size={20}
                  className="text-primary-600"
                />
                <h2 className="text-lg font-medium">
                  {getGroupDisplayName(groupName)}
                </h2>
              </div>

              {settingsToShow.length > 0 && (
                <div className="border border-(--color-border-default) rounded-lg overflow-y-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-(--color-surface-hover)">
                      <tr>
                        {settingsToShow.map((setting) => {
                          const { label, tooltip } = getSettingDisplayInfo(setting);
                          const settingKey = `${setting.category}.${setting.key}`;
                          const hasChanged = settingValues[settingKey]?.hasChanged ?? false;

                          return (
                            <TableTh key={settingKey}>
                              <div className="flex items-center gap-2">
                                <span>{label}</span>
                                {hasChanged && (
                                  <div
                                    className="w-2 h-2 bg-orange-500 rounded-full"
                                    title="Changed"
                                  />
                                )}
                                <Tooltip content={tooltip}>
                                  <span className="inline-flex cursor-help text-(--color-text-subtle)">
                                    <Icon
                                      icon={PiInfo}
                                      size={14}
                                    />
                                  </span>
                                </Tooltip>
                              </div>
                            </TableTh>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {settingsToShow.map((setting) => {
                          const settingKey = `${setting.category}.${setting.key}`;

                          return (
                            <TableTd key={settingKey}>
                              <div className="py-2 w-full">
                                {renderSettingInput(setting)}
                              </div>
                            </TableTd>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Tier Settings Table */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Icon
              icon={PiSquaresFour}
              size={20}
              className="text-primary-600"
            />
            <h2 className="text-lg font-medium">Tier Durations</h2>
          </div>

          {loadingTiers ? (
            <Progress />
          ) : (
            <div className="border border-(--color-border-default) rounded-lg overflow-y-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-(--color-surface-hover)">
                  <tr>
                    {tiers.map((tier) => {
                      const hasChanged = tierChanges[tier.id] !== undefined;

                      return (
                        <TableTh key={tier.id}>
                          <div className="flex items-center gap-2">
                            <span>Tier {tier.name}</span>
                            {hasChanged && (
                              <div
                                className="w-2 h-2 bg-orange-500 rounded-full"
                                title="Changed"
                              />
                            )}
                          </div>
                        </TableTh>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {tiers.map((tier) => {
                      const hasChanged = tierChanges[tier.id] !== undefined;
                      const currentDuration =
                        tierChanges[tier.id] ?? tier.duration;

                      return (
                        <TableTd key={tier.id}>
                          <div className="py-2 px-2 w-full">
                            <Input
                              type="number"
                              value={currentDuration.toString()}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  handleTierDurationChange(tier.id, value);
                                }
                              }}
                              min={0.1}
                              step={0.1}
                              size="sm"
                              className={`w-18${hasChanged ? " border-warning-500" : ""}`}
                            />
                          </div>
                        </TableTd>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <div className="flex justify-end items-center gap-2">
          <IconButton
            aria-label="Reset settings to defaults"
            variant="outlined"
            color="error"
            onClick={handleReset}
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

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-(--color-border-default)">
        <p className="text-sm text-(--color-text-muted) text-center">
          Changes will take effect immediately after saving
        </p>
      </div>
    </div>
  );
};

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { Button, Input, Alert } from "@/components/ui";
import { Icon, PiDownloadSimple, PiWarning } from "@/lib/icons";
import { useTaskDataInvalidation } from "@/hooks/useTaskData";
import axios from "axios";
import toast from "react-hot-toast";

interface TierData {
  id: number;
  name: string;
  duration: number;
  categoryCount: number;
}

// Agregar este componente dentro del archivo, antes del componente principal:
const TierSkeleton: React.FC = () => {
  // Crear 4 columnas de skeleton para simular los tiers
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
      <thead className="bg-(--color-surface-hover)">
        <tr>{skeletonColumns}</tr>
      </thead>
      <tbody>
        <tr>{skeletonInputs}</tr>
      </tbody>
    </>
  );
};

export const TierListForm: React.FC = () => {
  const { invalidateTiers } = useTaskDataInvalidation();

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
  };

  // Check if there are changes
  const hasChanges = Object.keys(tierChanges).length > 0;

  // Handle form submission
  const handleSave = async () => {
    try {
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

        // Invalidar cache de task data para que otros componentes se actualicen
        console.log("🔄 Invalidating task data cache after tier changes...");
        invalidateTiers();

        toast.success("Tier durations updated successfully");
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Error saving tier durations");
    } finally {
      setSavingTiers(false);
    }
  };

  return (
    <div className="p-8">
      {!loadingTiers && hasChanges && (
        <Alert tone="warning" variant="soft" icon={null} className="mb-4">
          <div className="flex items-center gap-2">
            <Icon icon={PiWarning} size={16} />
            <span className="text-sm">
              You have unsaved changes. Don't forget to save your settings.
            </span>
          </div>
        </Alert>
      )}

      <div className="border border-(--color-border-default) rounded-lg overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          {loadingTiers ? (
            // Skeleton mientras carga
            <TierSkeleton />
          ) : (
            // Contenido real
            <>
              <thead className="bg-(--color-surface-hover)">
                <tr>
                  {tiers.map((tier) => {
                    const hasChanged = tierChanges[tier.id] !== undefined;

                    return (
                      <th key={tier.id} className="p-2 first:pl-4 last:pr-4 text-left text-sm font-medium text-gray-300">
                        <div className="flex items-center gap-2 justify-center">
                          <span>Tier {tier.name}</span>
                          {hasChanged && (
                            <div
                              className="w-2 h-2 bg-orange-500 rounded-full"
                              title="Changed"
                            />
                          )}
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
                    const currentDuration =
                      tierChanges[tier.id] ?? tier.duration;

                    return (
                      <td key={tier.id} className="p-2 first:pl-4 last:pr-4">
                        <div className="pt-2 w-full flex justify-center">
                          <div className="flex flex-col items-center gap-1">
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
                              size="md"
                              className={`w-24 [&_input]:text-center${
                                hasChanged ? " border-warning-500" : ""
                              }`}
                            />
                            <span className="text-xs text-(--color-text-muted)">days</span>
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
          {loadingTiers
            ? "Loading..."
            : hasChanges
            ? "Save Changes"
            : "No Changes"}
        </Button>
      </div>
    </div>
  );
};

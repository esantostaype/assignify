"use client";
import React from "react";
import { Select } from "@/components/ui";
import { Typography } from "@/components/ui/typography";
import { Icon, PiSteps } from "@/lib/icons";
import { formatDuration, type DurationUnit } from "@/utils/duration-utils";
import { TierInfo } from "@/interfaces";

interface TierSelectProps {
  tiers: TierInfo[];
  value: string | null;
  onChange: (value: string | null) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
  // Unidad de duración del workspace (días/horas/minutos) para mostrar la duración del tier.
  unit?: DurationUnit;
}

// Orden visual de los tiers (de mayor a menor esfuerzo).
const TIER_ORDER = ["S", "A", "B", "C", "D", "E"];

export const TierSelect: React.FC<TierSelectProps> = ({
  tiers,
  value,
  onChange,
  touched,
  error,
  loading = false,
  unit = "days",
}) => {
  const sortedTiers = React.useMemo(
    () =>
      [...tiers].sort(
        (a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name)
      ),
    [tiers]
  );

  return (
    <div>
      <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
        <Icon icon={PiSteps} size={18} />
        Tier
      </Typography>

      <Select
        placeholder={loading ? "Loading tiers..." : "Select a tier"}
        // Pasar '' (no undefined) cuando no hay tier: con undefined el Select se
        // vuelve NO controlado y conserva su estado interno, así que tras limpiar el
        // formulario seguía mostrando el tier viejo. Con '' permanece controlado.
        value={value ?? ''}
        onChange={(val) => onChange(val)}
        disabled={loading}
        error={touched && error ? error : undefined}
        options={sortedTiers.map((tier) => ({
          value: tier.id.toString(),
          label: (
            <>
              <span style={{ fontWeight: 600, marginRight: 8 }}>{tier.name}</span>
              <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
                {formatDuration(tier.duration, unit)}
              </span>
            </>
          ),
          searchValue: tier.name,
        }))}
      />
    </div>
  );
};

"use client";
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/shadcn/select";
import { formatDuration, type DurationUnit } from "@/utils/duration-utils";
import { TierInfo } from "@/interfaces";

interface TierSelectProps {
  tiers: TierInfo[];
  value: string | null;
  onChange: (value: string | null) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
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
    () => [...tiers].sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name)),
    [tiers]
  );

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <HugeiconsIcon icon={Layers01Icon} size={18} />
        Tier
      </label>
      {/* value '' (no undefined) cuando no hay tier → sigue controlado al limpiar. */}
      <Select value={value ?? ""} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className={cn(touched && error && "ring-1 ring-destructive")}>
          <SelectValue placeholder={loading ? "Loading tiers..." : "Select a tier"} />
        </SelectTrigger>
        <SelectContent>
          {sortedTiers.map((tier) => (
            <SelectItem key={tier.id} value={tier.id.toString()}>
              <span className="mr-2 font-semibold">{tier.name}</span>
              <span className="text-xs opacity-60">{formatDuration(tier.duration, unit)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
};

"use client";
import React from "react";
import { Select } from "@/components/ui";
import { Typography } from "@/components/ui/typography";
import { Icon, PiSteps } from "@/lib/icons";
import { TextFieldError } from "@/components";
import { formatDaysToReadable } from "@/utils/duration-utils";
import { TierInfo } from "@/interfaces";

interface TierSelectProps {
  tiers: TierInfo[];
  value: string | null;
  onChange: (value: string | null) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
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
        value={value ?? undefined}
        onChange={(val) => onChange(val)}
        disabled={loading}
        invalid={!!(touched && error)}
        options={sortedTiers.map((tier) => ({
          value: tier.id.toString(),
          label: (
            <>
              <span style={{ fontWeight: 600, marginRight: 8 }}>{tier.name}</span>
              <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
                {formatDaysToReadable(tier.duration)}
              </span>
            </>
          ),
          searchValue: tier.name,
        }))}
      />

      {touched && error && <TextFieldError label={error} />}
    </div>
  );
};

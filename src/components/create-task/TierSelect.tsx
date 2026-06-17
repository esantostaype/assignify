"use client";
import React from "react";
import { Select, Option, FormLabel } from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
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
      <FormLabel>
        <HugeiconsIcon icon={Layers01Icon} size={20} strokeWidth={1.5} />
        Tier
      </FormLabel>

      <Select
        placeholder={loading ? "Loading tiers..." : "Select a tier"}
        value={value}
        onChange={(_, val) => onChange(val as string | null)}
        disabled={loading}
        color={touched && error ? "danger" : "neutral"}
      >
        {sortedTiers.map((tier) => (
          <Option key={tier.id} value={tier.id.toString()}>
            <span style={{ fontWeight: 600, marginRight: 8 }}>{tier.name}</span>
            <span style={{ opacity: 0.6, fontSize: "0.8rem" }}>
              {formatDaysToReadable(tier.duration)}
            </span>
          </Option>
        ))}
      </Select>

      {touched && error && <TextFieldError label={error} />}
    </div>
  );
};

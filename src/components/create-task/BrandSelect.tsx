import React from "react";
import { Select } from "@/components/ui";
import { Typography } from "@/components/ui/typography";
import { Brand } from "@/interfaces";
import { Icon, PiTag } from "@/lib/icons";
import { TextFieldError } from "@/components";

interface BrandSelectProps {
  brands: Brand[];
  value: string;
  onChange: (value: string) => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
}

export const BrandSelect: React.FC<BrandSelectProps> = ({
  brands,
  value,
  onChange,
  touched,
  error,
  loading = false,
}) => (
  <div>
    <Typography variant="label" className="flex items-center gap-1.5 mb-1.5">
      <Icon icon={PiTag} size={18} />
      Brand
    </Typography>
    <Select
      value={value}
      onChange={(val) => onChange(val)}
      placeholder={loading ? "Loading brands..." : "Select a brand"}
      disabled={loading}
      invalid={touched && !!error}
      options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
    />
    {touched && error && <TextFieldError label={error} />}
  </div>
);

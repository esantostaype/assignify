import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/shadcn/select";
import { Brand } from "@/interfaces";

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
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
      <HugeiconsIcon icon={Folder01Icon} size={18} />
      List
    </label>
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className={cn(touched && error && "ring-1 ring-destructive")}>
        <SelectValue placeholder={loading ? "Loading lists..." : "Select a list"} />
      </SelectTrigger>
      <SelectContent>
        {brands.map((brand) => (
          <SelectItem key={brand.id} value={brand.id}>
            {brand.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {touched && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

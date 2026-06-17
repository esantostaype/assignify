
import React, { useState } from 'react';
import { Button, Select, type SelectOption } from '@/components/ui';
import { Switch } from '@/components/ui/choice/Switch';
import { Icon, PiPlus } from '@/lib/icons';

interface AddRoleFormProps {
  taskTypes: Array<{ id: number; name: string }>;
  brands: Array<{ id: string; name: string }>;
  onAdd: (typeId: number, brandId?: string, isPrimary?: boolean) => void;
  loading?: boolean;
  loadingTypes?: boolean;
  loadingBrands?: boolean;
}

export const AddRoleForm: React.FC<AddRoleFormProps> = ({
  taskTypes,
  brands,
  onAdd,
  loading = false,
  loadingTypes = false,
  loadingBrands = false
}) => {
  const [typeId, setTypeId] = useState<string>('');
  const [brandId, setBrandId] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);

  const handleAdd = () => {
    if (typeId) {
      onAdd(parseInt(typeId), brandId || undefined, isPrimary);
      setTypeId('');
      setBrandId('');
      setIsPrimary(false);
    }
  };

  const typeOptions: SelectOption[] =
    loadingTypes && taskTypes.length === 0
      ? [{ value: '', label: 'Loading types...', disabled: true }]
      : taskTypes.map((type) => ({
          value: type.id.toString(),
          label: type.name,
        }));

  const brandOptions: SelectOption[] =
    loadingBrands && brands.length === 0
      ? [{ value: '', label: 'Loading brands...', disabled: true }]
      : [
          { value: '', label: 'Global (All brands)' },
          ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
        ];

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Select
            label="Role Type"
            options={typeOptions}
            value={typeId}
            onChange={(value) => setTypeId(value)}
            placeholder="Select role type"
            disabled={loadingTypes}
            size="sm"
          />
        </div>

        <div className="flex-1">
          <Select
            label="Brand (Optional)"
            options={brandOptions}
            value={brandId}
            onChange={(value) => setBrandId(value)}
            placeholder="Select brand (optional)"
            disabled={loadingBrands}
            size="sm"
          />
        </div>

        <Button
          variant="filled"
          color="primary"
          startIcon={<Icon icon={PiPlus} size={16} />}
          onClick={handleAdd}
          disabled={!typeId || loadingTypes || loadingBrands}
          loading={loading}
          size="sm"
        >
          Add Role
        </Button>
      </div>

      <Switch
        size="sm"
        label="Primary role"
        checked={isPrimary}
        onChange={(e) => setIsPrimary(e.target.checked)}
        disabled={loading}
      />
    </div>
  );
};

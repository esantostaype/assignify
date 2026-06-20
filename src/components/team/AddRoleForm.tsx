import React, { useState } from 'react';
import { Button, Select, type SelectOption } from '@/components/ui';
import { Switch } from '@/components/ui/choice/Switch';
import { Icon, PiPlus } from '@/lib/icons';

interface AddRoleFormProps {
  taskTypes: Array<{ id: number; name: string }>;
  /** Tipos YA asignados (incluye los pendientes): se excluyen del selector para
   *  no duplicar — un miembro no puede tener el mismo rol dos veces. */
  assignedTypeIds: number[];
  onAdd: (typeId: number, isPrimary: boolean) => void;
  loading?: boolean;
  loadingTypes?: boolean;
}

// Un rol = un TIPO de tarea (aplica a todo; ya no hay brand). No se puede repetir.
export const AddRoleForm: React.FC<AddRoleFormProps> = ({
  taskTypes,
  assignedTypeIds,
  onAdd,
  loading = false,
  loadingTypes = false,
}) => {
  const [typeId, setTypeId] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);

  const available = taskTypes.filter((t) => !assignedTypeIds.includes(t.id));

  const handleAdd = () => {
    if (!typeId) return;
    onAdd(parseInt(typeId), isPrimary);
    setTypeId('');
    setIsPrimary(false);
  };

  const allAssigned = !loadingTypes && taskTypes.length > 0 && available.length === 0;

  const typeOptions: SelectOption[] =
    loadingTypes && taskTypes.length === 0
      ? [{ value: '', label: 'Loading types...', disabled: true }]
      : available.map((type) => ({ value: type.id.toString(), label: type.name }));

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label="Role Type"
            options={typeOptions}
            value={typeId}
            onChange={(value) => setTypeId(value)}
            placeholder={allAssigned ? 'All roles already added' : 'Select role type'}
            disabled={loadingTypes || allAssigned}
            size="sm"
          />
        </div>

        <Button
          variant="filled"
          color="primary"
          startIcon={<Icon icon={PiPlus} size={16} />}
          onClick={handleAdd}
          disabled={!typeId || loadingTypes}
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

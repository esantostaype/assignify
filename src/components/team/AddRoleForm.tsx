import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/shadcn/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/shadcn/select';
import { Switch } from '@/components/shadcn/switch';

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

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Role Type</label>
          <Select value={typeId} onValueChange={setTypeId} disabled={loadingTypes || allAssigned}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  allAssigned ? 'All roles already added' : loadingTypes ? 'Loading types...' : 'Select role type'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {available.map((type) => (
                <SelectItem key={type.id} value={type.id.toString()}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleAdd} disabled={!typeId || loadingTypes}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          Add Role
        </Button>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-foreground">
        <Switch checked={isPrimary} onCheckedChange={setIsPrimary} disabled={loading} />
        Primary role
      </label>
    </div>
  );
};

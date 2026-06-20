// src/components/team/UserRoleRow.tsx
// Fila de rol dentro del editor de miembro. El borrado es DIRECTO (solo marca el
// cambio en el formulario; se confirma al pulsar Save y se revierte con Discard),
// por eso ya no lleva un diálogo de confirmación propio.
import React from "react";
import { IconButton, Tooltip } from "@/components/ui";
import { Switch } from "@/components/ui/choice/Switch";
import { Icon, PiTrash } from "@/lib/icons";

interface UserRoleRowProps {
  role: {
    id: number;
    type: { name: string };
    isPrimary: boolean;
  };
  onDelete: (roleId: number) => void;
  onTogglePrimary: (roleId: number, isPrimary: boolean) => void;
  deleting?: boolean;
  togglingPrimary?: boolean;
  loading?: boolean;
}

export const UserRoleRow: React.FC<UserRoleRowProps> = ({
  role,
  onDelete,
  onTogglePrimary,
  deleting = false,
  togglingPrimary = false,
  loading = false,
}) => {
  return (
    <tr className="border-b border-(--color-border-default) text-sm">
      <td className="p-2 first:pl-4 last:pr-4">{loading ? "Loading..." : role.type.name}</td>
      <td className="p-2 first:pl-4 last:pr-4">
        {loading ? (
          "Loading..."
        ) : (
          <Tooltip content={role.isPrimary ? "Unset as primary role" : "Set as primary role"}>
            <Switch
              size="sm"
              aria-label={role.isPrimary ? "Unset as primary role" : "Set as primary role"}
              checked={role.isPrimary}
              onChange={() => onTogglePrimary(role.id, !role.isPrimary)}
              disabled={togglingPrimary}
            />
          </Tooltip>
        )}
      </td>
      <td className="p-2 first:pl-4 last:pr-4">
        {loading ? (
          "Loading..."
        ) : (
          <IconButton
            aria-label="Remove role"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => onDelete(role.id)}
            disabled={deleting}
          >
            <Icon icon={PiTrash} size={16} />
          </IconButton>
        )}
      </td>
    </tr>
  );
};

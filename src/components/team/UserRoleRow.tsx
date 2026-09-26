// src/components/team/UserRoleRow.tsx
// Fila de rol dentro del editor de miembro. El borrado es DIRECTO (solo marca el
// cambio en el formulario; se confirma al pulsar Save y se revierte con Discard).
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/shadcn/button";
import { Switch } from "@/components/shadcn/switch";
import { Tooltip } from "@/components/shadcn/tooltip";

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
              aria-label={role.isPrimary ? "Unset as primary role" : "Set as primary role"}
              checked={role.isPrimary}
              onCheckedChange={() => onTogglePrimary(role.id, !role.isPrimary)}
              disabled={togglingPrimary}
            />
          </Tooltip>
        )}
      </td>
      <td className="p-2 first:pl-4 last:pr-4">
        {loading ? (
          "Loading..."
        ) : (
          <Button
            aria-label="Remove role"
            size="icon-sm"
            variant="soft"
            className="bg-destructive/15 text-destructive hover:bg-destructive/20"
            onClick={() => onDelete(role.id)}
            disabled={deleting}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </Button>
        )}
      </td>
    </tr>
  );
};

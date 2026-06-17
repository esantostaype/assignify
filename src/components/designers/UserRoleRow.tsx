// src/components/designers/UserRoleRow.tsx
import React from "react";
import { IconButton, Tooltip } from "@/components/ui";
import { Switch } from "@/components/ui/choice/Switch";
import { Icon, PiTrash } from "@/lib/icons";
import { useConfirmationStore } from "@/stores/confirmationStore";

interface UserRoleRowProps {
  role: {
    id: number;
    type: { name: string };
    brand?: { name: string } | null;
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
  const { openConfirmation } = useConfirmationStore();

  return (
    <tr className="border-b border-(--color-border-default) text-sm">
      <td className="p-2 first:pl-4 last:pr-4">{loading ? "Loading..." : role.type.name}</td>
      <td className="p-2 first:pl-4 last:pr-4">{loading ? "Loading..." : role.brand?.name || "Global"}</td>
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
            aria-label="Delete role"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              openConfirmation({
                title: "Delete Role",
                description: `Are you sure you want to delete the "${
                  role.type.name
                }" role${
                  role.brand ? ` for "${role.brand.name}"` : " (Global)"
                }? This action cannot be undone.`,
                type: "danger",
                confirmText: "Delete Role",
                cancelText: "Cancel",
                onConfirm: () => onDelete(role.id),
              });
            }}
            disabled={deleting}
          >
            <Icon icon={PiTrash} size={16} />
          </IconButton>
        )}
      </td>
    </tr>
  );
};

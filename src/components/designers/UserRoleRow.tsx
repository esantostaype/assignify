// src/components/designers/UserRoleRow.tsx
import React from "react";
import { Chip, IconButton, Tooltip } from "@/components/ui";
import { Icon, PiTrash, PiStar, PiStarFill } from "@/lib/icons";
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
          <div className="flex items-center gap-2">
            <Tooltip
              content={role.isPrimary ? "Quitar como cargo primario" : "Marcar como cargo primario"}
            >
              <IconButton
                aria-label={role.isPrimary ? "Quitar como cargo primario" : "Marcar como cargo primario"}
                size="sm"
                color={role.isPrimary ? "warning" : "neutral"}
                variant="ghost"
                onClick={() => onTogglePrimary(role.id, !role.isPrimary)}
                disabled={togglingPrimary}
              >
                <Icon icon={role.isPrimary ? PiStarFill : PiStar} size={16} />
              </IconButton>
            </Tooltip>
            {role.isPrimary && (
              <Chip color="warning" variant="soft" size="sm" startIcon={<Icon icon={PiStarFill} size={11} />}>
                Primario
              </Chip>
            )}
          </div>
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

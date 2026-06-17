// src/components/designers/UserRoleRow.tsx - FIXED VERSION
import React from "react";
import { IconButton } from "@/components/ui";
import { Icon, PiTrash } from "@/lib/icons";
import { TableTd } from "@/components";
import { useConfirmationStore } from "@/stores/confirmationStore";

interface UserRoleRowProps {
  role: {
    id: number;
    type: { name: string };
    brand?: { name: string } | null;
  };
  onDelete: (roleId: number) => void;
  deleting?: boolean;
  loading?: boolean;
}

export const UserRoleRow: React.FC<UserRoleRowProps> = ({
  role,
  onDelete,
  deleting = false,
  loading = false,
}) => {
  const { openConfirmation } = useConfirmationStore()

  return (
    <tr className="border-b border-(--color-border-default) text-sm">
      <TableTd>{loading ? "Loading..." : role.type.name}</TableTd>
      <TableTd>{loading ? "Loading..." : role.brand?.name || "Global"}</TableTd>
      <TableTd>
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
      </TableTd>
    </tr>
  );
};

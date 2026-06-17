// src/components/designers/UserRoleRow.tsx
import React, { useState } from "react";
import { IconButton, Tooltip, DeleteConfirmDialog } from "@/components/ui";
import { Switch } from "@/components/ui/choice/Switch";
import { Icon, PiTrash } from "@/lib/icons";

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
  const [confirming, setConfirming] = useState(false);

  return (
    <>
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
              onClick={() => setConfirming(true)}
              disabled={deleting}
            >
              <Icon icon={PiTrash} size={16} />
            </IconButton>
          )}
        </td>
      </tr>

      <DeleteConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          onDelete(role.id);
          setConfirming(false);
        }}
        title="Delete Role"
        description={`Are you sure you want to delete the "${role.type.name}" role${
          role.brand ? ` for "${role.brand.name}"` : " (Global)"
        }? This action cannot be undone.`}
        confirmLabel="Delete Role"
      />
    </>
  );
};

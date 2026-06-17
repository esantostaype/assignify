// src/components/designers/UserVacationRow.tsx
import React, { useState } from "react";
import { IconButton, DeleteConfirmDialog } from "@/components/ui";
import { Icon, PiTrash } from "@/lib/icons";

interface UserVacationRowProps {
  vacation: {
    id: number;
    startDate: string;
    endDate: string;
  };
  onDelete: (vacationId: number) => void;
  deleting?: boolean;
  loading?: boolean;
}

export const UserVacationRow: React.FC<UserVacationRowProps> = ({
  vacation,
  onDelete,
  deleting = false,
  loading = false,
}) => {
  const startDate = new Date(vacation.startDate);
  const endDate = new Date(vacation.endDate);
  const durationDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <tr className="border-b border-(--color-border-default) text-sm">
        <td className="p-2 first:pl-4 last:pr-4">
          {loading ? "Loading..." : startDate.toLocaleDateString()}
        </td>
        <td className="p-2 first:pl-4 last:pr-4">{loading ? "Loading..." : endDate.toLocaleDateString()}</td>
        <td className="p-2 first:pl-4 last:pr-4">{loading ? "Loading..." : `${durationDays} days`}</td>
        <td className="p-2 first:pl-4 last:pr-4">
          {loading ? (
            "Loading..."
          ) : (
            <IconButton
              aria-label="Delete vacation"
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
          onDelete(vacation.id);
          setConfirming(false);
        }}
        title="Delete Vacation"
        description={`Are you sure you want to delete the vacation from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${durationDays} days)? This action cannot be undone.`}
        confirmLabel="Delete Vacation"
      />
    </>
  );
};

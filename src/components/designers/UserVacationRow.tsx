// src/components/designers/UserVacationRow.tsx - FIXED VERSION
import React from "react";
import { IconButton } from "@/components/ui";
import { Icon, PiTrash } from "@/lib/icons";
import { TableTd } from "@/components";
import { useConfirmationStore } from "@/stores/confirmationStore";

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

  const { openConfirmation } = useConfirmationStore()

  return (
    <tr className="border-b border-(--color-border-default) text-sm">
      <TableTd>
        {loading ? "Loading..." : startDate.toLocaleDateString()}
      </TableTd>
      <TableTd>{loading ? "Loading..." : endDate.toLocaleDateString()}</TableTd>
      <TableTd>{loading ? "Loading..." : `${durationDays} days`}</TableTd>
      <TableTd>
        {loading ? (
          "Loading..."
        ) : (
          <IconButton
            aria-label="Delete vacation"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              openConfirmation({
                title: "Delete Vacation",
                description: `Are you sure you want to delete the vacation from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${durationDays} days)? This action cannot be undone.`,
                type: "danger",
                confirmText: "Delete Vacation",
                cancelText: "Cancel",
                onConfirm: () => onDelete(vacation.id),
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

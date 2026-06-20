// src/components/team/UserVacationRow.tsx
// Fila de vacación dentro del editor de miembro. Borrado DIRECTO (se confirma al
// pulsar Save y se revierte con Discard), sin diálogo de confirmación propio.
import React from "react";
import { IconButton } from "@/components/ui";
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

  return (
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
            aria-label="Remove vacation"
            size="sm"
            color="error"
            variant="soft"
            onClick={() => onDelete(vacation.id)}
            disabled={deleting}
          >
            <Icon icon={PiTrash} size={16} />
          </IconButton>
        )}
      </td>
    </tr>
  );
};

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, UserMultiple02Icon, Flag02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Card } from "@/components/shadcn/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/shadcn/avatar";
import { avatarColor } from "@/lib/avatarColor";
import { mapClickUpStatusToLocal } from "@/utils/clickup-status-mapping-utils";

interface TaskCardProps {
  task: {
    clickupId: string;
    customId?: string | null;
    name: string;
    description: string;
    status: string;
    statusColor: string;
    priority: string;
    priorityColor: string;
    assignees: Array<{
      id: string;
      name: string;
      email: string;
      initials: string;
      color: string;
      profilePicture?: string | null;
    }>;
    dueDate?: string | null;
    startDate?: string | null;
    timeEstimate?: number | null;
    tags: string[];
    list: {
      id: string;
      name: string;
    };
    space: {
      id: string;
      name: string;
    };
    url: string;
    existsInLocal: boolean;
    canSync: boolean;
  };
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${month} ${day}, ${hours}:${minutes}`;
  };

  const formatDateRange = () => {
    if (!task.dueDate) return null;
    const dueDateTime = formatDateTime(task.dueDate);
    if (task.startDate) {
      const startDateTime = formatDateTime(task.startDate);
      return `${startDateTime} - ${dueDateTime}`;
    }
    return `Due: ${dueDateTime}`;
  };

  // Color de fecha según urgencia (por TOKEN semántico, legible en light y dark).
  const getDateColor = () => {
    if (!task.dueDate) return "text-(--color-text-muted)";
    const local = mapClickUpStatusToLocal(task.status);
    // On Approval = ya entregada: su fecha nunca es "vencida".
    if (local === "ON_APPROVAL") return "text-(--color-text-subtle)";
    const diffDays = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 && local !== "IN_PROGRESS") return "text-error-600"; // Overdue
    if (diffDays <= 1) return "text-warning-600"; // Due today / soon
    return "text-(--color-text-subtle)";
  };

  const dateRange = formatDateRange();
  const dateColor = getDateColor();

  // Color de prioridad por TOKEN semántico (legible en light y dark).
  const priorityClass = (() => {
    switch ((task.priority || "").toLowerCase()) {
      case "urgent": return "text-error-600";
      case "high": return "text-warning-600";
      case "low": return "text-(--color-text-subtle)";
      case "normal":
      default: return "text-(--color-text-muted)";
    }
  })();

  return (
    <Card className="relative flex flex-col justify-between p-4">
      {/* Título */}
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">{task.name}</h3>

      {/* Lista */}
      <div className="text-xs text-muted-foreground">In {task.list.name}</div>

      {/* Asignados */}
      {task.assignees.length > 0 && (
        <div className="my-3 flex items-center gap-2">
          <HugeiconsIcon icon={UserMultiple02Icon} size={16} className="text-muted-foreground" />
          <div className="flex -space-x-2">
            {task.assignees.slice(0, 3).map((assignee, index) => (
              <Avatar
                key={assignee.id}
                title={`${assignee.name} (${assignee.email})`}
                className="size-6 ring-2 ring-card"
                style={{ zIndex: task.assignees.length - index }}
              >
                {assignee.profilePicture && <AvatarImage src={assignee.profilePicture} alt={assignee.name} />}
                <AvatarFallback className="text-[10px] text-white" style={{ backgroundColor: avatarColor(assignee.color, assignee.id) }}>
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees.length > 3 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Rango de fechas */}
      {dateRange && (
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Calendar03Icon} size={15} className="shrink-0 text-(--color-text-subtle)" />
          <span className={cn("text-[11px] font-medium leading-tight", dateColor)}>{dateRange}</span>
        </div>
      )}

      {/* Prioridad */}
      <div className="mt-3 flex items-center capitalize">
        <div className={cn("flex items-center gap-1.5 text-sm font-medium", priorityClass)}>
          <HugeiconsIcon icon={Flag02Icon} size={15} />
          <span>{task.priority}</span>
        </div>
      </div>
    </Card>
  );
};

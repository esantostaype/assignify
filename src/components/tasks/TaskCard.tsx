import React from "react";
import {
  Icon,
  PiCalendarBlank,
  PiUser,
  PiTarget,
} from "@/lib/icons";
import { Avatar } from "@/components/ui";
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
    startDate?: string | null; // ✅ NUEVO: Agregada fecha de inicio
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
  // ✅ NUEVA FUNCIÓN: Formatear fecha y hora
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}, ${hours}:${minutes}`;
  };

  // ✅ NUEVA FUNCIÓN: Crear el rango de fechas
  const formatDateRange = () => {
    if (!task.dueDate) return null;

    const dueDateTime = formatDateTime(task.dueDate);

    // Si tenemos fecha de inicio, mostrar rango
    if (task.startDate) {
      const startDateTime = formatDateTime(task.startDate);
      return `${startDateTime} - ${dueDateTime}`;
    }

    // Si no tenemos fecha de inicio, solo mostrar fecha de vencimiento
    return `Due: ${dueDateTime}`;
  };

  // ✅ NUEVA FUNCIÓN: Determinar color según urgencia
  const getDateColor = () => {
    if (!task.dueDate) return "text-(--color-text-muted)";

    const local = mapClickUpStatusToLocal(task.status);
    // On Approval = ya entregada/enviada: su fecha NO es "vencida" → color normal
    // (como una TO_DO al día), nunca rojo ni warning.
    if (local === "ON_APPROVAL") return "text-(--color-text-subtle)";

    const diffDays = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // In Progress vencida tampoco se marca en rojo (se está trabajando).
    if (diffDays < 0 && local !== "IN_PROGRESS") return "text-error-600"; // Overdue
    if (diffDays <= 1) return "text-warning-600"; // Due today / soon
    return "text-(--color-text-subtle)"; // Normal
  };

  const dateRange = formatDateRange();
  const dateColor = getDateColor();

  // Color de prioridad por TOKEN semántico (legible en light y dark), en vez del
  // color crudo de ClickUp —pálido sobre fondo blanco en light mode.
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
    <div className="p-4 rounded-lg relative border border-(--color-border-default) flex flex-col justify-between bg-(--color-surface-card)">
      {/* Task Info */}
      <h3 className="font-semibold leading-tight line-clamp-2 mb-1 text-sm">{task.name}</h3>

      {/* Space and List */}
      <div className="text-xs text-(--color-text-muted)">
        <div>In {task.list.name}</div>
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="flex items-center gap-2 my-4">
          <Icon icon={PiUser} size={16} className="text-(--color-text-muted)" />
          <div className="flex -space-x-2">
            {task.assignees.slice(0, 3).map((assignee, index) => (
              <Avatar
                key={assignee.id}
                size="xs"
                src={assignee.profilePicture || undefined}
                title={`${assignee.name} (${assignee.email})`}
                style={{
                  backgroundColor: avatarColor(assignee.color, assignee.id),
                  color: "#fff",
                  fontSize: "0.7rem",
                  zIndex: task.assignees.length - index,
                }}
              >
                <span className="mt-[2px]">{assignee.initials}</span>
              </Avatar>
            ))}
            {task.assignees.length > 3 && (
              <div className="flex items-center justify-center w-6 h-6 bg-neutral-600 rounded-full text-xs text-white">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Details */}
      <div className="space-y-2 text-sm">
        {/* ✅ NUEVA SECCIÓN: Date Range con formato mejorado */}
        {dateRange && (
          <div className="flex items-center gap-1">
            <Icon
              icon={PiCalendarBlank}
              size={16}
              className="text-(--color-text-subtle) flex-shrink-0"
            />
            <div
              className={`${dateColor} text-sm font-medium mt-[2px]`}
              style={{
                fontSize: '11px',
                lineHeight: '1.2'
              }}
            >
              {dateRange}
            </div>
          </div>
        )}
      </div>

      {/* Status and Priority Header */}
      <div className="flex items-center justify-between mt-6 capitalize">
        <div className={`flex items-center gap-1 text-sm font-medium ${priorityClass}`}>
          <span>
            <Icon
              icon={PiTarget}
              size={16}
            />
          </span>
          <span>{task.priority}</span>
        </div>
      </div>
    </div>
  );
};

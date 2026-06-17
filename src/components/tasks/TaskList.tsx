import React from "react";
import { TaskCard } from "./TaskCard";
import { Icon, PiListChecks } from "@/lib/icons";
import { TaskCardSkeleton } from "./TaskCardSkeleton";
import {
  mapClickUpStatusToLocal,
  mapLocalStatusToColumn,
  getColumnOrder,
} from "@/utils/clickup-status-mapping-utils";

interface Task {
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
  }>;
  dueDate?: string | null;
  startDate?: string | null;
  timeEstimate?: number | null;
  tags: string[];
  list: { id: string; name: string };
  space: { id: string; name: string };
  url: string;
  existsInLocal: boolean;
  canSync: boolean;
}

interface TasksListProps {
  tasks: Task[];
  loading?: boolean;
}

export const TasksList: React.FC<TasksListProps> = ({ tasks, loading = false }) => {
  const mapStatusToColumn = (status: string): string | null => {
    const localStatus = mapClickUpStatusToLocal(status);
    if (localStatus === null) return null; // completada → excluir
    return mapLocalStatusToColumn(localStatus);
  };

  const sortByDueDate = (list: Task[]): Task[] =>
    [...list].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const columnOrder = getColumnOrder();

  if (loading) {
    return (
      <div className="flex align-baseline gap-6 h-[calc(100dvh-11.375rem)]">
        {columnOrder.map((column, index) => (
          <div key={column} className="flex flex-[0_0_360px] flex-col overflow-y-auto relative pr-2">
            <div className="sticky top-0 pb-2 bg-(--color-surface-app) flex items-center justify-between z-20">
              <h2 className="font-semibold text-lg">{column}</h2>
            </div>
            <div className="flex-1 space-y-4">
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              {index === 0 && <TaskCardSkeleton />}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Excluir completadas y agrupar por columna
  const grouped = tasks.reduce((acc, task) => {
    const column = mapStatusToColumn(task.status);
    if (column) {
      if (!acc[column]) acc[column] = [];
      acc[column].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  Object.keys(grouped).forEach((c) => {
    grouped[c] = sortByDueDate(grouped[c]);
  });

  const activeCount = Object.values(grouped).reduce((n, l) => n + l.length, 0);

  if (activeCount === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Icon icon={PiListChecks} size={48} className="mx-auto mb-4 text-(--color-text-subtle)" />
          <h3 className="text-2xl font-medium mb-2">No active tasks</h3>
          <p className="text-(--color-text-subtle)">Las tareas activas de ClickUp aparecerán aquí.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex align-baseline gap-6 h-[calc(100dvh-11.375rem)]">
      {columnOrder.map((column) => (
        <div key={column} className="flex flex-[0_0_360px] flex-col overflow-y-auto relative pr-2">
          <div className="sticky top-0 pb-2 bg-(--color-surface-app) flex items-center justify-between z-20">
            <h2 className="font-semibold text-lg">{column}</h2>
            <span className="bg-primary-500/20 text-primary-600 text-xs px-2 py-1 rounded-full">
              {grouped[column]?.length || 0}
            </span>
          </div>
          <div className="flex-1 space-y-4">
            {grouped[column]?.length ? (
              grouped[column].map((task) => (
                <TaskCard key={task.clickupId} task={task} />
              ))
            ) : (
              <div className="text-center text-(--color-text-muted) text-sm py-8">
                No {column.toLowerCase()} tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

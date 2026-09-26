"use client";
import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon, Task01Icon } from "@hugeicons/core-free-icons";
import { TaskCard } from "./TaskCard";
import { TaskCardSkeleton } from "./TaskCardSkeleton";
import { Badge } from "@/components/shadcn/badge";
import { Skeleton } from "@/components/shadcn/skeleton";
import { SmoothScroll } from "@/components/SmoothScroll";
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

type SortDir = "asc" | "desc";

export const TasksList: React.FC<TasksListProps> = ({ tasks, loading = false }) => {
  // Orden por columna (fecha de entrega). Default: ON APPROVAL muestra las más
  // nuevas arriba (desc); las demás, las que vencen antes arriba (asc).
  const [order, setOrder] = useState<Record<string, SortDir>>(() => {
    const init: Record<string, SortDir> = {};
    getColumnOrder().forEach((c) => {
      init[c] = c === "ON APPROVAL" ? "desc" : "asc";
    });
    return init;
  });

  const mapStatusToColumn = (status: string): string | null => {
    const localStatus = mapClickUpStatusToLocal(status);
    if (localStatus === null) return null; // completada → excluir
    return mapLocalStatusToColumn(localStatus);
  };

  // Ordena por dueDate; las tareas sin fecha siempre al final. `dir` invierte el orden.
  const sortTasks = (list: Task[], dir: SortDir): Task[] =>
    [...list].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return dir === "asc" ? diff : -diff;
    });

  const toggleOrder = (col: string) =>
    setOrder((o) => ({ ...o, [col]: (o[col] ?? "asc") === "asc" ? "desc" : "asc" }));

  const columnOrder = getColumnOrder();

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
        {columnOrder.map((column, index) => (
          <div key={column} className="flex flex-[0_0_280px] flex-col">
            <SmoothScroll preventParentLenis className="flex-1">
              <div className="pr-2">
                <div className="sticky top-0 z-20 flex items-center justify-between bg-(--color-surface-app) pb-2">
                  {/* Misma estructura que con datos (text-sm + badge) para que el header no "salte". */}
                  <h2 className="text-sm font-semibold">{column}</h2>
                  <Skeleton className="h-6 w-7 rounded-full" />
                </div>
                <div className="space-y-2">
                  <TaskCardSkeleton />
                  <TaskCardSkeleton />
                  {index === 0 && <TaskCardSkeleton />}
                </div>
              </div>
            </SmoothScroll>
          </div>
        ))}
      </div>
    );
  }

  // Excluir completadas y agrupar por columna (el orden se aplica al renderizar).
  const grouped = tasks.reduce((acc, task) => {
    const column = mapStatusToColumn(task.status);
    if (column) {
      if (!acc[column]) acc[column] = [];
      acc[column].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const activeCount = Object.values(grouped).reduce((n, l) => n + l.length, 0);

  if (activeCount === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon icon={Task01Icon} size={24} />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No active tasks</h3>
          <p className="text-sm text-muted-foreground">Active ClickUp tasks will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
      {columnOrder.map((column) => {
        const dir = order[column] ?? "asc";
        const list = sortTasks(grouped[column] || [], dir);
        return (
          <div key={column} className="flex flex-[0_0_280px] flex-col">
            <SmoothScroll preventParentLenis className="flex-1">
              <div className="pr-2">
                <div className="sticky top-0 z-20 flex items-center justify-between bg-(--color-surface-app) pb-2">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold">{column}</h2>
                    {/* Sort por fecha de entrega (alterna asc/desc), como en un DataTable. */}
                    <button
                      type="button"
                      onClick={() => toggleOrder(column)}
                      title={dir === "asc" ? "Earliest due first — click for latest" : "Latest due first — click for earliest"}
                      aria-label="Sort by due date"
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <HugeiconsIcon icon={dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon} size={14} />
                    </button>
                  </div>
                  <Badge variant="default">{list.length}</Badge>
                </div>
                <div className="space-y-2">
                  {list.length ? (
                    list.map((task) => <TaskCard key={task.clickupId} task={task} />)
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No {column.toLowerCase()} tasks
                    </div>
                  )}
                </div>
              </div>
            </SmoothScroll>
          </div>
        );
      })}
    </div>
  );
};

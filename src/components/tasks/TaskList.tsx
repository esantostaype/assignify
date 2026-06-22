"use client";
import React, { useState } from "react";
import { TaskCard } from "./TaskCard";
import { Icon, PiListChecks, PiArrowUp, PiArrowDown } from "@/lib/icons";
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

type SortDir = "asc" | "desc";

export const TasksList: React.FC<TasksListProps> = ({ tasks, loading = false }) => {
  // Orden por columna (por fecha de entrega). Default: ON APPROVAL muestra las más
  // NUEVAS arriba (desc); las demás, las que vencen ANTES arriba (asc). El icono del
  // título lo alterna, al estilo de las columnas ordenables de un DataTable.
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
      <div className="flex align-baseline gap-4 h-[calc(100dvh-11.375rem)]">
        {columnOrder.map((column, index) => (
          <div key={column} className="flex flex-[0_0_280px] flex-col overflow-y-auto relative pr-2">
            <div className="sticky top-0 pb-2 flex items-center justify-between z-20 bg-neutral-100">
              {/* Mismo tamaño/estructura que con datos (text-sm + badge) para que el
                  header no "salte" al cargar. */}
              <h2 className="font-semibold text-sm">{column}</h2>
              <span className="h-6 w-7 rounded-full bg-(--color-surface-hover) animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <TaskCardSkeleton />
              <TaskCardSkeleton />
              {index === 0 && <TaskCardSkeleton />}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Excluir completadas y agrupar por columna (el ORDEN se aplica al renderizar).
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Icon icon={PiListChecks} size={48} className="mx-auto mb-4 text-(--color-text-subtle)" />
          <h3 className="text-2xl font-medium mb-2">No active tasks</h3>
          <p className="text-(--color-text-subtle)">Active ClickUp tasks will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex align-baseline gap-4 h-[calc(100dvh-11.375rem)]">
      {columnOrder.map((column) => {
        const dir = order[column] ?? "asc";
        const list = sortTasks(grouped[column] || [], dir);
        return (
          <div key={column} className="flex flex-[0_0_280px] flex-col overflow-y-auto relative pr-2">
            <div className="sticky top-0 pb-2 bg-neutral-100 flex items-center justify-between z-20">
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-sm">{column}</h2>
                {/* Sort por fecha de entrega (alterna asc/desc), como en un DataTable. */}
                <button
                  type="button"
                  onClick={() => toggleOrder(column)}
                  title={dir === "asc" ? "Earliest due first — click for latest" : "Latest due first — click for earliest"}
                  aria-label="Sort by due date"
                  className="rounded p-0.5 text-(--color-text-muted) transition-colors hover:bg-(--color-surface-hover) hover:text-(--color-text-strong)"
                >
                  <Icon icon={dir === "asc" ? PiArrowUp : PiArrowDown} size={14} />
                </button>
              </div>
              <span className="bg-(--color-surface-header) text-primary-600 text-xs px-2 py-1 rounded-full">
                {list.length}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {list.length ? (
                list.map((task) => <TaskCard key={task.clickupId} task={task} />)
              ) : (
                <div className="text-center text-(--color-text-muted) text-sm py-8">
                  No {column.toLowerCase()} tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

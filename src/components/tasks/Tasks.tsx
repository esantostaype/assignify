"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { hotToast as toast } from "@/lib/hotToast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, RefreshIcon, Alert01Icon } from "@hugeicons/core-free-icons";
import { TasksList } from "./TaskList";
import { AssigneeFilter, type AssigneeOption } from "./AssigneeFilter";
import { useClickUpTasks, useRefreshTasks } from "@/hooks/queries/useTasks";
import { useClickUpUsers } from "@/hooks/queries/useUsers";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/shadcn/input";
import { Button } from "@/components/shadcn/button";

export const TasksSync: React.FC = () => {
  const [search, setSearch] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const { data: session } = useSession();
  const myId = session?.user?.id;

  const { data: tasksData, isLoading: loadingTasks, error: tasksError } = useClickUpTasks();
  const { data: usersData } = useClickUpUsers();

  // Miembros del team para el filtro (con foto/color/iniciales de ClickUp).
  const users: AssigneeOption[] = useMemo(
    () =>
      (usersData?.clickupUsers ?? []).map((u) => ({
        clickupId: u.clickupId,
        name: u.name,
        email: u.email,
        profilePicture: u.profilePicture,
        initials: u.initials,
        color: u.color,
      })),
    [usersData]
  );

  // Por defecto el filtro arranca con el usuario LOGUEADO seleccionado (una sola vez,
  // cuando ya llegaron su id y la lista del team). Si su id no está en el team, "todas".
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!myId || users.length === 0) return;
    seeded.current = true;
    if (users.some((u) => u.clickupId === myId)) setAssigneeIds([myId]);
  }, [myId, users]);

  const { mutate: refreshTasks } = useRefreshTasks({
    onSuccess: () => toast.success({ title: "Tasks updated", description: "Synced from ClickUp." }),
    onError: () => toast.error({ title: "Failed to update tasks", description: "Try again in a moment." }),
  });

  const tasks = useMemo(() => {
    const all = tasksData?.clickupTasks || [];
    const byName = search
      ? all.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
      : all;
    // Sin asignados seleccionados = todas las tareas; si hay, solo las de esos miembros.
    if (assigneeIds.length === 0) return byName;
    const set = new Set(assigneeIds);
    return byName.filter((t) => t.assignees?.some((a) => set.has(a.id)));
  }, [tasksData, search, assigneeIds]);

  if (tasksError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive">
            <HugeiconsIcon icon={Alert01Icon} size={24} />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Failed to load data</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tasksError.message || "Unknown error"}</p>
          <Button variant="secondary" className="mt-4 gap-2" onClick={() => refreshTasks()}>
            <HugeiconsIcon icon={RefreshIcon} size={16} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabecera unificada (título + filtro de asignados + buscador). El refresco lo
          cubre el realtime/webhook; el tema vive en el sidebar. */}
      <PageHeader
        title="Tasks"
        description="Live tasks from ClickUp — grouped by status."
        actions={
          <>
            <AssigneeFilter users={users} selected={assigneeIds} onChange={setAssigneeIds} />
            <div className="relative w-full sm:w-64">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        <TasksList tasks={tasks} loading={loadingTasks} />
      </div>
    </div>
  );
};

"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { hotToast as toast } from "@/lib/hotToast";
import { TasksList } from "./TaskList";
import { AssigneeFilter, type AssigneeOption } from "./AssigneeFilter";
import { useClickUpTasks, useRefreshTasks } from "@/hooks/queries/useTasks";
import { useClickUpUsers } from "@/hooks/queries/useUsers";
import { PageHeader } from "@/components/PageHeader";
import { Input, Button, EmptyState } from "@/components/ui";
import {
  Icon,
  PiArrowsClockwise,
  PiMagnifyingGlass,
  PiListChecks,
} from "@/lib/icons";

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

  // Por defecto el filtro arranca con el usuario LOGUEADO seleccionado (una sola vez, cuando
  // ya llegaron su id y la lista del team). Si su id no está en el team, se deja "todas".
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
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={PiListChecks}
          title="Failed to load data"
          description={tasksError.message || "Unknown error"}
          action={
            <Button variant="soft" startIcon={<Icon icon={PiArrowsClockwise} />} onClick={() => refreshTasks()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Cabecera unificada (título + filtro de asignados + buscador). El refresco lo cubre
          el realtime/webhook; el tema vive en el menú de usuario del header. */}
      <PageHeader
        title="Tasks"
        actions={<AssigneeFilter users={users} selected={assigneeIds} onChange={setAssigneeIds} />}
      >
        <Input
          size="sm"
          fullWidth
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
        />
      </PageHeader>

      <div className="flex flex-1 flex-col p-4 md:p-6 min-h-0">
        <TasksList tasks={tasks} loading={loadingTasks} />
      </div>
    </div>
  );
};

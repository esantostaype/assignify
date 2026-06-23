"use client";
import React, { useState, useMemo } from "react";
import { hotToast as toast } from "@/lib/hotToast";
import { TasksList } from "./TaskList";
import { useClickUpTasks, useRefreshTasks } from "@/hooks/queries/useTasks";
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

  const { data: tasksData, isLoading: loadingTasks, error: tasksError } = useClickUpTasks();

  const { mutate: refreshTasks } = useRefreshTasks({
    onSuccess: () => toast.success({ title: "Tasks updated", description: "Synced from ClickUp." }),
    onError: () => toast.error({ title: "Failed to update tasks", description: "Try again in a moment." }),
  });

  const tasks = useMemo(() => {
    const all = tasksData?.clickupTasks || [];
    if (!search) return all;
    return all.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [tasksData, search]);

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
    <div className="flex flex-col h-full">
      {/* Cabecera unificada (título + buscador). El refresco lo cubre el realtime/webhook;
          el tema vive en el menú de usuario del header. */}
      <PageHeader title="Tasks">
        <Input
          size="sm"
          fullWidth
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
        />
      </PageHeader>

      <div className="flex flex-1 flex-col p-6">
        <TasksList tasks={tasks} loading={loadingTasks} />
      </div>
    </div>
  );
};

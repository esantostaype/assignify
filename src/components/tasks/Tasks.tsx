"use client";
import React, { useState, useMemo } from "react";
import { Button, IconButton, Tooltip, Input } from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, TaskIcon } from "@hugeicons/core-free-icons";
import { TasksList } from "./TaskList";
import { toast } from "react-toastify";
import { useClickUpTasks, useRefreshTasks } from "@/hooks/queries/useTasks";

export const TasksSync: React.FC = () => {
  const [search, setSearch] = useState("");

  const { data: tasksData, isLoading: loadingTasks, error: tasksError } = useClickUpTasks();

  const { mutate: refreshTasks, isPending: refreshing } = useRefreshTasks({
    onSuccess: () => toast.success("Tasks refreshed"),
    onError: () => toast.error("Error refreshing tasks"),
  });

  const tasks = useMemo(() => {
    const all = tasksData?.clickupTasks || [];
    if (!search) return all;
    return all.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [tasksData, search]);

  const handleTaskEdit = (taskId: string) => {
    const task = tasksData?.clickupTasks.find((t) => t.clickupId === taskId);
    if (task?.url) window.open(task.url, "_blank");
  };

  if (tasksError) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon icon={TaskIcon} size={48} className="mx-auto mb-4 text-red-400" />
          <h3 className="text-2xl font-medium mb-2 text-red-400">Error Loading Data</h3>
          <p className="text-gray-400 mb-4">{tasksError.message || "Unknown error"}</p>
          <Button
            variant="soft"
            color="primary"
            onClick={() => refreshTasks()}
            startDecorator={<HugeiconsIcon icon={RefreshIcon} size={16} />}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-16 bg-background/70 backdrop-blur-lg z-50">
        <div className="p-4 flex items-center justify-between border-b border-b-white/10">
          <h1 className="flex items-center gap-2 text-2xl font-medium">
            <HugeiconsIcon icon={TaskIcon} size={32} strokeWidth={1} />
            ClickUp Tasks
          </h1>
          <div className="flex items-center gap-3">
            <Input
              size="sm"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 220 }}
            />
            <Tooltip title="Refresh tasks from ClickUp">
              <IconButton size="sm" variant="soft" onClick={() => refreshTasks()} loading={refreshing}>
                <HugeiconsIcon icon={RefreshIcon} size={16} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <TasksList tasks={tasks} loading={loadingTasks} onTaskEdit={handleTaskEdit} />
      </div>
    </div>
  );
};

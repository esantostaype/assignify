"use client";
import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { TasksList } from "./TaskList";
import { useClickUpTasks, useRefreshTasks } from "@/hooks/queries/useTasks";
import { Input, IconButton, Button, Tooltip, EmptyState } from "@/components/ui";
import {
  Icon,
  PiArrowsClockwise,
  PiMagnifyingGlass,
  PiListChecks,
  PiSun,
  PiMoon,
} from "@/lib/icons";
import { useUiTheme } from "@/providers/UiThemeProvider";

export const TasksSync: React.FC = () => {
  const [search, setSearch] = useState("");
  const { theme, toggleTheme } = useUiTheme();

  const { data: tasksData, isLoading: loadingTasks, error: tasksError } = useClickUpTasks();

  const { mutate: refreshTasks, isPending: refreshing } = useRefreshTasks({
    onSuccess: () => toast.success("Tasks updated"),
    onError: () => toast.error("Failed to update tasks"),
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
      <div className="sticky top-16 z-50 bg-(--color-surface-app)/70 backdrop-blur-lg">
        <div className="flex items-center justify-between border-b border-(--color-border-default) p-4">
          <h1 className="flex items-center gap-2 text-2xl font-medium text-(--color-text-strong)">
            <Icon icon={PiListChecks} size={28} />
            ClickUp Tasks
          </h1>
          <div className="flex items-center gap-3">
            <Input
              size="sm"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
            />
            <Tooltip content="Refresh from ClickUp">
              <IconButton
                aria-label="Refresh"
                variant="soft"
                color="neutral"
                size="sm"
                onClick={() => refreshTasks()}
                disabled={refreshing}
              >
                <Icon icon={PiArrowsClockwise} />
              </IconButton>
            </Tooltip>
            <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
              <IconButton
                aria-label="Toggle theme"
                variant="ghost"
                color="neutral"
                size="sm"
                onClick={toggleTheme}
              >
                <Icon icon={theme === "dark" ? PiSun : PiMoon} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <TasksList tasks={tasks} loading={loadingTasks} />
      </div>
    </div>
  );
};

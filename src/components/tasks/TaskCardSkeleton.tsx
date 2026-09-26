// src/components/tasks/TaskCardSkeleton.tsx
import { Skeleton } from "@/components/shadcn/skeleton";

// Refleja la forma de TaskCard: título (2 líneas), lista, asignados, fecha, prioridad.
export const TaskCardSkeleton = () => (
  <div className="rounded-xl bg-card p-4">
    {/* Título */}
    <Skeleton className="h-3.5 w-4/5" />
    <Skeleton className="mt-1.5 h-3.5 w-3/5" />

    {/* Lista */}
    <Skeleton className="mt-2 h-2.5 w-2/5" />

    {/* Asignados */}
    <div className="my-3 flex items-center gap-2">
      <Skeleton className="size-4 rounded-full" />
      <Skeleton className="size-6 rounded-full" />
    </div>

    {/* Fecha */}
    <div className="flex items-center gap-2">
      <Skeleton className="size-4 rounded-full" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>

    {/* Prioridad */}
    <div className="mt-3 flex items-center gap-2">
      <Skeleton className="size-4 rounded-full" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  </div>
);

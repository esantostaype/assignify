// src/components/tasks/TaskCardSkeleton.tsx
import { Skeleton } from '@/components/ui'

// Refleja la forma de TaskCard: título (2 líneas), lista, asignados, fecha, prioridad.
export const TaskCardSkeleton = () => (
  <div className="p-4 rounded-lg bg-(--color-surface-card)">
    {/* Título */}
    <Skeleton variant="text" height={14} width="80%" />
    <Skeleton variant="text" height={14} width="55%" className="mt-1.5" />

    {/* Lista */}
    <Skeleton variant="text" height={10} width="35%" className="mt-2" />

    {/* Asignados */}
    <div className="flex items-center gap-2 my-3">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="circle" width={24} height={24} />
    </div>

    {/* Fecha */}
    <div className="flex items-center gap-2">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="text" height={10} width="50%" />
    </div>

    {/* Prioridad */}
    <div className="mt-3 flex items-center gap-2">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="text" width="30%" />
    </div>
  </div>
)

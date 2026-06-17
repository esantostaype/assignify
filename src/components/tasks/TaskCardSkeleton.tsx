// src/components/tasks/TaskCardSkeleton.tsx
import { Skeleton } from '@/components/ui'

// Refleja la forma de TaskCard: título (2 líneas), lista, asignados, fecha, prioridad.
export const TaskCardSkeleton = () => (
  <div className="p-4 rounded-lg bg-primary-500/10 border-2 border-transparent flex flex-col">
    {/* Título */}
    <Skeleton variant="text" height={16} width="80%" />
    <Skeleton variant="text" height={16} width="55%" className="mt-1.5" />

    {/* Lista */}
    <Skeleton variant="text" width="35%" className="mt-3" />

    {/* Asignados */}
    <div className="flex items-center gap-2 my-4">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="circle" width={24} height={24} />
    </div>

    {/* Fecha */}
    <div className="flex items-center gap-2">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="text" width="50%" />
    </div>

    {/* Prioridad */}
    <div className="mt-6 flex items-center gap-2">
      <Skeleton variant="circle" width={16} height={16} />
      <Skeleton variant="text" width="30%" />
    </div>
  </div>
)

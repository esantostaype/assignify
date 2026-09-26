// src/components/team/MemberCardSkeleton.tsx
// Refleja SyncedMemberCard: cabecera (avatar + nombre/puesto + editar), barra de
// carga (label + valor + barra) y línea de disponibilidad con el chip de estado.
import { Skeleton } from "@/components/shadcn/skeleton";

export const MemberCardSkeleton = () => (
  <div className="flex flex-col justify-between gap-4 rounded-xl bg-card p-4">
    {/* Cabecera: avatar + nombre/puesto + botón editar */}
    <div className="flex items-start gap-3">
      <Skeleton className="size-11 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5 pt-1">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="size-8 rounded-md" />
    </div>

    {/* Carga: label + valor + barra */}
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-9" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>

    {/* Disponibilidad + chip de estado */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  </div>
);

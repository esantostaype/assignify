// src/components/team/MemberCardSkeleton.tsx
// UN único skeleton que refleja SyncedMemberCard: cabecera (avatar + nombre /
// puesto + botón editar), barra de carga (label + valor + barra) y línea de
// disponibilidad con el chip de estado. Sin email (la tarjeta ya no lo muestra).
import { Card, Skeleton } from '@/components/ui'

export const MemberCardSkeleton = () => (
  <Card variant="outlined" padding="md" className="flex flex-col gap-3">
    {/* Cabecera: avatar + nombre/puesto + botón editar */}
    <div className="flex items-start gap-3">
      <Skeleton variant="circle" width={44} height={44} />
      <div className="flex flex-1 flex-col gap-1.5 pt-1">
        <Skeleton variant="text" width="55%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <Skeleton variant="rect" width={32} height={32} className="rounded-md" />
    </div>

    {/* Carga: label + valor + barra */}
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={36} />
        <Skeleton variant="text" width={88} />
      </div>
      <Skeleton variant="rect" height={8} className="rounded-full" />
    </div>

    {/* Disponibilidad + chip de estado */}
    <div className="flex items-center justify-between">
      <Skeleton variant="text" width="45%" />
      <Skeleton variant="rect" width={56} height={22} className="rounded-full" />
    </div>
  </Card>
)

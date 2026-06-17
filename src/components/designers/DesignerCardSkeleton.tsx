// src/components/designers/DesignerCardSkeleton.tsx
import { Card, Skeleton } from '@/components/ui'

// Refleja la forma de SyncedDesignerCard: cabecera (avatar + nombre/roles + chip),
// email, barra de carga y línea de disponibilidad.
export const DesignerCardSkeleton = () => (
  <Card variant="outlined" padding="md" className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <Skeleton variant="circle" width={44} height={44} />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <Skeleton variant="rect" width={72} height={22} className="rounded-full" />
    </div>

    <Skeleton variant="text" width="55%" />

    <Skeleton variant="rect" height={8} className="rounded-full" />
    <Skeleton variant="text" width="50%" />
  </Card>
)

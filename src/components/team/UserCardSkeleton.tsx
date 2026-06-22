// src/components/team/UserCardSkeleton.tsx
// Skeleton que refleja UserCard (tarjeta compacta de "Available to sync"):
// checkbox + avatar + nombre + estado. Misma altura/estructura que la tarjeta real.
import { Skeleton } from '@/components/ui'

export const UserCardSkeleton = () => (
  <div className="flex items-center gap-3 rounded-lg border-2 border-transparent bg-(--color-surface-header) p-3">
    <Skeleton variant="rect" width={18} height={18} className="rounded" />
    <Skeleton variant="circle" width={44} height={44} />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="35%" />
    </div>
  </div>
)

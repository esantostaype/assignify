// src/components/designers/DesignerCardSkeleton.tsx
import { Skeleton } from '@/components/ui'

// Refleja la forma de UserCard: avatar, nombre, estado, email, id y "Active".
export const DesignerCardSkeleton = () => (
  <div className="p-6 rounded-lg bg-primary-500/10 border-2 border-transparent flex flex-col items-center gap-4">
    <Skeleton variant="circle" width={80} height={80} />

    <div className="flex flex-col items-center gap-2">
      <Skeleton variant="text" width={140} height={18} />
      <Skeleton variant="text" width={90} />
    </div>

    <div className="flex w-full flex-col items-center gap-2">
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text" width="45%" />
    </div>

    <Skeleton variant="text" width={100} />
  </div>
)

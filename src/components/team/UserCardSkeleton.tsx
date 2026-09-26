// src/components/team/UserCardSkeleton.tsx
// Skeleton que refleja UserCard (tarjeta compacta de "Available to sync").
import { Skeleton } from "@/components/shadcn/skeleton";

export const UserCardSkeleton = () => (
  <div className="flex items-center gap-3 rounded-lg bg-card p-3">
    <Skeleton className="size-4 rounded" />
    <Skeleton className="size-11 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  </div>
);

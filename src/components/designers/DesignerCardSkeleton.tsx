export const DesignerCardSkeleton: React.FC = () => {
  return (
    <div className="p-6 rounded-lg bg-primary-500/10 border-2 border-transparent animate-pulse">
      {/* Selection checkbox */}
      <div className="absolute top-4 left-4">
        <div className="w-4 h-4 bg-(--color-surface-hover) rounded"></div>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 bg-(--color-surface-hover) rounded-full"></div>

        {/* User Info */}
        <div className="flex-1 text-center space-y-2">
          <div className="h-5 bg-(--color-surface-hover) rounded w-32 mx-auto"></div>
          <div className="flex items-center gap-1 justify-center">
            <div className="w-4 h-4 bg-(--color-surface-hover) rounded"></div>
            <div className="h-3 bg-(--color-surface-hover) rounded w-16"></div>
          </div>
        </div>

        {/* User Details */}
        <div className="space-y-2 w-full">
          <div className="flex items-center gap-1 justify-center">
            <div className="w-4 h-4 bg-(--color-surface-hover) rounded"></div>
            <div className="h-3 bg-(--color-surface-hover) rounded w-32"></div>
          </div>
          <div className="flex items-center gap-1 justify-center">
            <div className="w-4 h-4 bg-(--color-surface-hover) rounded"></div>
            <div className="h-3 bg-(--color-surface-hover) rounded w-20"></div>
          </div>
        </div>

        {/* Last Active */}
        <div className="h-3 bg-(--color-surface-hover) rounded w-24"></div>
      </div>
    </div>
  );
};
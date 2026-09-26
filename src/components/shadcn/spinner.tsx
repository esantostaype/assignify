import { cn } from '@/lib/utils'

// Spinner minimal (borde girando). Para estados de carga en botones/acciones, ya que
// shadcn Button no trae `loading`: renderizarlo como primer hijo del Button.
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  )
}

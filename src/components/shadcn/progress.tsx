import * as React from 'react'
import { cn } from '@/lib/utils'

// Barra de progreso simple (track sólido sutil + relleno). Soporta color semántico
// porque el Team la usa para el estado de carga (success/primary/error/warning).
type ProgressColor = 'primary' | 'success' | 'error' | 'warning'

const BAR: Record<ProgressColor, string> = {
  primary: 'bg-primary',
  success: 'bg-success-500',
  error: 'bg-error-500',
  warning: 'bg-warning-500',
}

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  color?: ProgressColor
}

export function Progress({ value = 0, color = 'primary', className, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-foreground/10', className)}
      {...props}
    >
      <div className={cn('h-full rounded-full transition-all', BAR[color])} style={{ width: `${pct}%` }} />
    </div>
  )
}

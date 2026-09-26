'use client'
// Alert shadcn (soft = tinte del tono + alpha). API pensada para reemplazar el Alert
// viejo: <Alert tone icon iconSize align>{children}</Alert>.
import * as React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import { cn } from '@/lib/utils'

type AlertTone = 'default' | 'error' | 'warning' | 'success'

const TONE: Record<AlertTone, string> = {
  default: 'bg-primary/10 text-foreground',
  error: 'bg-destructive/12 text-destructive',
  warning: 'bg-warning-500/12 text-warning-600',
  success: 'bg-success-500/12 text-success-600',
}
const ICON_TONE: Record<AlertTone, string> = {
  default: 'text-primary',
  error: 'text-destructive',
  warning: 'text-warning-600',
  success: 'text-success-600',
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
  icon?: IconSvgElement
  iconSize?: number
  align?: 'start' | 'center'
}

export function Alert({ tone = 'default', icon, iconSize = 18, align = 'start', className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg p-3.5 text-sm', align === 'center' ? 'items-center' : 'items-start', TONE[tone], className)}
      {...props}
    >
      {icon && (
        <HugeiconsIcon
          icon={icon}
          size={iconSize}
          className={cn('shrink-0', ICON_TONE[tone], align === 'start' && 'mt-0.5')}
        />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

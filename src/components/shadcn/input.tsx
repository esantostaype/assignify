import * as React from 'react'
import { cn } from '@/lib/utils'

// Input shadcn adaptado al sistema borderless de la app: superficie sólida sutil
// (bg-secondary = surface-subtle) sin borde, foco con anillo del acento. Para el
// patrón "buscador con icono", envolver en un relative y posicionar el icono
// absolute (pl-9 en el input), como hace el idiom de shadcn.
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md bg-secondary px-3 py-1 text-sm text-foreground shadow-sm transition-[color,box-shadow]',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }

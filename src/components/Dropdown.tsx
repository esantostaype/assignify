'use client'
// Dropdown ligero (trigger + panel flotante) con cierre por click-fuera y Escape.
// Mismo patrón que la intranet; se usa para el menú de usuario y el de workspaces.
// El Popover de @/components/ui centra el panel (left-1/2) y no se puede realinear
// con className porque `cn` no resuelve conflictos de Tailwind — por eso este propio.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface DropdownProps {
  trigger: ReactNode
  /** Contenido del panel. Si es función, recibe `close` para cerrarlo desde dentro. */
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  /** Clases extra del panel (p.ej. ancho). */
  className?: string
  triggerClassName?: string
  ariaLabel?: string
}

export const Dropdown = ({
  trigger,
  children,
  align = 'right',
  className,
  triggerClassName,
  ariaLabel,
}: DropdownProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn('inline-flex items-center', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-[60] mt-2 overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-surface-raised) shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

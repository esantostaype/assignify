'use client'
// Dropdown ligero (trigger + panel flotante) con cierre por click-fuera y Escape,
// y animación de entrada/salida (fade + slide) como la intranet. Mismo lifecycle
// mounted/visible que los popovers de @/components/ui para que el panel se anime al
// salir antes de desmontarse. Es propio (no el Popover de ui) porque ese centra el
// panel y `cn` no resuelve conflictos de Tailwind para realinearlo.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const EXIT_MS = 150

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
  const [mounted, setMounted] = useState(false) // en el DOM (incluye salida)
  const [visible, setVisible] = useState(false) // estado animado (entrada)
  const ref = useRef<HTMLDivElement>(null)

  // Montaje/animación: al abrir, monta y entra en el siguiente frame; al cerrar,
  // dispara la salida y desmonta tras la transición.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  // Cierre por click-fuera / Escape (solo mientras está abierto).
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
      {mounted && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-[80] mt-2 origin-top overflow-hidden rounded-lg border border-(--color-border-default) bg-(--color-surface-raised) shadow-lg',
            'transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]',
            visible ? 'opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 -translate-y-1 scale-[0.98]',
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

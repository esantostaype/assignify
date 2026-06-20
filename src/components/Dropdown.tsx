'use client'
// Dropdown ligero (trigger + panel flotante) con cierre por click-fuera y Escape.
// La transición replica EXACTAMENTE la del menú del header de la intranet:
//   enter 220ms / exit 160ms · cubic-bezier(0.32,0.72,0,1) · opacity + translateY(-8px).
// Doble requestAnimationFrame para que el frame inicial (opacity-0) se pinte antes
// de entrar (si no, "salta"). Fondo surface-card (no raised): en dark, raised/hover/
// border son todos neutral-300 y el hover/dividers quedaban invisibles.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const ENTER_MS = 220
const EXIT_MS = 160
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

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
  const [mounted, setMounted] = useState(false) // en el DOM (incluye la salida)
  const [visible, setVisible] = useState(false) // estado animado (entrada)
  const enterScheduled = useRef(false)
  const ref = useRef<HTMLDivElement>(null)

  // Montaje/desmontaje: al cerrar, deja que la animación de salida corra antes de
  // quitar el elemento (igual que Modal/Drawer/menú de la intranet).
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    setVisible(false)
    enterScheduled.current = false
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  // Entrada: una vez montado, doble rAF para pintar el frame off-screen antes de
  // pasar al on-screen.
  useEffect(() => {
    if (!mounted || enterScheduled.current) return
    enterScheduled.current = true
    let id2 = 0
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(id1)
      if (id2) cancelAnimationFrame(id2)
      enterScheduled.current = false
    }
  }, [mounted])

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

  const duration = visible ? ENTER_MS : EXIT_MS

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
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -8px, 0)',
            transition: `opacity ${duration}ms ${EASE}, transform ${duration}ms ${EASE}`,
          }}
          className={cn(
            'absolute top-full z-[80] mt-2 overflow-hidden rounded-lg border border-neutral-300 dark:bg-neutral-100 shadow-lg',
            !visible && 'pointer-events-none',
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

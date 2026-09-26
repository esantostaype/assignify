'use client'
// Sidebar tipo dashboard. Colapsable: expandido = logo + iconos + labels; colapsado
// = isotipo + solo iconos (con tooltip nativo). El estado se persiste en localStorage.
// Fondo transparente (hereda el frame #09090B). Iconos hugeicons.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Queue01Icon,
  UserGroup03Icon,
  Analytics01Icon,
  SwatchIcon,
  Folder01Icon,
  Settings01Icon,
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Sun03Icon,
  Moon02Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { UserMenu } from '@/components/UserMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useUiTheme } from '@/providers/UiThemeProvider'
import { useCreateTaskDrawer } from '@/hooks/useCreateTaskDrawer'

const SECTIONS: { title: string; items: { href: string; label: string; icon: IconSvgElement }[] }[] = [
  {
    title: 'Platform',
    items: [
      { href: '/', label: 'Tasks', icon: Queue01Icon },
      { href: '/team', label: 'Team', icon: UserGroup03Icon },
      { href: '/reports', label: 'Reports', icon: Analytics01Icon },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { href: '/types', label: 'Types', icon: SwatchIcon },
      { href: '/lists', label: 'Lists', icon: Folder01Icon },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/settings', label: 'Settings', icon: Settings01Icon }],
  },
]

export const Sidebar = () => {
  const pathname = usePathname() ?? '/'
  const { user } = useAuth()
  const { theme, toggleTheme } = useUiTheme()
  const openCreate = useCreateTaskDrawer((s) => s.setOpen)
  const [collapsed, setCollapsed] = useState(false)

  // Default RESPONSIVO: por debajo de xl (1280px) el menú arranca COMPACTO; en ≥1280
  // expandido. La flechita alterna a mano; al cruzar el breakpoint vuelve al default.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const apply = () => setCollapsed(!mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const toggle = () => setCollapsed((c) => !c)

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  // Toggle minimalista: chevron dentro de un círculo pequeño, flotando en el BORDE
  // derecho del sidebar (entre sidebar y content), no pegado al logo.
  const toggleBtn = (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="absolute -right-3 top-5 z-40 grid size-6 place-items-center rounded-full bg-(--color-surface-raised) text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:text-foreground"
    >
      <HugeiconsIcon icon={collapsed ? ArrowRight01Icon : ArrowLeft01Icon} size={14} />
    </button>
  )

  return (
    <aside
      className={cn(
        // z-40: el aside (y su toggle flotante) debe pintar POR ENCIMA del panel de
        // content (la <section> va después en el DOM y si no lo taparía).
        'sticky top-0 z-40 hidden h-dvh shrink-0 flex-col bg-transparent transition-[width] duration-200 ease-(--ease-app) md:flex',
        collapsed ? 'w-[3.75rem]' : 'w-60'
      )}
    >
      {/* Toggle flotante (círculo con chevron) en el borde derecho */}
      {toggleBtn}

      {/* Header: logo (expandido, izquierda) o isotipo (colapsado, CENTRADO con los ítems) */}
      {collapsed ? (
        <div className="flex h-16 items-center justify-center">
          <Logo iso width={20} height={20} className="h-5 w-5" />
        </div>
      ) : (
        <div className="flex h-16 items-center px-4">
          <Logo width={140} height={42} className="h-10 w-auto" />
        </div>
      )}

      {!collapsed && (
        <div className="px-3">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Create task */}
      <div className="px-3 pt-1">
        {collapsed ? (
          <button
            type="button"
            onClick={() => openCreate(true)}
            aria-label="Create task"
            title="Create task"
            className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <HugeiconsIcon icon={Add01Icon} size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openCreate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            Create task
          </button>
        )}
      </div>

      <nav className="mt-1 flex-1 overflow-y-auto px-3 py-2">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="mb-5">
            {collapsed ? (
              <div className="mb-1 h-px bg-(--color-border-default)" />
            ) : (
              <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                {sec.title}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {sec.items.map((it) => {
                const active = isActive(it.href)
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      title={collapsed ? it.label : undefined}
                      className={cn(
                        'flex items-center rounded-lg text-sm font-medium transition-colors',
                        collapsed ? 'mx-auto size-9 justify-center' : 'gap-3 px-3 py-2',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                      )}
                    >
                      <HugeiconsIcon icon={it.icon} size={18} />
                      {!collapsed && it.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: expandido = pills de tema (ancho de su contenido) + usuario; colapsado =
          botón-icono de tema (sol/luna) + avatar. */}
      <div className={cn('flex flex-col gap-3 p-3', collapsed && 'items-center')}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            <HugeiconsIcon icon={theme === 'dark' ? Moon02Icon : Sun03Icon} size={18} />
          </button>
        ) : (
          <ThemeToggle className="self-start" />
        )}
        {user &&
          (collapsed ? (
            <UserMenu />
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <UserMenu />
              <div className="min-w-0 flex-1">
                {user.name && <p className="truncate text-sm font-medium text-foreground">{user.name}</p>}
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          ))}
      </div>
    </aside>
  )
}

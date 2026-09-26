'use client'
// Barra inferior SOLO en mobile/tablet (<lg). 6 botones UNIFORMES (Create es uno más,
// no elevado). Sin fondo ni borde: los iconos van sobre el frame, igual que el sidebar.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Queue01Icon, UserGroup03Icon, Analytics01Icon, SwatchIcon, Folder01Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from '@/lib/cn'
import { useCreateTaskDrawer } from '@/hooks/useCreateTaskDrawer'

interface NavItem {
  href: string
  label: string
  icon: IconSvgElement
  /** Hard navigation (<a>) para Types/Lists: fuerza la PÁGINA (evita el modal interceptado). */
  hard?: boolean
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Tasks', icon: Queue01Icon },
  { href: '/team', label: 'Team', icon: UserGroup03Icon },
  { href: '/reports', label: 'Reports', icon: Analytics01Icon },
  { href: '/types', label: 'Types', icon: SwatchIcon, hard: true },
  { href: '/lists', label: 'Lists', icon: Folder01Icon, hard: true },
]

const itemCls = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors'

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

export function BottomNav() {
  const pathname = usePathname() ?? ''
  const openCreate = useCreateTaskDrawer((s) => s.setOpen)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] flex items-stretch px-1 h-16 pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        const cls = cn(itemCls, active ? 'text-primary' : 'text-(--color-text-muted)')
        const content = (
          <>
            <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.5} />
            {item.label}
          </>
        )
        return item.hard ? (
          <a key={item.href} href={item.href} className={cls}>
            {content}
          </a>
        ) : (
          <Link key={item.href} href={item.href} className={cls}>
            {content}
          </Link>
        )
      })}
      {/* Create — un botón más (uniforme), abre el drawer. */}
      <button type="button" onClick={() => openCreate(true)} className={cn(itemCls, 'text-(--color-text-muted)')}>
        <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.5} />
        Create
      </button>
    </nav>
  )
}

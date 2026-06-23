'use client'
// Barra de navegación inferior SOLO en mobile/tablet (<lg). En desktop manda el nav
// horizontal del Header + el panel fijo de Create. Orden: Tasks · Team · [+Create] · Types ·
// Lists, con Create como acción principal (círculo elevado al centro).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Queue01Icon, UserGroup03Icon, SwatchIcon, Folder01Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { cn } from '@/lib/cn'

interface Item {
  href: string
  label: string
  icon: IconSvgElement
  /** Hard navigation (<a>) en vez de <Link>: para Types/Lists fuerza una recarga real y así
   *  EVITA la intercepting route (que en soft-nav abriría el modal). En mobile queremos la
   *  página, no el modal. */
  hard?: boolean
}

const ITEMS: Item[] = [
  { href: '/', label: 'Tasks', icon: Queue01Icon },
  { href: '/team', label: 'Team', icon: UserGroup03Icon },
  { href: '/types', label: 'Types', icon: SwatchIcon, hard: true },
  { href: '/lists', label: 'Lists', icon: Folder01Icon, hard: true },
]

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href)

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const className = cn(
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors',
    active ? 'text-primary-600' : 'text-(--color-text-muted)',
  )
  const content = (
    <>
      <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1} />
      {item.label}
    </>
  )
  // Types/Lists usan <a> (recarga real) para ir a la PÁGINA sin disparar el modal interceptado.
  return item.hard ? (
    <a href={item.href} className={className}>{content}</a>
  ) : (
    <Link href={item.href} className={className}>{content}</Link>
  )
}

export function BottomNav() {
  const pathname = usePathname() ?? ''
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] flex items-stretch border-t border-(--color-border-default) bg-(--color-surface-header) pb-[env(safe-area-inset-bottom)] lg:hidden">
      <NavLink item={ITEMS[0]} active={isActive(pathname, ITEMS[0].href)} />
      <NavLink item={ITEMS[1]} active={isActive(pathname, ITEMS[1].href)} />

      {/* Create — acción principal: círculo elevado al centro. */}
      <div className="relative w-12 shrink-0">
        <Link
          href="/create"
          aria-label="Create Task"
          className={cn(
            'absolute -top-5 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700',
            isActive(pathname, '/create') && 'bg-primary-700',
          )}
        >
          <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={2} />
        </Link>
      </div>

      <NavLink item={ITEMS[2]} active={isActive(pathname, ITEMS[2].href)} />
      <NavLink item={ITEMS[3]} active={isActive(pathname, ITEMS[3].href)} />
    </nav>
  )
}

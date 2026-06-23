'use client'
import Link from 'next/link'
import { Queue01Icon, SwatchIcon, UserGroup03Icon, Folder01Icon, Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NavItem } from '@/components'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { UserMenu } from '@/components/UserMenu'
import { Logo } from '@/components/Logo'

export const Header = () => {
  // Types/Lists ahora son RUTAS (modal en desktop vía intercepting routes; página en
  // mobile). Settings vive en el menú del avatar (UserMenu). Create es la acción principal.
  const navItems = [
    { href: '/', label: 'Tasks', icon: Queue01Icon },
    { href: '/team', label: 'Team', icon: UserGroup03Icon },
    { href: '/types', label: 'Types', icon: SwatchIcon },
    { href: '/lists', label: 'Lists', icon: Folder01Icon },
  ]

  return (
    <header className="sticky top-0 z-[60] flex items-center justify-between border-b border-b-(--color-border-default) bg-(--color-surface-header) px-4">
      <div className="flex items-center gap-4">
        <Logo width={132} height={38} />
        {/* Nav horizontal (se oculta en mobile en F3, donde manda el bottom nav). */}
        <ul className="hidden items-center gap-3 text-sm mb-[-1px] md:flex">
          {navItems.map((item, index) => (
            <NavItem key={item.href || index} {...item} />
          ))}
        </ul>
        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-3">
        {/* Crear tarea → ruta /create (modal en desktop). En mobile irá en el bottom nav. */}
        <Link
          href="/create"
          className="hidden items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 md:flex"
        >
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
          Create
        </Link>
        <UserMenu />
      </div>
    </header>
  )
}

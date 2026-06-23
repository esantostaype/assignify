'use client'
import { Queue01Icon, SwatchIcon, UserGroup03Icon, Folder01Icon } from '@hugeicons/core-free-icons'
import { NavItem } from '@/components'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { UserMenu } from '@/components/UserMenu'
import { Logo } from '@/components/Logo'

export const Header = () => {
  // Types/Lists son RUTAS (modal en desktop vía intercepting routes; página en mobile).
  // Create NO está aquí: en desktop es el panel fijo de la derecha; en mobile irá en el
  // bottom nav (F3). Settings vive en el menú del avatar (UserMenu).
  const navItems = [
    { href: '/', label: 'Tasks', icon: Queue01Icon },
    { href: '/team', label: 'Team', icon: UserGroup03Icon },
    { href: '/types', label: 'Types', icon: SwatchIcon },
    { href: '/lists', label: 'Lists', icon: Folder01Icon },
  ]

  return (
    <header className="sticky top-0 z-[60] flex h-16 items-center justify-between border-b border-b-(--color-border-default) bg-(--color-surface-header) px-4">
      <div className="flex items-center gap-4">
        <Logo width={132} height={38} />
        {/* Nav horizontal solo en desktop (<lg manda el bottom nav de mobile). */}
        <ul className="hidden items-center gap-3 text-sm mb-[-1px] lg:flex">
          {navItems.map((item, index) => (
            <NavItem key={item.href || index} {...item} />
          ))}
        </ul>
        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}

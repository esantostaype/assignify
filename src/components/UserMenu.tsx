'use client'
// Badge del usuario logueado (foto de ClickUp) que abre un dropdown con su identidad y
// las acciones de cuenta: Dark mode (switch), Profile (→ ClickUp), Settings y Sign out.
import { useState } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Logout01Icon, UserIcon, Settings01Icon, Moon02Icon } from '@hugeicons/core-free-icons'
import { AlertDialog } from '@/components/ui'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/shadcn/avatar'
import { Switch } from '@/components/shadcn/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useUiTheme } from '@/providers/UiThemeProvider'
import { useWorkspaces } from '@/hooks/queries/useWorkspaces'
import { Dropdown } from '@/components/Dropdown'
import { cn } from '@/lib/cn'

export const UserMenu = () => {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useUiTheme()
  const { data: ws } = useWorkspaces()
  const [logoutOpen, setLogoutOpen] = useState(false)

  if (!user) return null

  const label = user.name ?? user.email
  const initials = label.slice(0, 2).toUpperCase()
  const clickupProfileUrl = ws?.activeId
    ? `https://app.clickup.com/${ws.activeId}/settings/profile`
    : 'https://app.clickup.com'

  const handleLogout = () => {
    Promise.resolve(logout()).catch((error) => console.error('Logout failed:', error))
  }

  const itemCls =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent'

  return (
    <>
      <Dropdown
        align="right"
        ariaLabel="User menu"
        triggerClassName="rounded-full ring-2 ring-transparent transition hover:ring-(--color-border-default)"
        className="w-64"
        trigger={
          <Avatar className="size-9">
            {user.image && <AvatarImage src={user.image} alt={label} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        }
      >
        {(close) => (
          <div className="flex flex-col py-1">
            {/* Identidad */}
            <div className="flex items-center gap-3 px-3 pb-3 pt-2">
              <Avatar className="size-10">
                {user.image && <AvatarImage src={user.image} alt={label} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {user.name && <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>}
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="my-1 border-t border-border" />

            {/* Acciones */}
            <div className="flex flex-col gap-0.5 px-1.5">
              {/* Dark mode (switch) */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <HugeiconsIcon icon={Moon02Icon} size={16} />
                  Dark mode
                </span>
                <Switch checked={theme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
              </div>

              {/* Profile → ClickUp */}
              <a href={clickupProfileUrl} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
                <HugeiconsIcon icon={UserIcon} size={16} />
                Profile
              </a>

              {/* Settings */}
              <Link href="/settings" onClick={close} className={itemCls}>
                <HugeiconsIcon icon={Settings01Icon} size={16} />
                Settings
              </Link>
            </div>

            <div className="my-1 border-t border-border" />

            {/* Sign out */}
            <div className="px-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  close()
                  setLogoutOpen(true)
                }}
                className={cn(itemCls, 'text-destructive hover:bg-destructive/10')}
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </Dropdown>

      <AlertDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        tone="warning"
        title="Sign Out"
        description={`Are you sure you want to sign out${user.email ? ` from ${user.email}` : ''}? You'll need to log in again to access your account.`}
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
      />
    </>
  )
}

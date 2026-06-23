'use client'
// Badge del usuario logueado (foto de ClickUp) que abre un dropdown con su identidad y
// las acciones de cuenta: Dark mode (switch), Profile (→ ClickUp), Settings y Sign out.
// Settings vive AQUÍ (ya no en el nav principal del Header).
import { useState } from 'react'
import Link from 'next/link'
import { Avatar, AlertDialog, Switch } from '@/components/ui'
import { Icon, PiSignOut, PiUser, PiGear, PiMoon } from '@/lib/icons'
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
  // Perfil del usuario en ClickUp (su workspace activo); fallback a la raíz de ClickUp.
  const clickupProfileUrl = ws?.activeId
    ? `https://app.clickup.com/${ws.activeId}/settings/profile`
    : 'https://app.clickup.com'

  const handleLogout = () => {
    Promise.resolve(logout()).catch((error) => console.error('Logout failed:', error))
  }

  // Hover con esquinas redondeadas y MÁS TENUE; el wrapper px-1.5 le da margen lateral
  // para que el hover no toque los bordes del panel.
  const itemCls =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-(--color-text-default) transition-colors hover:bg-(--color-text-muted)/[0.07]'

  return (
    <>
      <Dropdown
        align="right"
        ariaLabel="User menu"
        triggerClassName="rounded-full ring-2 ring-transparent transition hover:ring-(--color-border-default)"
        className="w-64"
        trigger={<Avatar src={user.image} size="sm">{initials}</Avatar>}
      >
        {(close) => (
          <div className="flex flex-col py-1">
            {/* Identidad */}
            <div className="flex items-center gap-3 px-3 pb-3 pt-2">
              <Avatar src={user.image} size="md">{initials}</Avatar>
              <div className="min-w-0">
                {user.name && (
                  <p className="truncate text-sm font-semibold text-(--color-text-strong)">{user.name}</p>
                )}
                <p className="truncate text-xs text-neutral-600">{user.email}</p>
              </div>
            </div>

            <div className="my-1 border-t border-neutral-200" />

            {/* Acciones (margen lateral via px-1.5 → el hover no toca los bordes) */}
            <div className="flex flex-col gap-0.5 px-1.5">
              {/* Dark mode (switch) */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text-default)">
                  <Icon icon={PiMoon} size={16} />
                  Dark mode
                </span>
                <Switch
                  size="sm"
                  checked={theme === 'dark'}
                  onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                />
              </div>

              {/* Profile → ClickUp (pestaña nueva) */}
              <a href={clickupProfileUrl} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
                <Icon icon={PiUser} size={16} />
                Profile
              </a>

              {/* Settings → página */}
              <Link href="/settings" onClick={close} className={itemCls}>
                <Icon icon={PiGear} size={16} />
                Settings
              </Link>
            </div>

            <div className="my-1 border-t border-neutral-200" />

            {/* Sign out */}
            <div className="px-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  close()
                  setLogoutOpen(true)
                }}
                className={cn(itemCls, 'text-error-600 hover:bg-error-500/10')}
              >
                <Icon icon={PiSignOut} size={16} />
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

'use client'
// Badge del usuario logueado (foto de ClickUp) que abre un dropdown con su
// identidad, el toggle de tema y el logout. Reemplaza el email + ThemeToggle +
// botón Logout sueltos que vivían en el Header.
import { useState } from 'react'
import { Avatar, AlertDialog } from '@/components/ui'
import { Icon, PiSignOut } from '@/lib/icons'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Dropdown } from '@/components/Dropdown'

export const UserMenu = () => {
  const { user, logout } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)

  if (!user) return null

  const label = user.name ?? user.email
  const initials = label.slice(0, 2).toUpperCase()

  const handleLogout = () => {
    Promise.resolve(logout()).catch((error) => console.error('Logout failed:', error))
  }

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
          <div className="flex flex-col">
            {/* Identidad */}
            <div className="flex items-center gap-3 border-b border-neutral-200 px-3 py-3">
              <Avatar src={user.image} size="sm">{initials}</Avatar>
              <div className="min-w-0">
                {user.name && (
                  <p className="truncate text-sm font-semibold text-(--color-text-strong)">{user.name}</p>
                )}
                <p className="truncate text-xs text-neutral-600">{user.email}</p>
              </div>
            </div>

            {/* Tema */}
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5">
              <span className="text-xs font-medium text-neutral-600">Theme</span>
              <ThemeToggle />
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                close()
                setLogoutOpen(true)
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-error-600 transition-colors hover:bg-error-500/10"
            >
              <Icon icon={PiSignOut} size={16} />
              Logout
            </button>
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

'use client'
import { useState } from 'react'
import { Queue01Icon, Settings01Icon, SwatchIcon, UserGroup03Icon, Folder01Icon } from '@hugeicons/core-free-icons'
import { NavItem, SettingsForm, TaskTypesForm } from '@/components'
import { ListsSyncForm } from '@/components/ListsSyncForm'
import { Button, Modal, AlertDialog } from '@/components/ui'
import { Icon, PiUser, PiSignOut } from '@/lib/icons'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/Logo'

export const Header = () => {
  const { logout, user } = useAuth()

  // Modals / dialogs are rendered inline with local state (mirrors the
  // reference project: no global modal store holding a JSX snapshot — the
  // content stays part of the live React tree and reflects updates).
  const [typesOpen, setTypesOpen] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleLogout = () => {
    // logout() navigates away on success; fire-and-forget like the
    // reference's AlertDialog confirms (no loading state on the dialog).
    Promise.resolve(logout()).catch((error) => {
      console.error('Logout failed:', error)
    })
  }

  const navItems = [
    { href: '/tasks', label: 'Tasks', icon: Queue01Icon },
    { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
    { onClick: () => setTypesOpen(true), label: 'Types', icon: SwatchIcon },
    { onClick: () => setListsOpen(true), label: 'Lists', icon: Folder01Icon },
    { onClick: () => setSettingsOpen(true), label: 'Settings', icon: Settings01Icon }
  ]

  return (
    <>
      <header className="sticky top-0 bg-(--color-surface-header) z-50 flex items-center justify-between px-4 border-b border-b-(--color-border-default)">
        <div className='flex items-center gap-4'>
          <Logo width={132} height={38} />
          <ul className="flex items-center gap-3 text-sm mb-[-1px]">
            {navItems.map((item, index) => (
              <NavItem key={item.href || index} {...item} />
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* User info - opcional */}
          {user && (
            <span className="text-sm text-(--color-text-muted) hidden sm:flex sm:items-center sm:gap-1">
              <Icon icon={PiUser} size={20} />
              {user.email}
            </span>
          )}

          {/* Logout button */}
          <Button
            size='sm'
            variant='ghost'
            onClick={() => setLogoutOpen(true)}
            color='error'
            startIcon={<Icon icon={PiSignOut} size={20} />}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Task Types — small editing modal */}
      <Modal
        open={typesOpen}
        onClose={() => setTypesOpen(false)}
        title="Task Types"
        description="Click on a task type name to edit it • Press Enter to save • Press Escape to cancel"
        size="md"
      >
        <TaskTypesForm />
      </Modal>

      {/* Lists — elegir qué listas de ClickUp del workspace son asignables (brands). */}
      <Modal
        open={listsOpen}
        onClose={() => setListsOpen(false)}
        title="Assignable Lists"
        description="Choose which ClickUp lists of your workspace can receive tasks"
        size="md"
      >
        <ListsSyncForm />
      </Modal>

      {/* Settings — larger configuration modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        description="Changes will take effect immediately after saving"
        size="lg"
      >
        <SettingsForm />
      </Modal>

      {/* Sign out confirmation */}
      <AlertDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        tone="warning"
        title="Sign Out"
        description={`Are you sure you want to sign out${user?.email ? ` from ${user.email}` : ''}? You'll need to log in again to access your account.`}
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
      />
    </>
  )
}

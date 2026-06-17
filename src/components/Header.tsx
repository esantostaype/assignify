'use client'
import { Layers01Icon, Queue01Icon, SwatchIcon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import { NavItem, TaskTypesForm, TierListForm } from '@/components'
import { Button } from '@/components/ui'
import { Icon, PiUser, PiSignOut } from '@/lib/icons'
import { useModalStore } from '@/stores/modalStore'
import { useConfirmationStore } from '@/stores/confirmationStore'
import { useAuth } from '@/contexts/AuthContext'

export const Header = () => {
  const { openModal } = useModalStore()
  const { openConfirmation } = useConfirmationStore()
  const { logout, user } = useAuth()

  const handleTiersClick = () => {
    openModal({
      title: 'Tier List',
      content: <TierListForm />
    })
  }

  const handleTypesClick = () => {
    openModal({
      title: 'Task Types',
      content: <TaskTypesForm />
    })
  }

  const handleLogoutClick = () => {
    openConfirmation({
      title: 'Sign Out',
      description: `Are you sure you want to sign out${user?.email ? ` from ${user.email}` : ''}? You'll need to log in again to access your account.`,
      type: 'warning',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await logout()
        } catch (error) {
          console.error('Logout failed:', error)
          throw error // Esto mantendrá el loading si hay error
        }
      }
    })
  }

  const navItems = [
    { href: '/tasks', label: 'Tasks', icon: Queue01Icon },
    { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
    { onClick: handleTypesClick, label: 'Types', icon: SwatchIcon },
    { onClick: handleTiersClick, label: 'Tiers', icon: Layers01Icon }
  ]

  return (
    <header className="sticky top-0 bg-(--color-surface-app)/70 backdrop-blur-lg z-50 flex items-center justify-between px-4 border-b border-b-(--color-border-default)">
      <div className='flex items-center gap-4'>
        <Image src="/images/logo.svg" alt="Assignify" width={132} height={38} />
        <ul className="flex items-center gap-3 text-sm mb-[-1px]">
          {navItems.map((item, index) => (
            <NavItem key={item.href || index} {...item} />
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3">
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
          onClick={handleLogoutClick}
          color='error'
          startIcon={<Icon icon={PiSignOut} size={20} />}
        >
          Logout
        </Button>
      </div>
    </header>
  )
}

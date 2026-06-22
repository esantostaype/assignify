'use client'
import { useState } from 'react'
import { Queue01Icon, Settings01Icon, SwatchIcon, UserGroup03Icon, Folder01Icon } from '@hugeicons/core-free-icons'
import { NavItem, TaskTypesForm } from '@/components'
import { ListsSyncForm } from '@/components/ListsSyncForm'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { UserMenu } from '@/components/UserMenu'
import { Modal } from '@/components/ui'
import { Logo } from '@/components/Logo'

export const Header = () => {
  // Modals / dialogs are rendered inline with local state (mirrors the
  // reference project: no global modal store holding a JSX snapshot — the
  // content stays part of the live React tree and reflects updates).
  const [typesOpen, setTypesOpen] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)

  const navItems = [
    { href: '/', label: 'Tasks', icon: Queue01Icon },
    { href: '/team', label: 'Team', icon: UserGroup03Icon },
    { onClick: () => setTypesOpen(true), label: 'Types', icon: SwatchIcon },
    { onClick: () => setListsOpen(true), label: 'Lists', icon: Folder01Icon },
    { href: '/settings', label: 'Settings', icon: Settings01Icon }
  ]

  return (
    <>
      {/* z por encima de las barras sticky de Tasks/Team (z-50): si no, sus
          contextos de apilamiento tapan los dropdowns del header. */}
      <header className="sticky top-0 bg-(--color-surface-header) z-[60] flex items-center justify-between px-4 border-b border-b-(--color-border-default)">
        <div className='flex items-center gap-4'>
          <Logo width={132} height={38} />
          <ul className="flex items-center gap-3 text-sm mb-[-1px]">
            {navItems.map((item, index) => (
              <NavItem key={item.href || index} {...item} />
            ))}
          </ul>
          {/* Workspace activo como dropdown, dentro del nav. */}
          <WorkspaceSwitcher />
        </div>

        {/* Badge del usuario: foto de ClickUp → dropdown (identidad, tema, logout). */}
        <UserMenu />
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

    </>
  )
}

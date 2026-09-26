'use client'
// Drawer de Create Task: mismo ancho que el panel anterior (28rem), pero flotante
// (inset 8px arriba/abajo/derecha, redondeado) y se abre bajo demanda desde el
// trigger del sidebar. Estado en useCreateTaskDrawer (zustand).
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/cn'
import { CreateTaskForm } from './CreateTaskForm'
import { SmoothScroll } from '@/components/SmoothScroll'
import { useCreateTaskDrawer } from '@/hooks/useCreateTaskDrawer'

export const CreateTaskDrawer = () => {
  const open = useCreateTaskDrawer((s) => s.open)
  const setOpen = useCreateTaskDrawer((s) => s.setOpen)

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-[90] bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      {/* Panel flotante (inset 8px, redondeado). Slide desde la derecha. */}
      <aside
        aria-hidden={!open}
        className={cn(
          'fixed bottom-3 right-3 top-3 z-[100] flex w-[28rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white dark:bg-(--color-surface-app) shadow-2xl transition-transform duration-300 ease-(--ease-app)',
          open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-(--color-text-muted) transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
        <SmoothScroll className="min-h-0 flex-1">
          <CreateTaskForm />
        </SmoothScroll>
      </aside>
    </>
  )
}

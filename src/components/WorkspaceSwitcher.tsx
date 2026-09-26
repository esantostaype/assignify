'use client'
// [SaaS] Selector del workspace ACTIVO de ClickUp (dropdown en el sidebar). Solo
// aparece si el usuario conectó ClickUp y tiene MÁS de un workspace.
import { HugeiconsIcon } from '@hugeicons/react'
import { Building03Icon, ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { Dropdown } from '@/components/Dropdown'
import { useWorkspaces, useSetActiveWorkspace } from '@/hooks/queries/useWorkspaces'
import { hotToast as toast } from '@/lib/hotToast'

export function WorkspaceSwitcher() {
  const { data, isLoading } = useWorkspaces()
  const setActive = useSetActiveWorkspace({
    onError: () => toast.error({ title: 'Could not switch workspace', description: 'Please try again.' }),
  })

  const workspaces = data?.workspaces ?? []
  if (isLoading || workspaces.length <= 1) return null

  const active = workspaces.find((w) => w.id === data?.activeId)
  const activeLabel = active?.name ?? active?.id ?? 'Workspace'

  return (
    <Dropdown
      align="left"
      ariaLabel="Switch workspace"
      triggerClassName="gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-60"
      className="w-64 p-1"
      trigger={
        <>
          <HugeiconsIcon icon={Building03Icon} size={16} />
          <span className="max-w-[12rem] truncate font-medium">{activeLabel}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
        </>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          {workspaces.map((w) => {
            const isActive = w.id === data?.activeId
            return (
              <button
                key={w.id}
                type="button"
                disabled={setActive.isPending}
                onClick={() => {
                  close()
                  if (!isActive) setActive.mutate(w.id)
                }}
                className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <HugeiconsIcon icon={Building03Icon} size={16} />
                  <span className="truncate">{w.name ?? w.id}</span>
                </span>
                {isActive && <HugeiconsIcon icon={Tick02Icon} size={16} className="text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </Dropdown>
  )
}

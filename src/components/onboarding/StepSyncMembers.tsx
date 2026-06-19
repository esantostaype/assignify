'use client'
// [SaaS fase 5] Paso 1 del onboarding: sincronizar los miembros de ClickUp del
// workspace. Envoltura fina sobre los hooks existentes (useClickUpUsers/useSyncUsers)
// reutilizando UserCard para la selección. No reescribe la lógica de sync.
import { useState } from 'react'
import { Button, Spinner } from '@/components/ui'
import { UserCard } from '@/components/designers/UserCard'
import { useClickUpUsers, useSyncUsers } from '@/hooks/queries/useUsers'
import { hotToast as toast } from '@/lib/hotToast'

export function StepSyncMembers() {
  const { data, isLoading } = useClickUpUsers()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sync = useSyncUsers({
    onSuccess: (res: { statistics?: { created?: number } }) => {
      toast.success({ title: 'Members synced', description: `${res?.statistics?.created ?? 0} added.` })
      setSelected(new Set())
    },
    onError: () => toast.error({ title: 'Could not sync members', description: 'Please try again.' }),
  })

  const all = data?.clickupUsers ?? []
  const available = all.filter((u) => u.canSync)
  const syncedCount = all.filter((u) => u.existsInLocal).length

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  if (isLoading) {
    return <div className="flex justify-center py-10"><Spinner size={28} /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Sync the ClickUp members of this workspace so you can assign tasks to them.
        {syncedCount > 0 ? ` ${syncedCount} already synced.` : ''}
      </p>

      {available.length === 0 ? (
        <p className="text-sm text-(--color-text-muted)">All your members are already synced. ✅</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {available.map((u) => (
            <UserCard
              key={u.clickupId}
              user={u}
              isSelected={selected.has(u.clickupId)}
              onSelect={(on) => toggle(u.clickupId, on)}
            />
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={() => sync.mutate(Array.from(selected))}
            loading={sync.isPending}
            disabled={selected.size === 0}
          >
            Sync{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </div>
      )}
    </div>
  )
}

'use client'
// [SaaS fase 4] Selector del workspace ACTIVO de ClickUp, montado en el Header. Solo
// aparece si el usuario conectó ClickUp y tiene MÁS de un workspace autorizado.
// Cambiarlo recarga la app para que todo (kanban, designers, listas…) se lea con el
// nuevo activo. El admin email/password no lo ve (opera DEFAULT_WORKSPACE_ID).
import { Select } from '@/components/ui'
import { Icon, PiBuildings } from '@/lib/icons'
import { useWorkspaces, useSetActiveWorkspace } from '@/hooks/queries/useWorkspaces'
import { hotToast as toast } from '@/lib/hotToast'

export function WorkspaceSwitcher() {
  const { data, isLoading } = useWorkspaces()
  const setActive = useSetActiveWorkspace({
    onError: () =>
      toast.error({ title: 'Could not switch workspace', description: 'Please try again.' }),
  })

  const workspaces = data?.workspaces ?? []
  // Nada que elegir (admin email/password, o un único workspace) → no se muestra.
  if (isLoading || workspaces.length <= 1) return null

  return (
    <Select
      size="sm"
      value={data?.activeId ?? undefined}
      onChange={(id) => setActive.mutate(id)}
      disabled={setActive.isPending}
      startAdornment={<Icon icon={PiBuildings} size={16} />}
      options={workspaces.map((w) => ({ value: w.id, label: w.name ?? w.id }))}
    />
  )
}

'use client'
// [SaaS] Elegir qué LISTAS de ClickUp del workspace son "asignables" (se guardan
// como brands). Tabla con un switch por lista (estilo Task Types) en vez del
// MultiSelect anterior: se ve todo de un vistazo y se activa/desactiva directo.
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Switch, Input, Skeleton } from '@/components/ui'
import { Icon, PiMagnifyingGlass } from '@/lib/icons'
import { hotToast as toast } from '@/lib/hotToast'
import { taskDataKeys } from '@/hooks/useTaskData'

interface DiscoveredList {
  id: string
  name: string
  spaceName: string
  folderName: string | null
  isAssignable: boolean
}

const ListRowSkeleton = () => (
  <tr className="border-t border-(--color-border-default)">
    <td className="p-2 first:pl-4"><Skeleton variant="text" width={160} /></td>
    <td className="p-2"><Skeleton variant="text" width={112} /></td>
    <td className="p-2 last:pr-4"><Skeleton variant="circle" width={36} height={20} className="ml-auto" /></td>
  </tr>
)

export function ListsSyncForm() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['clickup-lists'],
    queryFn: async () => (await axios.get('/api/sync/clickup-lists')).data.lists as DiscoveredList[],
    staleTime: 60_000,
  })

  // Selección (assignable) como Set para alternar directo desde cada switch.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (data) setSelected(new Set(data.filter((l) => l.isAssignable).map((l) => l.id)))
  }, [data])

  const save = useMutation({
    mutationFn: async (listIds: string[]) =>
      (await axios.post('/api/sync/clickup-lists', { listIds })).data,
    onSuccess: (res) => {
      toast.success({
        title: 'Lists saved',
        description: `${res.created?.length ?? 0} list(s) are now assignable.`,
      })
      qc.invalidateQueries({ queryKey: taskDataKeys.brands() })
      qc.invalidateQueries({ queryKey: ['clickup-lists'] })
    },
    onError: () => toast.error({ title: 'Could not save lists', description: 'Please try again.' }),
  })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const lists = useMemo(
    () =>
      (data ?? []).filter(
        (l) => !search || l.name.toLowerCase().includes(search.toLowerCase())
      ),
    [data, search]
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Toggle which ClickUp lists of your workspace are assignable. They become the “Lists”
        you can choose when creating a task.
      </p>

      <Input
        size="md"
        placeholder="Search lists..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        startAdornment={<Icon icon={PiMagnifyingGlass} size={16} />}
      />

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-(--color-border-default) bg-(--color-surface-card)">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-(--color-surface-hover)">
            <tr>
              <th className="p-2 text-left font-medium text-(--color-text-muted) first:pl-4">List</th>
              <th className="p-2 text-left font-medium text-(--color-text-muted)">Space</th>
              <th className="w-24 p-2 text-right font-medium text-(--color-text-muted) last:pr-4">Assignable</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <ListRowSkeleton />
                <ListRowSkeleton />
                <ListRowSkeleton />
              </>
            ) : lists.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-(--color-text-muted)">
                  {search ? 'No lists match your search' : 'No lists found in this workspace'}
                </td>
              </tr>
            ) : (
              lists.map((l) => (
                <tr key={l.id} className="border-t border-(--color-border-default)">
                  <td className="p-2 font-medium text-(--color-text-strong) first:pl-4">{l.name}</td>
                  <td className="p-2 text-(--color-text-muted)">
                    {l.folderName ? `${l.folderName} / ` : ''}
                    {l.spaceName}
                  </td>
                  <td className="p-2 text-right last:pr-4">
                    <Switch checked={selected.has(l.id)} onChange={() => toggle(l.id)} size="sm" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate([...selected])} loading={save.isPending} disabled={isLoading}>
          Save lists
        </Button>
      </div>
    </div>
  )
}

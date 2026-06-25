'use client'
// [SaaS] Elegir qué LISTAS de ClickUp del workspace son "asignables" (se guardan
// como brands). Tabla (DataTable) con un switch por lista: se ve todo de un vistazo
// y se activa/desactiva directo; el botón Save persiste toda la selección.
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Switch, DataTable, type DataTableColumn } from '@/components/ui'
import { hotToast as toast } from '@/lib/hotToast'
import { taskDataKeys } from '@/hooks/useTaskData'

interface DiscoveredList {
  id: string
  name: string
  spaceName: string
  folderName: string | null
  isAssignable: boolean
}

export function ListsSyncForm() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['clickup-lists'],
    queryFn: async () => (await axios.get('/api/sync/clickup-lists')).data.lists as DiscoveredList[],
    staleTime: 60_000,
  })

  // Selección (assignable) como Set para alternar directo desde cada switch.
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const columns: DataTableColumn<DiscoveredList>[] = [
    {
      key: 'name',
      header: 'List',
      accessor: (l) => l.name,
      width: 240,
      skeleton: 'text',
      cell: (l) => <span className="font-medium text-(--color-text-strong)">{l.name}</span>,
    },
    {
      key: 'space',
      header: 'Space',
      accessor: (l) => (l.folderName ? `${l.folderName} / ${l.spaceName}` : l.spaceName),
      skeleton: 'text',
      cell: (l) => (
        <span className="text-(--color-text-muted)">
          {l.folderName ? `${l.folderName} / ` : ''}
          {l.spaceName}
        </span>
      ),
    },
    {
      key: 'assignable',
      header: 'Assignable',
      align: 'right',
      width: 120,
      skeleton: 'chip',
      expandedInteractive: true,
      cell: (l) => (
        <div className="flex justify-end">
          <Switch
            checked={selected.has(l.id)}
            onChange={() => toggle(l.id)}
            size="sm"
            aria-label={`Make ${l.name} assignable`}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Toggle which ClickUp lists of your workspace are assignable. They become the “Lists”
        you can choose when creating a task.
      </p>

      <DataTable<DiscoveredList>
        data={data ?? []}
        columns={columns}
        rowKey={(l) => l.id}
        loading={isLoading}
        showSearch={false}
        hidePageSizePicker
        skeletonRowCount={3}
        emptyState="No lists found in this workspace"
      />

      <div className="flex justify-end">
        <Button onClick={() => save.mutate([...selected])} loading={save.isPending} disabled={isLoading}>
          Save lists
        </Button>
      </div>
    </div>
  )
}

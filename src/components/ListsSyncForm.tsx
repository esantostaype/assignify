'use client'
// [SaaS fase 4] Elegir qué LISTAS de ClickUp del workspace son "asignables"
// (se guardan como brands del workspace). Reemplaza el alta manual de brands.
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MultiSelect, Button } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
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

  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    if (data) setSelected(data.filter((l) => l.isAssignable).map((l) => l.id))
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

  const options: SelectOption<string>[] = (data ?? []).map((l) => ({
    value: l.id,
    searchValue: l.name,
    label: (
      <span className="flex items-center gap-2">
        <span>{l.name}</span>
        <span className="text-xs text-(--color-text-muted)">
          · {l.folderName ? `${l.folderName} / ` : ''}{l.spaceName}
        </span>
      </span>
    ),
  }))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Pick which ClickUp lists of your workspace are assignable. They become the “Lists”
        you can choose when creating a task.
      </p>

      <MultiSelect
        searchable
        value={selected}
        options={options}
        onChange={setSelected}
        placeholder={isLoading ? 'Discovering lists…' : 'Select lists'}
        disabled={isLoading}
        maxChipRows={3}
        noResultsLabel="No lists found in this workspace"
      />

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate(selected)}
          loading={save.isPending}
          disabled={isLoading || selected.length === 0}
        >
          Save lists
        </Button>
      </div>
    </div>
  )
}

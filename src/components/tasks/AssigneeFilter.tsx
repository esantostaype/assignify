'use client'
// Filtro de "Assignees" para el tablero de Tasks: un Dropdown (mismo estilo que el menú del
// avatar del header) con un buscador + la lista de miembros del team, cada uno con avatar y
// checkbox (multi-selección). Controlado: el estado vive en el board (Tasks.tsx). Sin nada
// seleccionado = se muestran TODAS las tareas.
import { useMemo, useState } from 'react'
import { Avatar, Checkbox, SearchInput } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Icon, PiUser, PiCaretDown } from '@/lib/icons'
import { avatarColor } from '@/lib/avatarColor'

export interface AssigneeOption {
  clickupId: string
  name: string
  email: string
  profilePicture?: string
  initials: string
  color?: string
}

interface AssigneeFilterProps {
  users: AssigneeOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function AssigneeFilter({ users, selected, onChange }: AssigneeFilterProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, query])

  // Resumen mostrado en el trigger: "All assignees" / el nombre (si 1) / "N assignees".
  const summary =
    selected.length === 0
      ? 'All assignees'
      : selected.length === 1
        ? users.find((u) => u.clickupId === selected[0])?.name ?? '1 assignee'
        : `${selected.length} assignees`

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <Dropdown
      align="left"
      ariaLabel="Filter by assignee"
      className="w-72"
      trigger={
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--color-border-default) bg-(--color-surface-card) px-2.5 text-sm text-(--color-text-default) transition-colors hover:border-(--color-text-subtle)">
          <Icon icon={PiUser} size={15} className="text-(--color-text-muted)" />
          <span className="max-w-[9rem] truncate">{summary}</span>
          <Icon icon={PiCaretDown} size={13} className="text-(--color-text-muted)" />
        </span>
      }
    >
      <div className="flex max-h-[24rem] flex-col">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Assignees</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Clear
            </button>
          )}
        </div>
        <div className="px-3 pb-2">
          <SearchInput
            size="sm"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-xs text-(--color-text-muted)">No members found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.clickupId}
                type="button"
                onClick={() => toggle(u.clickupId)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-(--color-text-muted)/[0.07]"
              >
                <Avatar
                  src={u.profilePicture || undefined}
                  size="xs"
                  style={{ backgroundColor: avatarColor(u.color, u.clickupId), color: '#fff' }}
                >
                  {u.initials}
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm text-(--color-text-default)">{u.name}</span>
                <span className="pointer-events-none shrink-0">
                  <Checkbox size="sm" checked={selected.includes(u.clickupId)} readOnly />
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Dropdown>
  )
}

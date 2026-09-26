'use client'
// Filtro de "Assignees" del tablero de Tasks: Popover de shadcn con buscador +
// lista de miembros (avatar + check). Controlado desde Tasks.tsx. Sin selección =
// se muestran TODAS las tareas.
import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserMultiple02Icon, ArrowDown01Icon, Search01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/shadcn/popover'
import { Input } from '@/components/shadcn/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/shadcn/avatar'
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

  // Resumen del trigger: "All assignees" / el nombre (si 1) / "N assignees".
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-md bg-secondary px-3 text-sm text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <HugeiconsIcon icon={UserMultiple02Icon} size={16} className="opacity-70" />
          <span className="max-w-[9rem] truncate">{summary}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 pb-2 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignees</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Clear
            </button>
          )}
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="no-scrollbar max-h-72 min-h-0 overflow-y-auto px-1.5 pb-2">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">No members found</p>
          ) : (
            filtered.map((u) => {
              const on = selected.includes(u.clickupId)
              return (
                <button
                  key={u.clickupId}
                  type="button"
                  onClick={() => toggle(u.clickupId)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <Avatar className="size-6">
                    {u.profilePicture && <AvatarImage src={u.profilePicture} alt={u.name} />}
                    <AvatarFallback className="text-[10px] text-white" style={{ backgroundColor: avatarColor(u.color, u.clickupId) }}>
                      {u.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{u.name}</span>
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border border-border',
                      on && 'border-primary bg-primary'
                    )}
                  >
                    {on && <HugeiconsIcon icon={Tick02Icon} size={12} className="text-primary-foreground" />}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'
// MultiSelect shadcn (Popover + búsqueda + chips + check). Los chips se clipan a UNA
// fila; si no caben, aparece un botón "+N" que abre un modal con TODOS los chips
// (removibles). API principal del MultiSelect viejo: options {value,label,searchValue},
// value[], onChange, searchable, placeholder, disabled, error, noResultsLabel, name.
import * as React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Search01Icon, Tick02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/shadcn/popover'
import { Button } from '@/components/shadcn/button'
import { Modal } from '@/components/ui'

export interface MultiSelectOption {
  value: string
  label: React.ReactNode
  searchValue?: string
  disabled?: boolean
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  noResultsLabel?: React.ReactNode
  disabled?: boolean
  error?: React.ReactNode
  name?: string
  className?: string
}

function Chip({ label, onRemove }: { label: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 py-0.5 pl-2 pr-1 text-xs font-medium text-primary">
      <span className="max-w-[10rem] truncate">{label}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="grid size-4 place-items-center rounded-full transition-colors hover:bg-primary/20"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={11} />
        </span>
      )}
    </span>
  )
}

// Fila de chips clipada a UNA fila + pill "+N" que dispara el modal de overflow.
function ChipRow({
  chips,
  onRemove,
  onOverflow,
}: {
  chips: MultiSelectOption[]
  onRemove: (v: string) => void
  onOverflow: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(chips.length)

  // Reset del conteo cuando cambian los chips (patrón derived-state).
  const lastRef = React.useRef(chips)
  if (lastRef.current !== chips) {
    lastRef.current = chips
    setVisible(chips.length)
  }

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const items = Array.from(el.querySelectorAll<HTMLElement>('[data-chip-slot]'))
      if (items.length === 0) return
      const rowTops = Array.from(new Set(items.map((i) => i.offsetTop))).sort((a, b) => a - b)
      if (rowTops.length <= 1) return // cabe en una fila
      const firstTop = rowTops[0]
      let firstOverflow = -1
      for (let i = 0; i < items.length; i++) {
        if (items[i].offsetTop !== firstTop) {
          firstOverflow = i
          break
        }
      }
      if (firstOverflow === -1) return
      const isPill = items[firstOverflow].dataset.chipSlot === 'more'
      const next = isPill ? Math.max(0, visible - 1) : firstOverflow
      setVisible((prev) => Math.min(prev, next))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible, chips])

  const hidden = chips.length - visible

  return (
    <div ref={ref} className="flex max-h-6 flex-1 flex-wrap items-center gap-1 overflow-hidden">
      {chips.slice(0, visible).map((c) => (
        <span key={c.value} data-chip-slot="item">
          <Chip label={c.label} onRemove={() => onRemove(c.value)} />
        </span>
      ))}
      {hidden > 0 && (
        <span
          role="button"
          tabIndex={-1}
          data-chip-slot="more"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onOverflow()
          }}
          className="inline-flex h-5 items-center rounded-md bg-secondary px-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search...',
  noResultsLabel = 'No matches',
  disabled,
  error,
  name,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [overflowOpen, setOverflowOpen] = React.useState(false)

  const selected = React.useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as MultiSelectOption[],
    [value, options]
  )
  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter((o) => (o.searchValue ?? '').toLowerCase().includes(q))
  }, [options, query, searchable])

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const remove = (v: string) => onChange(value.filter((x) => x !== v))

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (disabled) return
          setOpen(o)
          if (o) setQuery('')
        }}
      >
        {name && value.map((v, i) => <input key={i} type="hidden" name={`${name}[]`} value={v} readOnly />)}
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-invalid={!!error || undefined}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-md bg-secondary px-2 py-1 text-left text-sm outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary/40',
              error && 'ring-1 ring-destructive',
              disabled && 'cursor-not-allowed opacity-50',
              className
            )}
          >
            {selected.length === 0 ? (
              <span className="flex-1 px-1 text-muted-foreground">{placeholder}</span>
            ) : (
              <ChipRow chips={selected} onRemove={remove} onOverflow={() => setOverflowOpen(true)} />
            )}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              className={cn('shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-[15rem] p-0">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <HugeiconsIcon icon={Search01Icon} size={14} className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">{noResultsLabel}</div>
          ) : (
            <ul className="no-scrollbar max-h-64 overflow-auto p-1">
              {filtered.map((opt) => {
                const on = value.includes(opt.value)
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        on ? 'text-primary' : 'text-foreground hover:bg-accent',
                        opt.disabled && 'pointer-events-none opacity-50'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                        )}
                      >
                        {on && <HugeiconsIcon icon={Tick02Icon} size={11} />}
                      </span>
                      <span className="min-w-0 flex-1">{opt.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {/* Modal de overflow: TODOS los chips seleccionados (removibles). */}
      <Modal
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        size="sm"
        className="max-w-[420px]!"
        density="compact"
        title="Selected"
        description={`${selected.length} selected`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onChange([])} disabled={selected.length === 0}>
              Clear all
            </Button>
            <Button onClick={() => setOverflowOpen(false)}>Done</Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items selected.</p>
          ) : (
            selected.map((opt) => <Chip key={opt.value} label={opt.label} onRemove={() => remove(opt.value)} />)
          )}
        </div>
      </Modal>
    </>
  )
}

'use client';

import {
  forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretDown, PiMagnifyingGlass, PiCheck, PiX } from '@/lib/icons';
import { Chip } from '@/components/ui/feedback/Chip';
import { Modal } from '@/components/ui/surfaces/Modal';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { FormField } from './FormField';
import { optionMatchText, type SelectOption } from './Select';

export interface MultiSelectProps<V extends string = string> {
  options: SelectOption<V>[];
  value?: V[];
  defaultValue?: V[];
  onChange?: (value: V[]) => void;
  placeholder?: string;
  startAdornment?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Show - search input above the listbox to filter options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsLabel?: ReactNode;
  /** Visible chip rows before overflowing into the "+N" pill. Default 1. */
  maxChipRows?: number;
  /** Title for the overflow modal. Defaults to "Selected items". */
  overflowTitle?: ReactNode;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

// Vertical metrics only — keep `min-h-*` + `py-*` (rather than Select's fixed
// `h-*`) because the trigger has to grow vertically to wrap chip rows.
const SIZE_CLS = {
  sm: 'min-h-8  text-xs py-1',
  md: 'min-h-10 text-sm py-1.5',
  lg: 'min-h-12 text-sm py-2',
} as const;

// Horizontal padding is CONTEXT-AWARE:
//   • placeholder only → mirror `<Select>`'s SIZE_CLS (px-3/px-3.5/px-4) so
//     an empty MultiSelect lines up pixel-for-pixel with a sibling Select.
//   • chips present     → tighter padding (the original metrics) so the
//     soft chips have room to breathe against the trigger edge.
const PAD_PLACEHOLDER = { sm: 'px-3', md: 'px-3.5', lg: 'px-4'   } as const;
const PAD_CHIPS       = { sm: 'px-2', md: 'px-2',   lg: 'px-2.5' } as const;

/** Single resting surface for every field — always white
 *  (`surface-card`).  See `Input.tsx`: the old tinted `default` shade
 *  read as disabled, so the shade variants were removed. */
const SURFACE_REST = 'bg-(--color-surface-card)';

const CHIP_SIZE = { sm: 'sm', md: 'md', lg: 'md' } as const;

/** Dropdown open / close motion — mirrors `<Select>` and the
 *  `<UserMenu>` chrome so every floating panel in the app shares one
 *  motion vocabulary: slide-in 8 px + fade in on open, slide-out 8 px +
 *  fade out on close.  Direction flips with `dropDirection`. */
const DROPDOWN_ENTER_MS = 220;
const DROPDOWN_EXIT_MS  = 160;
const DROPDOWN_EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

function MultiSelectInner<V extends string = string>(
  {
    options,
    value, defaultValue, onChange,
    placeholder = 'Select',
    startAdornment,
    size = 'md',
    searchable,
    searchPlaceholder = 'Search...',
    noResultsLabel = 'No matches',
    maxChipRows = 1,
    overflowTitle,
    label, helper, error, required, invalid, disabled, fullWidth = true,
    className, id, name,
  }: MultiSelectProps<V>,
  _ref: React.Ref<HTMLDivElement>,
) {
  /** Modal title falls back to the field label, then to - generic copy. */
  const resolvedOverflowTitle: ReactNode =
    overflowTitle ?? label ?? 'Selected items';
  /** AutoAnimate ref for the overflow modal's chip grid — chips
   *  removed via the modal's per-chip ✕ button slide out via FLIP
   *  while the remaining chips re-flow into the freed space. */
  const [overflowChipsRef] = useAutoAnimate<HTMLDivElement>();
  const autoId  = useId();
  const ctrlId  = id ?? autoId;
  const isError = invalid || !!error;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<V[]>(defaultValue ?? []);
  const current: V[] = isControlled ? value! : internal;

  const selectedOpts = useMemo(
    () => current
      .map(v => options.find(o => o.value === v))
      .filter((o): o is SelectOption<V> => !!o),
    [current, options],
  );

  const [open,     setOpen]      = useState(false);
  const [query,    setQuery]     = useState('');
  const [activeIdx, setActive]   = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Dropdown mount / visible lifecycle — mirrors `<Select>` so the
  // exit transition can play before the portal unmounts.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const enterScheduledRef = useRef(false);

  const rootRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  /** Drop direction + viewport position for the portaled popover. Flips to
   *  "up" when there's not enough room below. */
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Mount/unmount lifecycle — keep the portal alive while the exit
  // transition plays.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setVisible(false);
    enterScheduledRef.current = false;
    const t = setTimeout(() => setMounted(false), DROPDOWN_EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Schedule the enter transition once per mount cycle.
  useEffect(() => {
    if (!mounted || enterScheduledRef.current) return;
    enterScheduledRef.current = true;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
      enterScheduledRef.current = false;
    };
  }, [mounted]);

  useLayoutEffect(() => {
    if (!open) return;
    const trig = triggerRef.current;
    if (!trig) return;
    const recompute = () => {
      const rect = trig.getBoundingClientRect();
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const estimated = 260;
      const upwards = spaceBelow < estimated && spaceAbove > spaceBelow;
      setDropDirection(upwards ? 'up' : 'down');
      setPopoverPos({
        left:  rect.left,
        top:   upwards ? rect.top - 4 : rect.bottom + 4,
        width: rect.width,
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  // aa Filtering 
  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => optionMatchText(o).toLowerCase().includes(q));
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
  }, [open, filtered]);

  useEffect(() => {
    if (!open || !searchable) return;
    setQuery('');
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, searchable]);

  // Close on outside click — accounts for the portaled popover.
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideTrigger && !insidePopover) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll active option into view inside the listbox.
  useEffect(() => {
    if (!open) return;
    const ul = listRef.current;
    const li = ul?.children[activeIdx] as HTMLElement | undefined;
    if (!ul || !li) return;
    const top = li.offsetTop;
    const bottom = top + li.clientHeight;
    if (top < ul.scrollTop) ul.scrollTop = top;
    else if (bottom > ul.scrollTop + ul.clientHeight) ul.scrollTop = bottom - ul.clientHeight;
  }, [activeIdx, open]);

  // aa Selection helpers 
  const setValueExternal = useCallback((next: V[]) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [isControlled, onChange]);

  const toggle = useCallback((v: V) => {
    const next = current.includes(v) ? current.filter(x => x !== v) : [...current, v];
    setValueExternal(next);
  }, [current, setValueExternal]);

  const remove = useCallback((v: V) => {
    setValueExternal(current.filter(x => x !== v));
  }, [current, setValueExternal]);

  const clearAll = useCallback(() => setValueExternal([]), [setValueExternal]);

  // aa Keyboard 
  const handleListKey = (key: string) => {
    if (key === 'Enter' || key === ' ') {
      const opt = filtered[activeIdx];
      if (opt && !opt.disabled) toggle(opt.value);
    }
    if (key === 'ArrowDown') setActive(i => Math.min(filtered.length - 1, i + 1));
    if (key === 'ArrowUp')   setActive(i => Math.max(0, i - 1));
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      handleListKey(e.key);
    }
    if (e.key === 'Backspace' && current.length > 0 && !searchable) {
      // remove the last chip
      setValueExternal(current.slice(0, -1));
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault();
      handleListKey(e.key);
    }
  };

  const onTriggerClick = () => {
    if (disabled) return;
    setOpen(o => !o);
  };

  // Background resolved ONCE so two `bg-*` utilities never stack —
  // same rationale as Input's `bgCls`.
  const bgCls = disabled ? 'bg-(--color-surface-subtle)' : SURFACE_REST;

  const triggerCls = cn(
    'flex w-full items-center gap-2 rounded-md border',
    'text-left transition-colors outline-none select-none cursor-pointer',
    SIZE_CLS[size],
    selectedOpts.length === 0 ? PAD_PLACEHOLDER[size] : PAD_CHIPS[size],
    fullWidth && 'w-full',
    bgCls,
    isError
      ? 'border-error-500'
      : open
        ? 'border-primary-600'
        : 'border-(--color-border-strong) hover:border-neutral-400',
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  const chipSize = CHIP_SIZE[size];

  const field = (
    <div
      ref={rootRef}
      data-component="MultiSelect"
      data-size={size}
      data-searchable={searchable || undefined}
      className={cn('relative', fullWidth && 'w-full')}
    >
      {name && current.map((v, i) => (
        <input key={i} type="hidden" name={`${name}[]`} value={v} readOnly />
      ))}

      <div
        ref={triggerRef}
        role="combobox"
        id={ctrlId}
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={isError || undefined}
        className={triggerCls}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKey}
      >
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {startAdornment && <span className="text-(--color-text-subtle) shrink-0 self-center">{startAdornment}</span>}

          {selectedOpts.length === 0 ? (
            <span className="text-(--color-text-subtle) truncate">{placeholder}</span>
          ) : (
            <ChipStack
              chips={selectedOpts}
              chipSize={chipSize}
              maxRows={maxChipRows}
              onRemove={(v) => remove(v)}
              onOverflowClick={() => { setOpen(false); setOverflowOpen(true); }}
              disabled={disabled}
            />
          )}
        </div>

        <Icon icon={PiCaretDown} size={14} className={cn('text-(--color-text-subtle) shrink-0 self-center transition-transform', open && 'rotate-180')} />
      </div>

      {mounted && popoverPos && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          // React synthesises events along the React tree, so a click here
          // would still bubble up to ancestor onMouseDown handlers (e.g.
          // Modal's outside-click detector).  Stop it.
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-300 rounded-md border border-(--color-border-default) bg-(--color-surface-card) shadow-lg min-w-64 max-w-96"
          style={{
            left:   popoverPos.left,
            top:    dropDirection === 'up' ? undefined : popoverPos.top,
            bottom: dropDirection === 'up' ? window.innerHeight - popoverPos.top : undefined,
            width:  popoverPos.width,
            // Slide-in 8 px + fade — direction follows `dropDirection`
            // so the panel slides AWAY from the trigger.
            opacity: visible ? 1 : 0,
            transform: visible
              ? 'translate3d(0, 0, 0)'
              : dropDirection === 'up'
                ? 'translate3d(0, 8px, 0)'
                : 'translate3d(0, -8px, 0)',
            transition: `opacity ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}, transform ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}`,
          }}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-(--color-border-muted) px-2.5 py-2">
              <Icon icon={PiMagnifyingGlass} size={14} className="text-(--color-text-subtle) shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-[13px] text-(--color-text-strong) placeholder:text-(--color-text-subtle) outline-none"
              />
              {current.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearAll(); }}
                  className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted) hover:text-error-600"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[13px] text-(--color-text-muted)">{noResultsLabel}</div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-multiselectable
              className="max-h-64 overflow-auto p-1"
            >
              {filtered.map((opt, idx) => {
                const isSelected = current.includes(opt.value);
                const isActive   = idx === activeIdx;
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) toggle(opt.value); }}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 text-sm leading-tight',
                      opt.disabled && 'opacity-50 cursor-not-allowed',
                      isSelected
                        ? 'bg-primary-50 text-primary-800'
                        : isActive
                          ? 'bg-(--color-surface-subtle) text-(--color-text-strong)'
                          : 'text-(--color-text-default)',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'inline-flex size-4 shrink-0 items-center justify-center rounded border',
                        isSelected
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-(--color-border-strong) bg-(--color-surface-card)',
                      )}
                    >
                      {isSelected && <Icon icon={PiCheck} size={10} />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}

      {/* Overflow modal - shows every selected chip so the user can remove any one */}
      <Modal
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        size="sm"
        className="max-w-120!"
        density="compact"
        title={resolvedOverflowTitle}
        description={`${selectedOpts.length} selected`}
        footer={
          <>
            <Button variant="ghost" color="neutral" onClick={clearAll} disabled={selectedOpts.length === 0}>
              Clear all
            </Button>
            <Button onClick={() => setOverflowOpen(false)}>Done</Button>
          </>
        }
      >
        <div ref={overflowChipsRef} className="flex flex-wrap gap-1.5">
          {selectedOpts.length === 0 ? (
            <Typography variant="bodySm">No items selected.</Typography>
          ) : (
            selectedOpts.map(opt => (
              <Chip
                key={String(opt.value)}
                color="primary"
                variant="soft"
                size="md"
                onRemove={() => remove(opt.value)}
              >
                {opt.label}
              </Chip>
            ))
          )}
        </div>
      </Modal>
    </div>
  );

  if (label || helper || error) {
    return (
      <FormField label={label} helper={helper} error={error} required={required} htmlFor={ctrlId}>
        {field}
      </FormField>
    );
  }
  return field;
}

// Chip stack with row-clip + "+N" overflow pill 
interface ChipStackProps<V extends string> {
  chips: SelectOption<V>[];
  chipSize: 'sm' | 'md';
  maxRows: number;
  onRemove: (v: V) => void;
  onOverflowClick: () => void;
  disabled?: boolean;
}

function ChipStack<V extends string>({
  chips, chipSize, maxRows, onRemove, onOverflowClick, disabled,
}: ChipStackProps<V>) {
  // INLINE ChipStack intentionally does NOT use AutoAnimate — the
  // row-bucketing measure logic below reads each chip's `offsetTop`
  // to decide how many fit per row, and AutoAnimate's enter / exit
  // animations apply `position: absolute` + transforms to chips
  // mid-flight.  That makes `offsetTop` unreliable for one or two
  // ResizeObserver ticks per mutation — the measure sees the
  // animating chip on a phantom row, decides it overflows, and
  // collapses `visibleCount` to 0 (so the row paints only the
  // "+N" pill with no leading chips).  The overflow MODAL chip
  // grid (no measure) still uses AutoAnimate — see
  // `overflowChipsRef` at the top of `MultiSelectInner`.
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(chips.length);

  // Derived-state pattern - reset visibleCount during render when `chips`
  // identity changes. React discards the in-flight render and retries with
  // the fresh state in the same commit, so there's no flicker and the
  // measurement layout-effect always sees a "show everything" baseline before
  // contracting.
  const lastChipsRef = useRef(chips);
  if (lastChipsRef.current !== chips) {
    lastChipsRef.current = chips;
    setVisibleCount(chips.length);
  }

  // Measure & contract. Items are bucketed by their unique offsetTop (one
  // bucket per visual row) so the math survives any flex `gap` value, and
  // the +N pill is treated specially: if IT'S the first item that overflows,
  // we contract by one more chip so it can sit on the last allowed row.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const items = Array.from(el.querySelectorAll<HTMLElement>('[data-chip-slot]'));
      if (items.length === 0) return;

      const uniqueRowTops = Array.from(new Set(items.map(i => i.offsetTop))).sort((a, b) => a - b);
      if (uniqueRowTops.length <= maxRows) return; // already fits

      const allowed = new Set(uniqueRowTops.slice(0, maxRows));

      let firstOverflowIdx = -1;
      for (let i = 0; i < items.length; i++) {
        if (!allowed.has(items[i].offsetTop)) { firstOverflowIdx = i; break; }
      }
      if (firstOverflowIdx === -1) return;

      const overflowItem = items[firstOverflowIdx];
      const isPillOverflowing = overflowItem.dataset.chipSlot === 'more';
      const newVisible = isPillOverflowing
        ? Math.max(0, visibleCount - 1)
        : firstOverflowIdx;

      setVisibleCount(prev => Math.min(prev, newVisible));
    };

    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, chips, maxRows]);

  const hidden = chips.length - visibleCount;

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1 min-w-0">
      {chips.slice(0, visibleCount).map(opt => (
        <span key={String(opt.value)} data-chip-slot="item">
          <Chip
            color="primary"
            variant="soft"
            size={chipSize}
            onRemove={disabled ? undefined : () => onRemove(opt.value)}
          >
            {opt.label}
          </Chip>
        </span>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          data-chip-slot="more"
          onClick={(e) => { e.stopPropagation(); onOverflowClick(); }}
          className={cn(
            'inline-flex items-center font-semibold rounded-md select-none',
            'bg-neutral-200 text-(--color-text-default) hover:bg-neutral-300',
            chipSize === 'sm' ? 'h-5 px-2 text-[10.5px]' : 'h-6 px-2.5 text-[11.5px]',
          )}
        >
          +{hidden}
        </button>
      )}
    </div>
  );
}

// Forward ref + preserve generic
export const MultiSelect = forwardRef(MultiSelectInner) as <V extends string = string>(
  props: MultiSelectProps<V> & { ref?: React.Ref<HTMLDivElement> },
) => ReactElement;

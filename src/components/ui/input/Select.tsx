'use client';

import {
  forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, PiCaretDown, PiMagnifyingGlass } from '@/lib/icons';
import { FormField } from './FormField';

export interface SelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  /** Plain text used for the searchable filter. Falls back to label when it's a string. */
  searchValue?: string;
}

export interface SelectProps<V extends string = string> {
  options: SelectOption<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
  placeholder?: string;
  startAdornment?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Show a search input at the top of the dropdown that filters options. */
  searchable?: boolean;
  /** Placeholder for the inline search input (when `searchable`). */
  searchPlaceholder?: string;
  /** Message shown when the search yields no matches. */
  noResultsLabel?: ReactNode;
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

const SIZE_CLS = {
  sm: 'h-8  text-xs px-3',
  md: 'h-10 text-sm px-3.5',
  lg: 'h-12 text-sm px-4',
} as const;

/** Dropdown open / close motion — matches the `<UserMenu>` chrome in
 *  Header.tsx so every floating panel in the app shares one motion
 *  vocabulary: slide-in 8 px + fade in on open, slide-out 8 px + fade
 *  out on close.  Direction flips with `dropDirection` so the panel
 *  always slides AWAY from the trigger. */
const DROPDOWN_ENTER_MS = 220;
const DROPDOWN_EXIT_MS  = 160;
const DROPDOWN_EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Single resting surface for every field — always white
 *  (`surface-card`).  See `Input.tsx`: the old tinted `default` shade
 *  read as disabled, so the shade variants were removed. */
const SURFACE_REST = 'bg-(--color-surface-card)';

export function optionMatchText<V extends string>(opt: SelectOption<V>): string {
  if (opt.searchValue) return opt.searchValue;
  if (typeof opt.label === 'string') return opt.label;
  return String(opt.value);
}

function SelectInner<V extends string = string>(
  {
    options,
    value, defaultValue, onChange,
    placeholder = 'Select',
    startAdornment,
    size = 'md',
    searchable,
    searchPlaceholder = 'Search…',
    noResultsLabel = 'No matches',
    label, helper, error, required, invalid, disabled, fullWidth = true,
    className, id, name,
  }: SelectProps<V>,
  _ref: React.Ref<HTMLDivElement>,
) {
  const autoId = useId();
  const ctrlId = id ?? autoId;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<V | undefined>(defaultValue);
  const current = isControlled ? value : internal;
  const selected = options.find(o => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Dropdown mount / visible lifecycle — mirrors the UserMenu in
  // Header.tsx.  `mounted` keeps the portal alive through the exit
  // transition; `visible` drives the inline opacity + transform.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const enterScheduledRef = useRef(false);

  const rootRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const isError = invalid || !!error;

  /** Drop direction + viewport-relative position for the portaled popover.
   *  Flips to "up" when there isn't enough room below. */
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Mount/unmount lifecycle — keep the portal alive while the exit
  // transition plays, then drop it from the DOM after the exit window.
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

  // Schedule the enter transition once per mount cycle.  Double rAF
  // so the first paint sees opacity:0 + translate3d(-8px) and the
  // next paint flips to the visible state, giving the CSS transition
  // a delta to animate from.
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

  // Filtered list based on query.  When not searchable, this is just `options`.
  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => optionMatchText(o).toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Reset active index when the filter changes; also when opening, jump to current.
  useEffect(() => {
    if (!open) return;
    const i = filtered.findIndex(o => o.value === current);
    setActiveIdx(i >= 0 ? i : 0);
  }, [open, filtered, current]);

  // Reset query and focus search when (re)opening
  useEffect(() => {
    if (!open) return;
    if (searchable) {
      setQuery('');
      // Defer to next frame so the input has mounted before focus.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  // Close on outside click — accounts for the portaled popover so a click
  // on its scrollbar / search input doesn't dismiss it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideTrigger && !insidePopover) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll active option into view inside the listbox (no page jumps).
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

  const pick = useCallback((v: V) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
    setOpen(false);
  }, [isControlled, onChange]);

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      handleListKey(e.key);
    }
  };

  const handleListKey = (key: string) => {
    if (key === 'Enter' || key === ' ') {
      const opt = filtered[activeIdx];
      if (opt && !opt.disabled) pick(opt.value);
    }
    if (key === 'ArrowDown') setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
    if (key === 'ArrowUp')   setActiveIdx(i => Math.max(0, i - 1));
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault();
      handleListKey(e.key);
    }
  };

  // Background resolved ONCE so two `bg-*` utilities never stack —
  // same rationale as Input's `bgCls`.
  const bgCls = disabled ? 'bg-(--color-surface-subtle)' : SURFACE_REST;

  const triggerCls = cn(
    'inline-flex items-center justify-between gap-2 rounded-md border',
    'text-left transition-colors outline-none select-none',
    SIZE_CLS[size],
    fullWidth && 'w-full',
    bgCls,
    isError
      ? 'border-error-500'
      : open
        ? 'border-primary-600'
        : 'border-(--color-border-strong) hover:border-(--color-text-subtle)',
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  const field = (
    <div
      ref={rootRef}
      data-component="Select"
      data-size={size}
      data-searchable={searchable || undefined}
      className={cn('relative', fullWidth && 'w-full')}
    >
      {name && <input type="hidden" name={name} value={current ?? ''} readOnly />}
      <button
        ref={triggerRef}
        type="button"
        id={ctrlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={isError || undefined}
        className={triggerCls}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onTriggerKey}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 text-(--color-text-default)">
          {startAdornment && <span className="shrink-0">{startAdornment}</span>}
          {/* String labels and JSX labels need different wrappers:
              • String  → inline `truncate` span gives proper text-
                          overflow ellipsis when the value overflows.
              • ReactNode → flex item so any `inline-flex` inside the
                          label (icon + text) lines up against the
                          outer flex's `items-center` baseline.  An
                          inline truncate wrapper would put the
                          inline-flex in an inline context where its
                          baseline drifts a couple of pixels, which
                          read as a "slight horizontal misalignment"
                          next to icon-less options in the same list. */}
          {selected
            ? (typeof selected.label === 'string'
                ? <span className="truncate">{selected.label}</span>
                : <span className="flex items-center min-w-0 flex-1 truncate">{selected.label}</span>)
            : <span className="truncate text-(--color-text-subtle)">{placeholder}</span>}
        </span>
        <Icon icon={PiCaretDown} size={14} className={cn('text-(--color-text-subtle) transition-transform', open && 'rotate-180')} />
      </button>

      {mounted && popoverPos && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          // React synthesises events along the React tree, so a click here
          // would still bubble up to ancestor onMouseDown handlers (e.g.
          // Modal's outside-click detector).  Stop it.
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[300] rounded-md border border-(--color-border-default) bg-(--color-surface-raised) shadow-lg"
          style={{
            left:  popoverPos.left,
            top:   dropDirection === 'up' ? undefined : popoverPos.top,
            bottom:dropDirection === 'up' ? window.innerHeight - popoverPos.top : undefined,
            // The dropdown panel matches the trigger width by default
            // but never collapses below 256 px — gives the options
            // (especially with icons / long labels) enough room to
            // breathe when the Select sits in a narrow column.
            width:    Math.max(popoverPos.width, 256),
            minWidth: 256,
            // Slide-in 8 px + fade — direction follows the drop
            // anchor so the panel always slides AWAY from the
            // trigger (down-drop slides DOWN into place, up-drop
            // slides UP into place).
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
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[13px] text-(--color-text-muted)">{noResultsLabel}</div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-auto p-1"
            >
              {filtered.map((opt, idx) => {
                const isSelected = opt.value === current;
                const isActive = idx === activeIdx;
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) pick(opt.value); }}
                    className={cn(
                      'cursor-pointer rounded px-2.5 py-1.5 text-sm leading-tight',
                      opt.disabled && 'opacity-50 cursor-not-allowed',
                      isSelected
                        ? 'bg-primary-100 text-primary-800 font-semibold'
                        : isActive
                          ? 'bg-primary-50 text-(--color-text-strong)'
                          : 'text-(--color-text-default)',
                    )}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}
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

// Forward ref + preserve generic
export const Select = forwardRef(SelectInner) as <V extends string = string>(
  props: SelectProps<V> & { ref?: React.Ref<HTMLDivElement> },
) => ReactElement;

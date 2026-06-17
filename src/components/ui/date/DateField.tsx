'use client';

import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, PiCalendarBlank, PiCaretDown } from '@/lib/icons';
import { FormField } from '@/components/ui/input/FormField';
import { DatePicker, type DatePickerMode } from './DatePicker';

export type DateFieldSize  = 'sm' | 'md' | 'lg';

export interface DateFieldProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  /** Disable selection of dates outside [min, max]. */
  min?: Date;
  max?: Date;
  size?:  DateFieldSize;
  /** `date` (default) opens a full calendar. `month` opens a month grid with
   *  year navigation — the value snaps to the 1st of the selected month and
   *  the display format becomes `MMM YYYY`. */
  pickerMode?: DatePickerMode;
  placeholder?: string;
  /** Visible label above the control. */
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  /** Format used for the displayed value.  Defaults to en-US `MM/DD/YYYY`
   *  (or `MMM YYYY` when pickerMode="month"). */
  format?: (date: Date) => string;
}

const SIZE_CLS: Record<DateFieldSize, string> = {
  sm: 'h-8  text-xs px-3',
  md: 'h-10 text-sm px-3.5',
  lg: 'h-12 text-sm px-4',
};

/** Popover open / close motion — matches `<Select>` / `<MultiSelect>`
 *  / `<ColorPicker>` so every floating panel in the app shares one
 *  motion vocabulary: slide-in 8 px + fade in on open, slide-out
 *  8 px + fade out on close. */
const DROPDOWN_ENTER_MS = 220;
const DROPDOWN_EXIT_MS  = 160;
const DROPDOWN_EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Single resting surface for every field — always white
 *  (`surface-card`).  See `Input.tsx`: the old tinted `default` shade
 *  read as disabled, so the shade variants were removed. */
const SURFACE_REST = 'bg-(--color-surface-card)';

const DEFAULT_FORMAT       = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
const DEFAULT_MONTH_FORMAT = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

/**
 * Date input that triggers a popup with the project DatePicker.  Matches the
 * Input/Select visual contract — label, helper, error, sizes — so it composes
 * naturally in form grids.
 */
export function DateField({
  value,
  defaultValue,
  onChange,
  min, max,
  size = 'md',
  pickerMode = 'date',
  placeholder,
  label, helper, error, required, invalid, disabled,
  fullWidth = true,
  className, id,
  format,
}: DateFieldProps) {
  const monthOnly = pickerMode === 'month';
  const fmt = format ?? (monthOnly ? DEFAULT_MONTH_FORMAT : DEFAULT_FORMAT);
  const placeholderText = placeholder ?? (monthOnly ? 'Select month…' : 'Select date…');
  const autoId = useId();
  const inputId = id ?? autoId;
  const isError = invalid || !!error;
  const isControlled = value !== undefined;

  const [internal, setInternal] = useState<Date | null>(defaultValue ?? null);
  const current = isControlled ? value ?? null : internal;

  const [open, setOpen] = useState(false);
  const rootRef    = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Popover position is computed in viewport coordinates and applied via
  // `position: fixed` so it can escape any ancestor `overflow: auto / hidden`
  // (modals, drawers, scrollable cards, etc.).
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number } | null>(null);

  // Popover mount / visible lifecycle — mirrors `<Select>` so the
  // exit transition can play before the portal unmounts.  `mounted`
  // keeps it in the DOM through the exit window; `visible` drives
  // the inline opacity + transform.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const enterScheduledRef = useRef(false);

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
  // next paint flips to visible, giving the CSS transition a delta
  // to animate from.
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
    if (!open || !rootRef.current) return;
    const update = () => {
      const trigger = rootRef.current?.querySelector('button');
      if (!trigger) return;
      const r = (trigger as HTMLElement).getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 4, minWidth: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideTrigger && !insidePopover) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (d: Date) => {
    if (!isControlled) setInternal(d);
    onChange?.(d);
    setOpen(false);
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
      data-component="DateField"
      data-size={size}
      data-picker-mode={pickerMode}
      className={cn('relative', fullWidth && 'w-full')}
    >
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={isError || undefined}
        className={triggerCls}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <Icon icon={PiCalendarBlank} size={size === 'sm' ? 14 : 16} className="text-(--color-text-subtle) shrink-0" />
          <span className={cn('truncate', current ? 'text-(--color-text-strong)' : 'text-(--color-text-subtle)')}>
            {current ? fmt(current) : placeholderText}
          </span>
        </span>
        <Icon
          icon={PiCaretDown}
          size={14}
          className={cn('text-(--color-text-subtle) transition-transform', open && 'rotate-180')}
        />
      </button>

      {mounted && pos && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          // React synthesises events along the React tree, so a click here
          // would still bubble up to ancestor onMouseDown handlers (e.g.
          // Modal's outside-click detector).  Stop it.
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[300]"
          style={{
            left: pos.left,
            top: pos.top,
            minWidth: pos.minWidth,
            // Slide-in 8 px + fade — same vocabulary as Select /
            // MultiSelect / ColorPicker.  The popover always anchors
            // below the trigger, so it slides DOWN into place on
            // open and UP out on close.
            opacity: visible ? 1 : 0,
            transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -8px, 0)',
            transition: `opacity ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}, transform ${visible ? DROPDOWN_ENTER_MS : DROPDOWN_EXIT_MS}ms ${DROPDOWN_EASE}`,
          }}
        >
          <DatePicker
            value={current}
            onChange={pick}
            min={min}
            max={max}
            pickerMode={pickerMode}
            className="!border-solid !border-(--color-border-default) shadow-lg bg-(--color-surface-raised)"
          />
        </div>,
        document.body,
      )}
    </div>
  );

  if (label || helper || error) {
    return (
      <FormField label={label} helper={helper} error={error} required={required} htmlFor={inputId}>
        {field}
      </FormField>
    );
  }
  return field;
}

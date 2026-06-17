'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretLeft, PiCaretRight, PiCaretDown } from '@/lib/icons';

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type DatePickerMode = 'date' | 'month';

export interface DatePickerProps {
  /** Selected date (controlled). */
  value?: Date | null;
  onChange?: (date: Date) => void;
  /** Initial month shown - defaults to today or `value`. */
  defaultViewDate?: Date;
  /** Disable selection of dates outside [min, max]. */
  min?: Date;
  max?: Date;
  /** `date` (default) picks a specific day. `month` skips the day grid: the
   *  user picks year + month and the value snaps to the 1st of that month. */
  pickerMode?: DatePickerMode;
  className?: string;
}

type Mode = 'days' | 'months' | 'years';

/**
 * Full-featured calendar matching Form.pdf - click the month name to switch
 * to - month-grid, click the year to switch to - year-grid, click - day to
 * select it. Chevrons cycle the unit shown by the current mode.
 */
export function DatePicker({
  value, onChange,
  defaultViewDate, min, max,
  pickerMode = 'date',
  className,
}: DatePickerProps) {
  const monthOnly = pickerMode === 'month';
  const [view, setView] = useState<Date>(() => {
    const d = value ?? defaultViewDate ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mode, setMode] = useState<Mode>(monthOnly ? 'months' : 'days');

  const cells = useMemo(() => buildMonthGrid(view), [view]);

  // aa navigation 
  const cycle = (delta: number) => {
    if (mode === 'days')   setView(v => new Date(v.getFullYear(), v.getMonth() + delta, 1));
    if (mode === 'months') setView(v => new Date(v.getFullYear() + delta, v.getMonth(), 1));
    if (mode === 'years')  setView(v => new Date(v.getFullYear() + delta * 12, v.getMonth(), 1));
  };

  const pickMonth = (m: number) => {
    const next = new Date(view.getFullYear(), m, 1);
    setView(next);
    if (monthOnly) {
      // In month-only mode the month grid IS the selection step — emit the
      // value (snapped to the 1st of the month) and stay in months view.
      onChange?.(next);
    } else {
      setMode('days');
    }
  };
  const pickYear = (y: number) => {
    setView(v => new Date(y, v.getMonth(), 1));
    setMode('months');
  };

  const isSameDay = (a: Date | null | undefined, b: Date) =>
    !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const outOfRange = (d: Date) => (min && d < startOfDay(min)) || (max && d > startOfDay(max));

  // Range of years shown in `years` mode (current view year - 5)
  const yearRange = useMemo(() => {
    const center = view.getFullYear();
    const start = center - 5;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);

  return (
    <div data-component="DatePicker" className={cn('inline-block rounded-lg border border-dashed border-primary-400 bg-(--color-surface-card) p-3 w-[260px]', className)}>
      {/* header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => cycle(-1)}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-surface-subtle)"
        >
          <Icon icon={PiCaretLeft} size={14} />
        </button>

        <span className="flex items-center gap-1 text-xs font-semibold text-(--color-text-default)">
          {mode === 'years' ? (
            <span className="px-1">
              {yearRange[0]} a {yearRange[yearRange.length - 1]}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode(mode === 'months' ? 'days' : 'months')}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-(--color-surface-subtle)"
              >
                {MONTH_NAMES[view.getMonth()]}
                <Icon icon={PiCaretDown} size={12} className="text-(--color-text-subtle)" />
              </button>
              <button
                type="button"
                onClick={() => setMode('years')}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-(--color-surface-subtle)"
              >
                {view.getFullYear()}
                <Icon icon={PiCaretDown} size={12} className="text-(--color-text-subtle)" />
              </button>
            </>
          )}
        </span>

        <button
          type="button"
          aria-label="Next"
          onClick={() => cycle(1)}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-surface-subtle)"
        >
          <Icon icon={PiCaretRight} size={14} />
        </button>
      </div>

      {mode === 'days' && (
        <>
          {/* weekday row */}
          <div className="grid grid-cols-7 gap-0.5 px-0.5">
            {WEEKDAYS_SHORT.map(w => (
              <span key={w} className="text-center text-[10px] font-semibold uppercase tracking-wide text-(--color-text-subtle)">
                {w}
              </span>
            ))}
          </div>

          {/* days */}
          <div className="mt-1 grid grid-cols-7 gap-0.5 px-0.5">
            {cells.map((cell, idx) => {
              const selected = isSameDay(value ?? null, cell.date);
              const disabled = outOfRange(cell.date);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onChange?.(cell.date)}
                  className={cn(
                    'h-7 w-7 mx-auto rounded-full text-[11px] font-medium transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    cell.muted ? 'text-(--color-text-faint)' : 'text-(--color-text-default)',
                    selected
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'hover:bg-primary-50 hover:text-primary-700',
                  )}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === 'months' && (
        <div className="grid grid-cols-3 gap-1.5 px-0.5">
          {MONTH_NAMES_SHORT.map((m, i) => {
            const selected = monthOnly
              ? !!value && value.getFullYear() === view.getFullYear() && i === value.getMonth()
              : i === view.getMonth();
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => pickMonth(i)}
                className={cn(
                  'h-9 rounded text-xs font-semibold transition-colors',
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'bg-(--color-surface-card) text-(--color-text-muted) hover:bg-primary-50 hover:text-primary-700',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      {mode === 'years' && (
        <div className="grid grid-cols-3 gap-1.5 px-0.5">
          {yearRange.map(y => {
            const selected = y === view.getFullYear();
            return (
              <button
                key={y}
                type="button"
                aria-pressed={selected}
                onClick={() => pickYear(y)}
                className={cn(
                  'h-9 rounded text-xs font-semibold transition-colors',
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'bg-(--color-surface-card) text-(--color-text-muted) hover:bg-primary-50 hover:text-primary-700',
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// aa helpers 
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface Cell { date: Date; muted: boolean; }

/** Build - 6 "a7 month grid, Monday-first, with leading/trailing days flagged as muted. */
function buildMonthGrid(viewDate: Date): Cell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const jsDay = firstOfMonth.getDay();
  const leading = (jsDay + 6) % 7; // shift to Mon-first

  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - leading + i);
    cells.push({ date: d, muted: d.getMonth() !== month });
  }
  return cells;
}

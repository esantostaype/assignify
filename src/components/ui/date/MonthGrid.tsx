'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretLeft, PiCaretRight } from '@/lib/icons';

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export interface MonthGridProps {
  /** Selected 0-based month index. */
  value?: number;
  onChange?: (month: number) => void;
  /** Currently displayed year. */
  year?: number;
  onYearChange?: (year: number) => void;
  className?: string;
}

/**
 * 3 "a4 month picker matching Form.pdf - chevrons cycle the year, one cell is
 * highlighted as primary when selected.
 */
export function MonthGrid({
  value, onChange, year, onYearChange, className,
}: MonthGridProps) {
  const [internalYear, setInternalYear] = useState(year ?? new Date().getFullYear());
  const currentYear = year ?? internalYear;

  const setYear = (y: number) => {
    if (year === undefined) setInternalYear(y);
    onYearChange?.(y);
  };

  return (
    <div data-component="MonthGrid" className={cn('inline-block rounded-lg border border-dashed border-primary-400 p-3 bg-(--color-surface-card)', className)}>
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          aria-label="Previous year"
          onClick={() => setYear(currentYear - 1)}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-surface-subtle)"
        >
          <Icon icon={PiCaretLeft} size={14} />
        </button>
        <span className="text-xs font-semibold text-(--color-text-default)">{currentYear}</span>
        <button
          type="button"
          aria-label="Next year"
          onClick={() => setYear(currentYear + 1)}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-surface-subtle)"
        >
          <Icon icon={PiCaretRight} size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {MONTH_NAMES_SHORT.map((m, i) => {
          const selected = i === value;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange?.(i)}
              className={cn(
                'h-7 w-12 rounded text-[11px] font-semibold transition-colors',
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
    </div>
  );
}

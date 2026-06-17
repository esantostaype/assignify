'use client';

import { cn } from '@/lib/cn';

const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

export interface MonthPillsProps {
  /** 0-based month index. */
  value?: number;
  onChange?: (month: number) => void;
  /** Months to display (defaults to current quarter around `value`). */
  months?: number[];
  className?: string;
}

/**
 * Pill row for quick month switching (the "Jan Feb Mar" chip row in Form.pdf).
 */
export function MonthPills({
  value, onChange,
  months = [0, 1, 2],
  className,
}: MonthPillsProps) {
  return (
    <div data-component="MonthPills" className={cn('inline-flex items-center gap-1 rounded-md border border-(--color-border-default) bg-(--color-surface-card) p-1', className)}>
      {months.map(i => {
        const selected = value === i;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange?.(i)}
            className={cn(
              'h-7 min-w-[44px] rounded px-2 text-[11px] font-semibold transition-colors',
              selected
                ? 'bg-primary-600 text-white'
                : 'text-(--color-text-muted) hover:bg-primary-50 hover:text-primary-700',
            )}
          >
            {M[i]}
          </button>
        );
      })}
    </div>
  );
}

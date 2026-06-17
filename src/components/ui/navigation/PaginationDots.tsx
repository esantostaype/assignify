'use client';

import { cn } from '@/lib/cn';

export interface PaginationDotsProps {
  /** Number of steps. */
  count: number;
  /** 0-based current index. */
  current: number;
  onChange?: (index: number) => void;
  className?: string;
}

/**
 * Step-indicator dots matching the row in Form.pdf â€” small neutral dots with
 * the active step rendered as a wider primary pill.
 */
export function PaginationDots({ count, current, onChange, className }: PaginationDotsProps) {
  return (
    <div data-component="PaginationDots" className={cn('inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary-400 p-1.5 bg-(--color-surface-card)', className)}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === current;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Step ${i + 1}`}
            aria-current={active}
            onClick={() => onChange?.(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              active ? 'w-5 bg-primary-600' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400',
            )}
          />
        );
      })}
    </div>
  );
}

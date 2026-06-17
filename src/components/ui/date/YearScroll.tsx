'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface YearScrollProps {
  /** Selected year. */
  value?: number;
  onChange?: (year: number) => void;
  /** Inclusive lower bound (default: current year - 50). */
  from?: number;
  /** Inclusive upper bound (default: current year + 5). */
  to?: number;
  className?: string;
}

/**
 * Vertical scrollable year picker the "20 / 21 / 22 " column from Form.pdf.
 */
export function YearScroll({
  value, onChange,
  from = new Date().getFullYear() - 50,
  to   = new Date().getFullYear() + 5,
  className,
}: YearScrollProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const years: number[] = [];
  for (let y = to; y >= from; y--) years.push(y);

  useEffect(() => {
    if (value === undefined) return;
    const idx = years.indexOf(value);
    if (idx < 0) return;
    const ul = listRef.current;
    const el = ul?.children[idx] as HTMLElement | undefined;
    if (!ul || !el) return;
    // Scroll the UL ONLY using element.scrollIntoView leaks to ancestor
    // containers (including the document), which causes the page to jump.
    ul.scrollTop = el.offsetTop - ul.clientHeight / 2 + el.clientHeight / 2;
  }, [value, years]);

  return (
    <ul
      ref={listRef}
      data-component="YearScroll"
      className={cn(
        'inline-block max-h-32 w-12 overflow-y-auto rounded-md border border-dashed border-primary-400 bg-(--color-surface-card) p-1 text-center',
        className,
      )}
    >
      {years.map(y => {
        const selected = y === value;
        return (
          <li key={y}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange?.(y)}
              className={cn(
                'block w-full rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                selected
                  ? 'bg-primary-600 text-white'
                  : 'text-(--color-text-muted) hover:bg-primary-50',
              )}
            >
              {String(y).slice(-2)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

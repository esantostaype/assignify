'use client';

import { cn } from '@/lib/cn';
import { Icon, PiCaretLeft, PiCaretRight } from '@/lib/icons';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Number of sibling pages on each side of the current page (default 1). */
  siblings?: number;
  className?: string;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function buildPages(page: number, total: number, siblings: number): (number | 'ellipsis')[] {
  const totalNumbers = siblings * 2 + 5;
  if (total <= totalNumbers) return range(1, total);

  const left  = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, total - 1);
  const showLeftDots  = left  > 2;
  const showRightDots = right < total - 1;

  const result: (number | 'ellipsis')[] = [1];
  if (showLeftDots) result.push('ellipsis');
  result.push(...range(left, right));
  if (showRightDots) result.push('ellipsis');
  result.push(total);
  return result;
}

export function Pagination({ page, totalPages, onChange, siblings = 1, className }: PaginationProps) {
  const pages = buildPages(page, totalPages, siblings);

  const Btn = ({ children, onClick, active, disabled, ariaLabel }: {
    children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; ariaLabel?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md text-[12.5px] font-semibold transition-colors',
        active
          ? 'bg-primary-500 text-white'
          : 'text-(--color-text-muted) hover:bg-(--color-surface-subtle)',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );

  return (
    <nav aria-label="Pagination" data-component="Pagination" className={cn('inline-flex items-center gap-1', className)}>
      <Btn ariaLabel="Previous page" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <Icon icon={PiCaretLeft} size={14} />
      </Btn>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          // Triple-dot gap separator — uses the Unicode ellipsis (U+2026)
          // so it renders as a single tight glyph instead of three
          // spaced periods (".. ." vs "…").  `aria-hidden` because the
          // <nav>'s aria-label already announces the pagination role.
          <span
            key={`e${i}`}
            aria-hidden
            className="px-1 text-(--color-text-subtle) select-none"
          >
            …
          </span>
        ) : (
          <Btn key={p} active={p === page} onClick={() => onChange(p)}>{p}</Btn>
        ),
      )}
      <Btn ariaLabel="Next page" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        <Icon icon={PiCaretRight} size={14} />
      </Btn>
    </nav>
  );
}

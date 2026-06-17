'use client';

import { cn } from '@/lib/cn';
import { useTheme, type ThemeMode } from './ThemeProvider';

const MODES: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'base',  label: 'Base',  description: 'Dark sidebar, light content' },
  { id: 'light', label: 'Light', description: 'Everything light' },
  { id: 'dark',  label: 'Dark',  description: 'Everything dark' },
];

export interface ThemeSwitcherProps {
  /** `inline` = horizontal pill group (compact, fits in a dropdown).
   *  `stacked` = vertical list with descriptions (richer, for menus). */
  layout?: 'inline' | 'stacked';
  className?: string;
}

export function ThemeSwitcher({ layout = 'stacked', className }: ThemeSwitcherProps) {
  const { mode, setMode } = useTheme();

  if (layout === 'inline') {
    return (
      <div
        role="radiogroup"
        aria-label="Theme mode"
        className={cn(
          'inline-flex items-center gap-1 p-1 rounded-full',
          'bg-(--color-surface-subtle) border border-(--color-border-default)',
          className,
        )}
      >
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.id)}
              className={cn(
                'px-3 h-7 rounded-full text-xs font-semibold transition-colors',
                active
                  ? 'bg-(--color-surface-card) text-(--color-text-strong) shadow-sm'
                  : 'text-(--color-text-muted) hover:text-(--color-text-default)',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme mode" className={cn('flex flex-col gap-1', className)}>
      {MODES.map(m => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(m.id)}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors',
              active
                ? 'bg-neutral-200'
                : 'hover:bg-neutral-100',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 grid place-items-center',
                active ? 'border-primary-600' : 'border-(--color-border-strong)',
              )}
            >
              {active && <span className="h-2 w-2 rounded-full bg-primary-600" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-(--color-text-default)">{m.label}</span>
              <span className="block text-[11.5px] text-(--color-text-muted) leading-tight mt-0.5">
                {m.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

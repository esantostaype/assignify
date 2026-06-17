'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

export interface MenuProps {
  /** Trigger element. */
  trigger: ReactNode;
  items: MenuItem[];
  placement?: 'bottom-start' | 'bottom-end';
  className?: string;
}

const PLACEMENT_CLS: Record<NonNullable<MenuProps['placement']>, string> = {
  'bottom-start': 'top-full left-0 mt-1.5',
  'bottom-end':   'top-full right-0 mt-1.5',
};

export function Menu({ trigger, items, placement = 'bottom-start', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={rootRef} data-component="Menu" className="relative inline-flex">
      <span onClick={() => setOpen(v => !v)}>{trigger}</span>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 min-w-[12rem] rounded-md border border-(--color-border-default) bg-(--color-surface-card) p-1 shadow-lg',
            PLACEMENT_CLS[placement],
            className,
          )}
        >
          {items.map((it, idx) => {
            if (it.divider) return <div key={`d-${idx}`} className="my-1 h-px bg-(--color-surface-subtle)" />;
            const cls = cn(
              'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12.5px] text-left cursor-pointer transition-colors',
              it.tone === 'danger' ? 'text-error-700 hover:bg-error-50' : 'text-(--color-text-default) hover:bg-(--color-surface-subtle)',
              it.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            );
            if (it.href) {
              return (
                <a key={idx} href={it.href} className={cls} onClick={() => setOpen(false)} role="menuitem">
                  {it.icon}{it.label}
                </a>
              );
            }
            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                onClick={() => { it.onClick?.(); setOpen(false); }}
                className={cls}
                disabled={it.disabled}
              >
                {it.icon}{it.label}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

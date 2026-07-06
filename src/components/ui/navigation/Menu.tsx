'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

export function Menu({ trigger, items, placement = 'bottom-start', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Viewport-relative position for the portaled panel — flips to "up"
  // when there isn't enough room below.  Mirrors `<Select>`'s own
  // positioning so every floating panel in the app behaves the same way
  // when it's hosted somewhere with clipping (e.g. a Modal's scroll body).
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const [pos, setPos] = useState<{ left: number; right: number; anchorY: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trig = triggerRef.current;
    if (!trig) return;
    const recompute = () => {
      const rect = trig.getBoundingClientRect();
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const estimated = 200;
      const upwards = spaceBelow < estimated && spaceAbove > spaceBelow;
      setDropDirection(upwards ? 'up' : 'down');
      setPos({
        left: rect.left,
        right: window.innerWidth - rect.right,
        anchorY: upwards ? rect.top - 4 : rect.bottom + 4,
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

  // Close on outside click — accounts for the portaled panel so a click
  // inside it doesn't register as "outside" the trigger.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = rootRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={rootRef} data-component="Menu" className="relative inline-flex">
      <span ref={triggerRef} onClick={() => setOpen(v => !v)}>{trigger}</span>
      {open && pos && typeof window !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="menu"
          // React synthesises events along the React tree, so a click here
          // would still bubble up to ancestor onMouseDown handlers (e.g.
          // Modal's outside-click detector).  Stop it.
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'fixed z-[300] min-w-[12rem] rounded-md border border-(--color-border-default) bg-(--color-surface-card) p-1 shadow-lg',
            className,
          )}
          style={{
            left:   placement === 'bottom-start' ? pos.left : undefined,
            right:  placement === 'bottom-end'   ? pos.right : undefined,
            top:    dropDirection === 'down' ? pos.anchorY : undefined,
            bottom: dropDirection === 'up'   ? window.innerHeight - pos.anchorY : undefined,
          }}
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
        </div>,
        document.body,
      )}
    </span>
  );
}

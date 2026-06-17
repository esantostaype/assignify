'use client';

import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PopoverProps {
  /** Trigger element that controls the popover. */
  children: ReactElement<any>;
  content: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const PLACEMENT_CLS: Record<NonNullable<PopoverProps['placement']>, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
};

export function Popover({
  children, content, placement = 'bottom',
  open: openProp, onOpenChange, className,
}: PopoverProps) {
  const [internal, setInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internal;
  const rootRef = useRef<HTMLSpanElement>(null);

  const setOpen = (v: boolean) => { if (!isControlled) setInternal(v); onOpenChange?.(v); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, any>>;

  const trigger = cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      child.props.onClick?.(e);
      setOpen(!open);
    },
    'aria-expanded': open,
  });

  return (
    <span ref={rootRef} data-component="Popover" className="relative inline-flex">
      {trigger}
      {open && (
        <span
          className={cn(
            'absolute z-50 rounded-md border border-(--color-border-default) bg-(--color-surface-raised) p-2 shadow-lg min-w-[10rem]',
            PLACEMENT_CLS[placement],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

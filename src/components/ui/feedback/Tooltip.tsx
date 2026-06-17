'use client';

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  content: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  /** Element that triggers the tooltip. Must accept event handlers + className. */
  children: ReactElement<any>;
  className?: string;
  /** Show with a short delay (ms). */
  delay?: number;
}

const PLACEMENT_CLS: Record<NonNullable<TooltipProps['placement']>, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
};

export function Tooltip({
  content, placement = 'top', children, className, delay = 80,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const show = () => { timer = setTimeout(() => setOpen(true), delay); };
  const hide = () => { if (timer) clearTimeout(timer); setOpen(false); };

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(children as ReactElement<Record<string, any>>, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <span data-component="Tooltip" className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-white shadow-md',
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

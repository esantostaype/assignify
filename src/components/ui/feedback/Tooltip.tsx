'use client';

import {
  cloneElement, isValidElement, useCallback, useRef, useState,
  type ReactElement, type ReactNode, type MouseEvent, type FocusEvent,
} from 'react';
import { createPortal } from 'react-dom';
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

interface Anchor {
  top: number;
  left: number;
  transform: string;
}

// Gap (px) between the trigger and the tooltip.
const GAP = 6;

function anchorFor(placement: NonNullable<TooltipProps['placement']>, r: DOMRect): Anchor {
  switch (placement) {
    case 'bottom':
      return { top: r.bottom + GAP, left: r.left + r.width / 2, transform: 'translate(-50%, 0)' };
    case 'left':
      return { top: r.top + r.height / 2, left: r.left - GAP, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { top: r.top + r.height / 2, left: r.right + GAP, transform: 'translate(0, -50%)' };
    case 'top':
    default:
      return { top: r.top - GAP, left: r.left + r.width / 2, transform: 'translate(-50%, -100%)' };
  }
}

/**
 * Tooltip rendered through a PORTAL with `position: fixed`. Two reasons it
 * doesn't live inline anymore:
 *   1. Inside a scrollable container (e.g. a Modal body with `overflow-auto`)
 *      an absolutely-positioned tooltip that overflows the edge forced a
 *      horizontal scrollbar. A fixed portal escapes the container entirely.
 *   2. z-index: inline it sat at z-50, below modals (200) / confirmations
 *      (300). The portal sits at 400 so it floats above every surface.
 *
 * Colours use literal hex (not `neutral-*` tokens) so the palette-inversion
 * applied in dark mode can't flip the dark chip to a light one and leave white
 * text on a light background.
 */
export function Tooltip({
  content, placement = 'top', children, className, delay = 80,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((e: MouseEvent | FocusEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const next = anchorFor(placement, rect);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAnchor(next);
      setOpen(true);
    }, delay);
  }, [placement, delay]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }, []);

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(children as ReactElement<Record<string, any>>, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <>
      {trigger}
      {open && anchor && typeof window !== 'undefined' && createPortal(
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none fixed z-[400] max-w-[260px] whitespace-normal break-words',
            'rounded-md px-2 py-1 text-[11px] font-medium shadow-md',
            'bg-[#1f2937] text-white',
            className,
          )}
          style={{ top: anchor.top, left: anchor.left, transform: anchor.transform }}
        >
          {content}
        </span>,
        document.body,
      )}
    </>
  );
}

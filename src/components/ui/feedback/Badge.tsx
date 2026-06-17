'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeColor = 'primary' | 'neutral' | 'success' | 'error' | 'warning';
export type BadgePlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface BadgeProps {
  /** Content (often a small number). If omitted, renders a dot. */
  content?: ReactNode;
  color?: BadgeColor;
  placement?: BadgePlacement;
  /** Hide the badge entirely. */
  invisible?: boolean;
  /** When `content` is a number greater than this, show `max+`. */
  max?: number;
  children: ReactNode;
  className?: string;
}

const COLOR: Record<BadgeColor, string> = {
  primary: 'bg-primary-600 text-white',
  neutral: 'bg-neutral-700 text-white',
  success: 'bg-success-600 text-white',
  error:   'bg-error-600   text-white',
  warning: 'bg-warning-500 text-white',
};

const POS: Record<BadgePlacement, string> = {
  'top-right':    'top-0 right-0 translate-x-1/2 -translate-y-1/2',
  'top-left':     'top-0 left-0  -translate-x-1/2 -translate-y-1/2',
  'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  'bottom-left':  'bottom-0 left-0  -translate-x-1/2 translate-y-1/2',
};

export function Badge({
  content, color = 'error', placement = 'top-right', invisible, max = 99,
  children, className,
}: BadgeProps) {
  const isDot = content === undefined || content === null;
  const display = typeof content === 'number' && content > max ? `${max}+` : content;

  return (
    <span data-component="Badge" data-color={color} data-placement={placement} className={cn('relative inline-flex', className)}>
      {children}
      {!invisible && (
        <span
          className={cn(
            'absolute z-10 flex items-center justify-center rounded-full ring-2 ring-white',
            COLOR[color],
            POS[placement],
            isDot ? 'h-2 w-2' : 'h-4 min-w-4 px-1 text-[10px] font-semibold',
          )}
        >
          {!isDot && display}
        </span>
      )}
    </span>
  );
}

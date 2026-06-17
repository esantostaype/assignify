'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiX } from '@/lib/icons';

export type ChipColor   = 'primary' | 'neutral' | 'success' | 'error' | 'warning';
export type ChipVariant = 'filled' | 'soft' | 'outlined';
export type ChipSize    = 'sm' | 'md' | 'lg';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  color?: ChipColor;
  variant?: ChipVariant;
  size?: ChipSize;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onRemove?: () => void;
}

/** Per-size geometry — `lg` is sized to match `Button sm` (32 px tall,
 *  `rounded` corner, comfortable 12 px padding + 6 px gap) so a chip
 *  used as a leading status pill next to an action button reads as
 *  the same height as that button. */
const SIZE: Record<ChipSize, string> = {
  sm: 'h-5 px-2   text-[10.5px] gap-1   rounded-sm',
  md: 'h-6 px-2.5 text-[11.5px] gap-1.5 rounded-sm',
  lg: 'h-8 px-3   text-[13px]   gap-1.5 rounded-md',
};

const PALETTE: Record<ChipColor, Record<ChipVariant, string>> = {
  primary: {
    filled:   'bg-primary-500 text-white',
    soft:     'bg-primary-100 text-primary-800',
    outlined: 'bg-primary-50 text-primary-700 border border-primary-200',
  },
  neutral: {
    filled:   'bg-neutral-500 text-white',
    soft:     'bg-neutral-100 text-neutral-800',
    outlined: 'bg-neutral-50 text-neutral-700 border border-neutral-200',
  },
  success: {
    filled:   'bg-success-500 text-white',
    soft:     'bg-success-100 text-success-800',
    outlined: 'bg-success-50 text-success-700 border border-success-200',
  },
  error: {
    filled:   'bg-error-500 text-white',
    soft:     'bg-error-100 text-error-800',
    outlined: 'bg-error-50 text-error-700 border border-error-200',
  },
  warning: {
    filled:   'bg-warning-500 text-white',
    soft:     'bg-warning-100 text-warning-800',
    outlined: 'bg-warning-50 text-warning-700 border border-warning-300',
  },
};

export function Chip({
  color = 'neutral', variant = 'soft', size = 'md',
  startIcon, endIcon, onRemove,
  className, children, ...rest
}: ChipProps) {
  return (
    <span
      data-component="Chip"
      data-color={color}
      data-variant={variant}
      data-size={size}
      className={cn(
        // `align-middle` (vertical-align: middle) keeps the chip
        // geometrically centred when it sits in a cell with
        // `vertical-align: middle` (every DataTable TD does this).
        // Without it the chip's baseline — which is the baseline of
        // its inner text, roughly 70 % down the chip — would be the
        // anchor instead of the chip's centre, pushing the whole pill
        // ~4-5 px above the row's true centre.  Most visible in the
        // status columns where chips share rows with plain text.
        'inline-flex items-center align-middle font-semibold whitespace-nowrap select-none',
        SIZE[size],
        PALETTE[color][variant],
        className,
      )}
      {...rest}
    >
      {startIcon}
      {children}
      {endIcon}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove"
          className="-mr-0.5 inline-flex items-center justify-center rounded-full opacity-70 hover:opacity-100"
        >
          <Icon icon={PiX} size={12} />
        </button>
      )}
    </span>
  );
}

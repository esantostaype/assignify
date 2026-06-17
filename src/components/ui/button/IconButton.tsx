'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { ButtonVariant, ButtonColor } from './Button';

export type IconButtonShape   = 'square' | 'circle';
/** Mirrors `Button`'s variant set 1:1 — `filled` / `soft` / `outlined` / `ghost`. */
export type IconButtonVariant = ButtonVariant;
/** Mirrors `Button`'s color set 1:1 — `primary` / `neutral` / `success` / `error` / `warning`. */
export type IconButtonColor   = ButtonColor;
/** Four-tier scale — `xs / sm / md / lg` (24 / 32 / 40 / 48 px).  Shared
 *  1:1 with `Button`'s height curve so an IconButton and a Button at the
 *  same `size` line up flush in the same row.  Pick `xs` for inline
 *  actions next to a `<Chip size="sm">` or other ultra-dense chrome. */
export type IconButtonSize    = 'xs' | 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  shape?:   IconButtonShape;
  variant?: IconButtonVariant;
  color?:   IconButtonColor;
  size?:    IconButtonSize;
  /** aria-label is required for screen-reader friendliness. */
  'aria-label': string;
  children: ReactNode;
}

// Size geometry — kept in lockstep with `<Button>` and `<Avatar>` so
// the trio shares one height curve across the app.  Every tier here
// has a matching `<Button>` size, so an IconButton and a Button at
// the same `size` line up flush in the same row:
//   • `xs` — 24 px  (matches Button xs — used inside dense chrome
//                    like row-action menus / overflow lists / inline
//                    actions next to a Chip sm or md)
//   • `sm` — 32 px  (matches Button sm)
//   • `md` — 40 px  (matches Button md)
//   • `lg` — 48 px  (matches Button lg)
//
// Border-radius lives in a SEPARATE map below so the className only
// ever contains ONE `rounded-*` utility — Tailwind v4 does not dedupe
// utilities in `cn()`, and stacking `rounded` / `rounded-md` /
// `rounded-lg` against `rounded-full` produced an unpredictable
// "whichever lands last in the compiled CSS wins" race that broke
// the `shape="circle"` override.
const SIZE: Record<IconButtonSize, string> = {
  xs: 'min-h-6  h-6  w-6',
  sm: 'min-h-8  h-8  w-8',
  md: 'min-h-10 h-10 w-10',
  lg: 'min-h-12 h-12 w-12',
};

// Square-mode radius — matched to the Button radius curve so an
// IconButton and a Button at the same `size` share corner geometry.
// `shape="circle"` short-circuits this map entirely and uses
// `rounded-full` instead (see `roundedCls` in the render).
const ROUNDED_SQUARE: Record<IconButtonSize, string> = {
  xs: 'rounded',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
};

// Inner SVG sizing — kept in lockstep with Button's `SIZE_ICON`
// curve so the same icon reads at the same scale whether it's
// inside a Button or an IconButton at matching sizes.
const SIZE_ICON: Record<IconButtonSize, string> = {
  xs: '[&_svg]:w-3      [&_svg]:h-3',     // 12 px
  sm: '[&_svg]:w-[14px] [&_svg]:h-[14px]',// 14 px — matches Button sm
  md: '[&_svg]:w-4      [&_svg]:h-4',     // 16 px — matches Button md
  lg: '[&_svg]:w-4.5    [&_svg]:h-4.5',   // 18 px — matches Button lg
};

// Color × variant palette — 1:1 mirror of `Button`'s `PALETTE` so an
// IconButton and a Button at the same `color` + `variant` paint with
// identical surface, text, hover, active, focus-ring and disabled
// tones.  When you change a tone in Button, change it here too.
//
// Tailwind v4 needs literal class names — the matrix is fully
// enumerated rather than built from template strings so the JIT
// scanner picks every combination up at build time.
const PALETTE: Record<IconButtonColor, Record<IconButtonVariant, string>> = {
  primary: {
    filled:   'border border-transparent bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus-visible:ring-primary-200',
    soft:     'border border-transparent bg-primary-100 text-primary-700 hover:text-primary-800 hover:bg-primary-200 active:bg-primary-200 focus-visible:ring-primary-200',
    outlined: 'bg-(--color-surface-card) text-primary-700 border border-primary-400 hover:bg-primary-50 hover:text-primary-800 hover:border-primary-600 active:bg-primary-100 focus-visible:ring-primary-200',
    ghost:    'bg-transparent text-primary-700 border border-transparent hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-200',
  },
  neutral: {
    filled:   'border border-transparent bg-neutral-500 text-white hover:bg-neutral-900 active:bg-neutral-950 focus-visible:ring-neutral-300',
    soft:     'border border-transparent bg-neutral-100 text-neutral-700 hover:text-neutral-800 hover:bg-neutral-200 active:bg-neutral-200 focus-visible:ring-neutral-300',
    outlined: 'bg-(--color-surface-card) text-neutral-700 border border-neutral-400 hover:bg-neutral-50 hover:border-neutral-500 active:bg-neutral-100 focus-visible:ring-neutral-300',
    ghost:    'bg-transparent text-neutral-700 border border-transparent hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-300',
  },
  success: {
    filled:   'border border-transparent bg-success-600 text-white hover:bg-success-700 active:bg-success-700 focus-visible:ring-success-200',
    soft:     'border border-transparent bg-success-100 text-success-700 hover:text-success-800 hover:bg-success-200 active:bg-success-200 focus-visible:ring-success-200',
    outlined: 'bg-(--color-surface-card) text-success-700 border border-success-400 hover:bg-success-50 hover:text-success-800 hover:border-success-600 active:bg-success-100 focus-visible:ring-success-200',
    ghost:    'bg-transparent text-success-700 border border-transparent hover:bg-success-50 active:bg-success-100 focus-visible:ring-success-200',
  },
  error: {
    filled:   'border border-transparent bg-error-600 text-white hover:bg-error-700 active:bg-error-700 focus-visible:ring-error-200',
    soft:     'border border-transparent bg-error-100 text-error-700 hover:text-error-800 hover:bg-error-200 active:bg-error-200 focus-visible:ring-error-200',
    outlined: 'bg-(--color-surface-card) text-error-700 border border-error-400 hover:bg-error-50 hover:text-error-800 hover:border-error-600 active:bg-error-100 focus-visible:ring-error-200',
    ghost:    'bg-transparent text-error-700 border border-transparent hover:bg-error-50 active:bg-error-100 focus-visible:ring-error-200',
  },
  warning: {
    filled:   'border border-transparent bg-warning-600 text-white hover:bg-warning-700 active:bg-warning-700 focus-visible:ring-warning-200',
    soft:     'border border-transparent bg-warning-100 text-warning-700 hover:text-warning-800 hover:bg-warning-200 active:bg-warning-200 focus-visible:ring-warning-200',
    outlined: 'bg-(--color-surface-card) text-warning-700 border border-warning-400 hover:bg-warning-50 hover:text-warning-800 hover:border-warning-600 active:bg-warning-100 focus-visible:ring-warning-200',
    ghost:    'bg-transparent text-warning-700 border border-transparent hover:bg-warning-50 active:bg-warning-100 focus-visible:ring-warning-200',
  },
};

/**
 * Square or circular icon-only button.  Variant × color × size matrix
 * is a 1:1 mirror of `<Button>` so an IconButton and a Button at the
 * same `color` + `variant` + matching `size` (`xs / sm / md / lg`)
 * read as siblings in a shared row — pair them in toolbars, drawer
 * headers, or page actions without breaking the baseline.  `xs` is
 * shared with Button now (was IconButton-exclusive); use it for
 * inline actions next to a Chip sm/md or other ultra-dense chrome
 * where the standard `sm` (32 px) would feel oversized.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    shape   = 'square',
    variant = 'outlined',
    color   = 'primary',
    size    = 'md',
    className,
    children,
    disabled,
    type    = 'button',
    ...rest
  },
  ref,
) {
  // Resolve the radius ONCE so only a single `rounded-*` utility
  // ends up in the className.  Stacking multiple `rounded-*`
  // utilities in `cn()` produced an unreliable cascade in Tailwind
  // v4 — `rounded` / `rounded-md` / `rounded-lg` and `rounded-full`
  // share the same specificity, and the className's textual order
  // does NOT decide which one wins (Tailwind compiles them into the
  // final CSS in its own order).  Picking one explicitly here side-
  // steps the race entirely.
  const roundedCls = shape === 'circle' ? 'rounded-full' : ROUNDED_SQUARE[size];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      data-component="IconButton"
      data-variant={variant}
      data-color={color}
      data-size={size}
      data-shape={shape}
      className={cn(
        'cursor-pointer inline-flex items-center justify-center transition-colors duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
        // Disabled — uniform opacity dim.  Same approach as <Button>: rely
        // on the native `disabled` attribute to block clicks/focus and
        // skip `pointer-events: none` so `cursor: not-allowed` still
        // surfaces on hover.
        'disabled:cursor-not-allowed disabled:opacity-50',
        SIZE[size],
        SIZE_ICON[size],
        PALETTE[color][variant],
        roundedCls,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

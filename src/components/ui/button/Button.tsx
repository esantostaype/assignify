'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/feedback/Spinner';

export type ButtonVariant = 'filled' | 'soft' | 'outlined' | 'ghost';
/** Size scale.  `xs` (24 px) is reserved for inline action affordances
 *  that sit alongside small Chips (e.g. a Retry button next to a
 *  `<Chip size="sm">` status pill) where the standard `sm` (32 px)
 *  would tower over the chip.  Matches the geometry of `IconButton`'s
 *  `xs` so the two sizes can coexist in the same row. */
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonColor   = 'primary' | 'neutral' | 'success' | 'error' | 'warning';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  color?:   ButtonColor;
  /** Render as - square icon-only button. */
  iconOnly?: boolean;
  /** Icon node placed before the label. */
  startIcon?: ReactNode;
  /** Icon node placed after the label. */
  endIcon?:   ReactNode;
  /** Loading state - disables the button and shows - spinner overlay. */
  loading?: boolean;
  fullWidth?: boolean;
}

// aa per-size geometry — height + gap + radius only. Horizontal padding lives
// in PADDING_X below so we can reduce it on the side that owns an icon.
//
// Sizes are FIXED across every breakpoint — no responsive shrinking.
// Every tier matches IconButton + Avatar at the same key so a Button,
// IconButton, and Avatar at the same `size` line up flush in a row:
//   • `xs` — 24 px tall.  Inline-action tier — sits alongside a
//                          `<Chip size="sm">` or `<Chip size="md">`
//                          status pill without towering over it.
//                          Pair with `IconButton size="xs"` for
//                          row-action menus / overflow lists.
//   • `sm` — 32 px tall.
//   • `md` — 40 px tall.
//   • `lg` — 48 px tall.
//
// The previous responsive curve (md dropping to 32 px on mobile, lg dropping
// to 40 px below xl) is gone — a Button MD now reads the same on a phone as
// on a desktop.  Pair this with the matching fixed Tabs sizes so a Button MD
// and a Tabs MD still line up at the SAME height when laid side by side.
const SIZE: Record<ButtonSize, string> = {
  xs: 'min-h-6  h-6  text-[11px] gap-1   rounded',
  sm: 'min-h-8  h-8  text-xs     gap-1.5 rounded',
  md: 'min-h-10 h-10 text-sm     gap-2   rounded-md',
  lg: 'min-h-12 h-12 text-sm     gap-2   rounded-lg',
};
const SIZE_ICON_ONLY: Record<ButtonSize, string> = {
  xs: 'min-h-6  h-6  w-6  rounded',
  sm: 'min-h-8  h-8  w-8  rounded',
  md: 'min-h-10 h-10 w-10 rounded-md',
  lg: 'min-h-12 h-12 w-12 rounded-lg',
};

// aa horizontal padding — symmetric (`both`) by default, reduced by one
// spacing step on the side that carries an icon. An icon visually occupies
// some of that side's padding, so the symmetric value reads as a bigger gap
// next to it; pulling the padding in one step balances the optical weight.
//
// Padding is fixed per size (matches the height — no responsive curve), so
// the label never lands off-centre when the viewport changes.
const PADDING_X: Record<ButtonSize, { both: string; start: string; end: string; bothIcons: string }> = {
  xs: {
    both:      'pl-2   pr-2',
    start:     'pl-1.5 pr-2',
    end:       'pl-2   pr-1.5',
    bothIcons: 'pl-1.5 pr-1.5',
  },
  sm: {
    both:      'pl-3 pr-3',
    start:     'pl-2 pr-3',
    end:       'pl-3 pr-2',
    bothIcons: 'pl-2 pr-2',
  },
  md: {
    both:      'pl-4 pr-4',
    start:     'pl-3 pr-4',
    end:       'pl-4 pr-3',
    bothIcons: 'pl-3 pr-3',
  },
  lg: {
    both:      'pl-5 pr-5',
    start:     'pl-4 pr-5',
    end:       'pl-5 pr-4',
    bothIcons: 'pl-4 pr-4',
  },
};
function paddingFor(size: ButtonSize, hasStart: boolean, hasEnd: boolean) {
  const p = PADDING_X[size];
  if (hasStart && hasEnd) return p.bothIcons;
  if (hasStart)           return p.start;
  if (hasEnd)             return p.end;
  return p.both;
}

// aa nested-icon sizing — forces consistent SVG dimensions per button size.
// Fixed across breakpoints (in lockstep with the fixed height curve above)
// so the icon always reads at the same scale regardless of viewport.
const SIZE_ICON: Record<ButtonSize, string> = {
  xs: '[&_svg]:w-3      [&_svg]:h-3',     // 12 px — matches IconButton xs
  sm: '[&_svg]:w-[14px] [&_svg]:h-[14px]',
  md: '[&_svg]:w-4      [&_svg]:h-4',
  lg: '[&_svg]:w-4.5    [&_svg]:h-4.5',
};

// aa static variant color palettes (Tailwind v4 needs literal class names)
//
// Disabled tones are NOT in the palette — every color × variant combo dims
// uniformly via the top-level `disabled:opacity-50` rule applied to the
// `<button>` itself.  Reasons:
//   1. ONE rule replaces 60 disabled declarations (5 colors × 4 variants ×
//      3 tokens) — palette stays focused on active states only.
//   2. The opacity multiplier works in every theme (base/light/dark)
//      automatically.  No per-theme disabled re-tuning.
//   3. UX wins — "this exists but is unavailable" reads clearer than
//      "this changed to a different color".
const PALETTE: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    filled:   'border border-transparent bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus-visible:ring-primary-200',
    soft:     'border border-transparent bg-primary-100 text-primary-700 hover:text-primary-800 hover:bg-primary-200 active:bg-primary-200 focus-visible:ring-primary-200',
    outlined: 'bg-(--color-surface-card) text-primary-700 border border-primary-400 hover:bg-primary-50 hover:border-primary-600 active:bg-primary-100 focus-visible:ring-primary-200',
    ghost:    'bg-transparent text-primary-700 border border-transparent hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-200',
  },
  neutral: {
    filled:   'border border-transparent bg-neutral-500 text-white hover:bg-neutral-900 active:bg-neutral-950 focus-visible:ring-neutral-300',
    soft:     'border border-transparent bg-neutral-100 text-neutral-700 hover:text-neutral-800 hover:bg-neutral-200 active:bg-neutral-200 focus-visible:ring-neutral-300',
    outlined: 'bg-(--color-surface-card) text-neutral-700 border border-neutral-400 hover:bg-neutral-50 hover:border-neutral-500 active:bg-neutral-100 focus-visible:ring-neutral-300',
    ghost:    'bg-transparent text-neutral-700 border border-transparent hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-300',
  },
  success: {
    filled:   'border border-transparent bg-success-500 text-white hover:bg-success-600 active:bg-success-700 focus-visible:ring-success-200',
    soft:     'border border-transparent bg-success-100 text-success-700 hover:text-success-800 hover:bg-success-200 active:bg-success-200 focus-visible:ring-success-200',
    outlined: 'bg-(--color-surface-card) text-success-700 border border-success-400 hover:bg-success-50 hover:border-success-500 active:bg-success-100 focus-visible:ring-success-200',
    ghost:    'bg-transparent text-success-700 border border-transparent hover:bg-success-50 active:bg-success-100 focus-visible:ring-success-200',
  },
  error: {
    filled:   'border border-transparent bg-error-500 text-white hover:bg-error-600 active:bg-error-700 focus-visible:ring-error-200',
    soft:     'border border-transparent bg-error-100 text-error-700 hover:text-error-800 hover:bg-error-200 active:bg-error-200 focus-visible:ring-error-200',
    outlined: 'bg-(--color-surface-card) text-error-700 border border-error-400 hover:bg-error-50 hover:border-error-500 active:bg-error-100 focus-visible:ring-error-200',
    ghost:    'bg-transparent text-error-700 border border-transparent hover:bg-error-50 active:bg-error-100 focus-visible:ring-error-200',
  },
  warning: {
    filled:   'border border-transparent bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 focus-visible:ring-warning-200',
    soft:     'border border-transparent bg-warning-100 text-warning-700 hover:text-warning-800 hover:bg-warning-200 active:bg-warning-200 focus-visible:ring-warning-200',
    outlined: 'bg-(--color-surface-card) text-warning-700 border border-warning-400 hover:bg-warning-50 hover:border-warning-500 active:bg-warning-100 focus-visible:ring-warning-200',
    ghost:    'bg-transparent text-warning-700 border border-transparent hover:bg-warning-50 active:bg-warning-100 focus-visible:ring-warning-200',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant   = 'filled',
    size      = 'md',
    color     = 'primary',
    iconOnly  = false,
    startIcon,
    endIcon,
    loading   = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type      = 'button',
    ...rest
  },
  ref,
) {
  const sizeCls = iconOnly ? SIZE_ICON_ONLY[size] : SIZE[size];
  // Icon-only buttons get their square SIZE_ICON_ONLY (which already centres
  // the icon); text-bearing buttons get asymmetric padding based on icon side.
  const paddingCls = iconOnly ? '' : paddingFor(size, !!startIcon, !!endIcon);
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      data-component="Button"
      data-variant={variant}
      data-size={size}
      data-color={color}
      className={cn(
        'cursor-pointer relative inline-flex items-center justify-center font-semibold leading-none',
        'select-none transition-colors duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
        // Disabled — single uniform dim.  Native `disabled` attribute on
        // <button> already blocks clicks + focus + form submit at the
        // browser level, so we DON'T set `pointer-events: none` (that
        // would suppress the `cursor: not-allowed` since the cursor
        // wouldn't hit the element at all).
        'disabled:cursor-not-allowed disabled:opacity-50',
        fullWidth && 'w-full',
        sizeCls,
        paddingCls,
        SIZE_ICON[size],
        PALETTE[color][variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          {/* Real <Spinner> (not an inline SVG) so it carries
              data-component="Spinner" and shows up in the dev inspector.
              `colorClassName=""` drops the default tint so the spinner
              inherits the button's text color via currentColor; the
              button's `[&_svg]` size rule drives its dimensions. */}
          <Spinner colorClassName="" />
        </span>
      )}
      <span className={cn('inline-flex items-center justify-center gap-[inherit]', loading && 'opacity-0')}>
        {startIcon}
        {children}
        {endIcon}
      </span>
    </button>
  );
});

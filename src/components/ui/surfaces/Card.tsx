'use client';

import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'outlined' | 'soft' | 'plain' | 'tinted';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRounded = 'md' | 'lg' | 'xl' | '2xl';
/** Polymorphic root tag.  Defaults to `div`; domain wrappers can pass
 *  `as="article"` (search-result cards), `as="section"` (page panels),
 *  etc. to keep the semantics right while inheriting the visual
 *  treatment from Card. */
export type CardElement = 'div' | 'article' | 'section' | 'aside' | 'header' | 'footer' | 'nav';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: CardVariant;
  /** Padding applied to the BODY slot (and to the whole card when no
   *  header/footer slots are used so simple cards still get spacing).
   *  Header + footer have their own internal padding regardless. */
  padding?: CardPadding;
  rounded?: CardRounded;
  /** Optional header slot — pinned to the top, separated from the body
   *  by a 1 px bottom border.  Pass any ReactNode (a Typography title,
   *  a flex row with title + actions, etc.). */
  header?: ReactNode;
  /** Optional footer slot — pinned to the bottom, separated from the
   *  body by a 1 px top border, sitting on a muted surface so it reads
   *  as the "actions" area regardless of contents. */
  footer?: ReactNode;
  /** Body slot.  When the card has no header/footer this is rendered
   *  with the chosen `padding`; with slots the body always sits in the
   *  middle with consistent vertical padding so the borders frame it. */
  children?: ReactNode;
  /** Override the root tag.  Defaults to `div`. */
  as?: CardElement;
  /** Override the `data-component` attribute on the root element.
   *  Domain wrappers (`ResultCard`, `LocationCard`, …) pass their own
   *  name so the Dev Mode inspector reads them as named components
   *  instead of the generic `Card` primitive. */
  dataComponentName?: string;
}

const VARIANT: Record<CardVariant, string> = {
  outlined: 'bg-(--color-surface-card) border border-(--color-border-default)',
  soft:     'bg-(--color-surface-muted) border border-(--color-border-default)',
  plain:    'bg-(--color-surface-card)',
  // No border + flat neutral-100 fill — useful when the card sits
  // INSIDE another card or panel and a border would look like double
  // chrome.  The tint distinguishes it from the surrounding surface
  // without competing for attention.
  tinted:   'bg-neutral-100',
};

const BODY_PADDING: Record<CardPadding, string> = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
};

// Header / footer paddings are tied to the body padding so the three
// slots feel rhythmically consistent.  They use a tighter vertical
// padding (px stays the same) so the borders sit close to the divider
// rather than floating in a tall band of empty space.
const SLOT_PADDING: Record<CardPadding, string> = {
  none: 'px-0 py-0',
  sm:   'px-3 py-2',
  md:   'px-5 py-3',
  lg:   'px-6 py-4',
};

const ROUND: Record<CardRounded, string> = {
  md:   'rounded-md',
  lg:   'rounded-lg',
  xl:   'rounded-xl',
  '2xl':'rounded-2xl',
};

/**
 * Generic surface container.  No domain knowledge — pass any content
 * into `header`, `children`, or `footer` and the card just supplies
 * the affordance:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ header                                     │  ← border-b when used
 *   ├────────────────────────────────────────────┤
 *   │ body (children)                            │
 *   ├────────────────────────────────────────────┤
 *   │ footer                                     │  ← border-t + muted bg
 *   └────────────────────────────────────────────┘
 *
 * Slots are optional and independent — omit either to drop that strip
 * entirely.  When neither slot is present, the card collapses to a
 * single padded box (legacy `<Card>{children}</Card>` usages still
 * render identically).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = 'outlined',
    padding = 'md',
    // Cards across the app land on 12 px rounded corners — `xl` in the
    // shared scale.  The old 16 px (`2xl`) default felt too soft against
    // the rest of the chrome (inputs / chips / modal radii sit at 8–12 px).
    rounded = 'xl',
    header,
    footer,
    as = 'div',
    dataComponentName = 'Card',
    className,
    children,
    ...rest
  },
  ref,
) {
  const hasHeader = header !== undefined && header !== null && header !== false;
  const hasFooter = footer !== undefined && footer !== null && footer !== false;
  const hasSlots  = hasHeader || hasFooter;

  return createElement(
    as,
    {
      ref,
      'data-component': dataComponentName,
      'data-variant': variant,
      'data-padding': padding,
      'data-rounded': rounded,
      'data-has-header': hasHeader ? 'true' : 'false',
      'data-has-footer': hasFooter ? 'true' : 'false',
      className: cn(
        // Slots variant uses `overflow-hidden` so the header/footer
        // background fills don't bleed past the rounded corners.
        VARIANT[variant], ROUND[rounded],
        // `flex flex-col` is a no-op when the card's height is its
        // natural content height — the three slots still stack
        // vertically.  But the moment a parent grid (or an explicit
        // `h-full` on the card) forces the card taller than its
        // content, the flex column + the `flex-1` on the body slot
        // (below) push the footer down to the bottom edge so two
        // cards sitting side by side keep their footers aligned.
        hasSlots && 'overflow-hidden flex flex-col',
        // Legacy single-block cards keep their padding on the wrapper
        // so `<Card>{x}</Card>` still produces the same box as before.
        !hasSlots && BODY_PADDING[padding],
        className,
      ),
      ...rest,
    },
    <>
      {hasHeader && (
        <div
          data-card-slot="header"
          className={cn(
            'border-b border-(--color-border-default)',
            SLOT_PADDING[padding],
          )}
        >
          {header}
        </div>
      )}

      {hasSlots ? (
        // `flex-1` lets the body grow to fill any extra vertical
        // space the parent grid hands the card, so the footer below
        // stays pinned to the bottom edge instead of riding up next
        // to a short body.
        <div data-card-slot="body" className={cn('flex-1', BODY_PADDING[padding])}>
          {children}
        </div>
      ) : (
        children
      )}

      {hasFooter && (
        <div
          data-card-slot="footer"
          className={cn(
            'border-t border-(--color-border-default) bg-(--color-surface-muted)',
            SLOT_PADDING[padding],
          )}
        >
          {footer}
        </div>
      )}
    </>,
  );
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

/** Pre-baked header layout (title + subtitle on the left, action slot
 *  on the right).  Convenient default — pass any custom ReactNode to
 *  Card's `header` prop directly when this shape doesn't fit. */
export function CardHeader({ title, subtitle, action, className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)} {...rest}>
      <div className="min-w-0">
        {title && <div className="text-[15px] font-bold text-(--color-text-default) leading-tight">{title}</div>}
        {subtitle && <div className="text-[12.5px] text-(--color-text-muted) mt-1">{subtitle}</div>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

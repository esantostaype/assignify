'use client';

import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Consolidated typography scale — 15 variants covering every text
 * style the intranet uses.  The previous 26-variant set merged into
 * this list to drop visual duplicates (h3Sm + cardTitleBold = h6;
 * captionSm + caption = caption; helper + cardSub + bodySm = bodySm;
 * etc.) without losing expressive range.  Reach for the variant
 * that matches the SIZE you need, then override `color` via the
 * prop if the default tone doesn't fit the surface.
 *
 * Heading scale (h1–h6) tracks HTML semantics — h1 biggest, h6
 * smallest, all bold by default.  `cardTitle` is the lone semibold
 * variant in the heading-size range (16 px) for the soft "Card
 * title" look used by quick-action tiles.  `label` is the form-
 * field label flavour (14 px semibold).
 */
export type TypographyVariant =
  // ── Headings — numbered scale, all bold, sizes downshift one step
  // on mobile (<768 px) so chrome stays compact on narrow viewports ──
  | 'h1'         // 32→36px bold leading-none  — page hero
  | 'h2'         // 24→30px bold leading-none  — secondary hero / large stat
  | 'h3'         // 20→24px bold leading-none  — small stat / sub-hero
  | 'h4'         // 18→20px bold leading-tight — section heading
  | 'h5'         // 16→18px bold leading-tight — card heading
  | 'h6'         // 16px    bold leading-snug  — compact card / tool card name (no mobile downshift)

  // ── Body & captions ────────────────────────────────────────────
  | 'body'       // 14px regular muted leading-relaxed — paragraph copy
  | 'bodySm'     // 12px regular muted — secondary body / helper / card description
  | 'caption'    // 11px regular subtle — caption / smallest meta

  // ── Eyebrows (small uppercase labels) ──────────────────────────
  | 'eyebrow'    // 12px bold uppercase tracking-0.08 — section eyebrow / stat label
  | 'eyebrowSm'  // 10px bold uppercase tracking-0.14 — page meta / tag / group header

  // ── Cards & form ───────────────────────────────────────────────
  | 'cardTitle'  // 16px semibold — soft card heading (quick action labels)
  | 'label'      // 14px semibold default — form field label

  // ── Code / inherit ─────────────────────────────────────────────
  | 'code'       // 12px JetBrains Mono — inline code
  | 'inherit';   // No styling — inherits everything from the parent

export interface TypographyProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  variant?: TypographyVariant;
  /** Override the semantic HTML tag. Defaults are mapped per variant. */
  as?: keyof React.JSX.IntrinsicElements;
  /** Only meaningful when `as="label"` (or when the chosen variant
   *  defaults to `label`, like the `label` variant).  Wires the
   *  label to a form control via its id, producing the standard
   *  `for` attribute in the DOM. */
  htmlFor?: string;
  /**
   * Override the text color. Accepts:
   *   - A design token like `"primary-700"`  → `var(--color-primary-700)`
   *   - A CSS keyword like `"white"`
   *   - A raw CSS color value (`"#fff"`, `"rgb(...)"`, `"var(...)"`)
   *
   * Passed via inline `style.color` so it always beats the variant's
   * Tailwind text-* class.
   */
  color?: string;
  /** Add ellipsis truncation. */
  truncate?: boolean;
  /** Append the red required `*` after the text — same marker the
   *  `FormField` uses, so a label rendered directly (without FormField)
   *  shows the required asterisk automatically instead of hand-writing
   *  `<span className="text-error-500">*</span>`.  Intended for the
   *  `label` variant but works on any. */
  required?: boolean;
  children?: ReactNode;
}

const VARIANT_CLS: Record<TypographyVariant, string> = {
  // Headings — sizes downshift by one step on mobile so the chrome
  // doesn't dominate narrow viewports.  The shift only applies below
  // the `md:` breakpoint (768 px), so tablets and laptops keep the
  // canonical scale.  `h6` stays at 16 px on every size (it's already
  // at the body-text floor; smaller would clash with the regular
  // 14 px body copy).  Custom arbitrary value `text-[2rem]` for h1
  // mobile because Tailwind doesn't have a 32 px utility between
  // `text-3xl` (30) and `text-4xl` (36).
  h1:            'text-[2rem] md:text-4xl font-bold leading-none  text-(--color-text-default)',
  h2:            'text-2xl    md:text-3xl font-bold leading-none  text-(--color-text-default)',
  h3:            'text-xl     md:text-2xl font-bold leading-none  text-(--color-text-default)',
  h4:            'text-lg     md:text-xl  font-bold leading-tight text-(--color-text-default)',
  h5:            'text-base   md:text-lg  font-bold leading-tight text-(--color-text-default)',
  h6:            'text-base               font-bold leading-snug  text-(--color-text-default)',
  // body & captions
  body:          'text-sm text-(--color-text-muted) leading-relaxed',
  bodySm:        'text-xs text-(--color-text-muted)',
  caption:       'text-[11px] text-(--color-text-subtle)',
  // eyebrows
  eyebrow:       'text-xs font-bold uppercase tracking-[0.08em] text-(--color-text-default)',
  eyebrowSm:     'text-[10px] font-bold uppercase tracking-[0.14em] text-(--color-text-subtle)',
  // cards & form
  cardTitle:     'text-base font-semibold text-(--color-text-default) leading-snug',
  label:         'text-sm font-semibold text-(--color-text-default)',
  // code
  code:          'font-mono text-xs text-(--color-text-default)',
  inherit:       '',
};

const DEFAULT_TAG: Record<TypographyVariant, keyof React.JSX.IntrinsicElements> = {
  h1:            'h1',
  h2:            'h2',
  h3:            'h3',
  h4:            'h4',
  h5:            'h5',
  h6:            'h6',
  body:          'p',
  bodySm:        'p',
  caption:       'span',
  eyebrow:       'div',
  eyebrowSm:     'div',
  cardTitle:     'div',
  label:         'label',
  code:          'code',
  inherit:       'span',
};

/** Resolve a color prop to a CSS value (token → CSS var, raw → as-is). */
function resolveColor(c?: string): string | undefined {
  if (!c) return undefined;
  if (c.startsWith('var(') || c.startsWith('#') || c.startsWith('rgb') || c.startsWith('hsl')) return c;
  // Token style "primary-700" / "neutral-50" / "white" / "currentColor"
  if (/^[a-zA-Z]+(-\d+)?$/.test(c)) return `var(--color-${c}, ${c})`;
  return c;
}

export const Typography = forwardRef<HTMLElement, TypographyProps>(function Typography(
  { variant = 'body', as, color, truncate, required, className, style, children, ...rest },
  ref,
) {
  const Tag = as ?? DEFAULT_TAG[variant];
  const colorStyle = resolveColor(color);
  return createElement(
    Tag,
    {
      ref,
      'data-component': 'Typography',
      'data-variant': variant,
      className: cn(VARIANT_CLS[variant], truncate && 'truncate', className),
      style: colorStyle ? { color: colorStyle, ...(style ?? {}) } : style,
      ...rest,
    },
    required
      ? <>{children}<span className="ml-0.5 text-error-500">*</span></>
      : children,
  );
});

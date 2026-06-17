'use client';

import {
  createContext, useContext, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

/**
 *  Intranet label/value chip — tinted label cell + value cell.
 *
 *  Why this lives in `components/custom`
 *  ─────────────────────────────────────
 *  This is an intranet-specific composition, not a generic UI
 *  primitive.  It encodes the exact visual shape the producer-facing
 *  pages reach for when they need to surface a label/value pair
 *  (Detail Summary period meta, Quotes Premium / Premium Cost,
 *  DataTable expanded rows).  It also owns a context
 *  (`KeyValueChipContext`) that lets nested controls auto-adapt to
 *  the chip — see the Switch note below — which is the kind of
 *  cross-component coupling that belongs in `custom/`, not in the
 *  generic `ui/` buckets.
 *
 *  Sizes:
 *    • `sm` → `min-h-8`  (32 px) — the default inside the DataTable
 *            expanded panel and any tight context.
 *    • `md` → `min-h-10` (40 px) — same height band as `Button md`,
 *            so a chip sitting next to a button stays anchored on
 *            the same baseline.
 *
 *  Tones (orthogonal to size, but the emphasis size FOLLOWS the chip
 *  size so the value never out-grows its container):
 *    • default  → value uses `typography body` (14 px, default text
 *                colour) regardless of size.
 *    • emphasis (`md`) → value uses `typography h6` (16 px bold)
 *                recoloured to the active color's deepest shade — the
 *                standalone "hero number" treatment for Premium /
 *                Premium Cost where the value is what the user
 *                actually came for.
 *    • emphasis (`sm`) → value stays at 14 px but goes bold +
 *                color-deepest.  Used inside compact contexts (Quotes
 *                location cards, DataTable expanded panel) where a
 *                16 px hero number would visually overpower the
 *                surrounding row.
 *
 *  Colors (`neutral | primary | success | error | warning`):
 *  Mirrors `<Chip>` outlined ramp 1:1 so a row of chips and a row of
 *  key-value chips can share a palette.  `neutral` (default) preserves
 *  the historical intranet treatment — `surface-muted` label tile with
 *  `primary-950` label text and neutral borders.  The other four take
 *  the soft-outlined ramp: label cell `{color}-50` tinted, label text
 *  `{color}-800`, value text `{color}-700`, borders `{color}-200`.
 *  The value cell's background stays card-white in every color so the
 *  value reads as content against a tinted leading tile, not a fully
 *  filled pill.
 *
 *  Interactive (`interactive`):
 *  Set when the value slot holds a Button / Select / Input — anything
 *  that brings its own border + corner radius.  We:
 *
 *    1. Drop the value cell's own padding + border, so the embedded
 *       control's outline takes over instead of compounding.
 *    2. Strip the control's LEFT corner radius via
 *       `[&>*]:rounded-l-none` so its left edge fuses flush with the
 *       label cell.
 *    3. Keep the control's 1 px LEFT border — paired with the label
 *       cell's `border-r-0`, that single 1 px line is the visible
 *       divider between label and value.
 *
 *  Switches are NOT interactive — they render inside a normal value
 *  cell (padding + border + body typography), as if they were a
 *  static value.  The pill shape closes the chip on its own.
 *
 *  Switches DO auto-shrink to `size="sm"` via `KeyValueChipContext` —
 *  see Switch.tsx.  Outside the chip the Switch keeps its `md`
 *  default.
 */

export type KeyValueChipSize   = 'sm' | 'md';
export type KeyValueChipColor  = 'neutral' | 'primary' | 'success' | 'error' | 'warning';
/** Orientation of the label vs the value.
 *   • `inline` (default) — tinted label tile + value cell side-by-side
 *     (the historical chip used in DataTable rows + recap strips).
 *   • `block` — label STACKED above the value inside a single bordered
 *     card.  Reads as a compact "field"; used by detail / View drawers
 *     where many pairs sit in a 2-column grid.  Honors the same
 *     `size` / `color` / `emphasis` knobs as inline. */
export type KeyValueChipLayout = 'inline' | 'block';

interface KeyValueChipContextValue {
  insideChip: true;
  size: KeyValueChipSize;
}

export const KeyValueChipContext = createContext<KeyValueChipContextValue | null>(null);

export function useKeyValueChipContext(): KeyValueChipContextValue | null {
  return useContext(KeyValueChipContext);
}

/** Surface-level defaults that override the chip's hard-coded fallback.
 *  `DataTable` provides this so every chip rendered inside a table — both
 *  the ones DataTable paints itself (expanded panel, responsive totals
 *  row) and any chip the consumer hands back from `expandedContent` —
 *  defaults to `size="sm"` without each call site having to pass it.
 *  Explicit `size` on a chip still wins. */
interface KeyValueChipDefaultsContextValue {
  defaultSize?: KeyValueChipSize;
  /** Surface-level default for `responsiveBlock` — DataTable turns it on so
   *  every chip inside a table stacks label-over-value on mobile. */
  defaultResponsiveBlock?: boolean;
}

export const KeyValueChipDefaultsContext = createContext<KeyValueChipDefaultsContextValue>({});

export interface KeyValueChipProps {
  label: ReactNode;
  value: ReactNode;
  size?: KeyValueChipSize;
  color?: KeyValueChipColor;
  emphasis?: boolean;
  /** Stack the label above the value in one bordered card instead of the
   *  default side-by-side tile.  See `KeyValueChipLayout`. */
  layout?: KeyValueChipLayout;
  interactive?: boolean;
  /** Stretch the chip to fill its parent's width and let the value cell
   *  grow to fill (instead of the default inline-flex/shrink-to-content).
   *  Used by full-row recap chips (e.g. the Program chip at the top of
   *  the Quotes Client Information panel).  The value text switches
   *  from `whitespace-nowrap` to truncation with ellipsis so a long
   *  value still renders cleanly instead of breaking the chip out of
   *  its container. */
  fullWidth?: boolean;
  /** Let BOTH cells wrap instead of truncating (inline layout only).
   *  The label drops its single-line ellipsis (so a stacked two-line
   *  label like "Note #1 / date created" renders whole) and the value
   *  wraps with word breaks, top-aligned with vertical padding.  Use
   *  for long free-text values (notes, comments); pair with
   *  `fullWidth` so the chip spans the row. */
  multiline?: boolean;
  /** Opt this chip OUT of a surrounding `KeyValueChipGroup`'s uniform
   *  label width — neither measured nor pinned, the label keeps its
   *  natural size.  For the odd extra-long label (e.g. a question-style
   *  field) that would otherwise stretch every sibling label. */
  groupExempt?: boolean;
  /** Below the `md` breakpoint, an inline chip STACKS its label over its
   *  value — the `block` layout look — so narrow viewports don't squeeze
   *  the side-by-side cells (the value wraps instead of truncating).
   *  Chips rendered inside a `DataTable` default to `true` via context;
   *  pass `false` to opt out, `true` to opt in anywhere.  No effect on
   *  `layout="block"` chips (already stacked) or interactive chips. */
  responsiveBlock?: boolean;
  className?: string;
}

const SIZE: Record<KeyValueChipSize, string> = {
  sm: 'min-h-8',
  md: 'min-h-10',
};

/** Block layout geometry — per-cell padding + label / value type ramps.
 *  The label tile and value cell carry their OWN padding (not the outer
 *  wrapper) so the 1 px divider between them spans edge-to-edge, mirroring
 *  the inline chip's label↔value divider rotated 90°. */
const BLOCK_SIZE: Record<KeyValueChipSize, { labelPad: string; valuePad: string; label: string; value: string }> = {
  sm: { labelPad: 'px-3   py-1.5', valuePad: 'px-3   py-1.5', label: 'text-[10px]',   value: 'text-[13px] leading-relaxed' },
  md: { labelPad: 'px-3.5 py-2',   valuePad: 'px-3.5 py-2',   label: 'text-[10.5px]', value: 'text-sm leading-relaxed' },
};

interface ColorPalette {
  labelBg:           string;
  labelText:         string;
  labelBorder:       string;
  valueBorder:       string;
  /** Non-emphasis value text — sits on a white surface, body weight. */
  valueText:         string;
  /** Emphasis value text — bold + deepest color shade.  Paired with the
   *  font-size flip handled inline in the render (sm = 14 px, md = 16 px). */
  valueTextEmphasis: string;
}

// Color palette — 1:1 mirror of `<Chip>` outlined.  `neutral` keeps the
// historical intranet treatment (muted surface + primary-tinted label
// text) so existing consumers don't shift visually.  The other four
// follow the soft-outlined ramp from Chip: `bg-{c}-50 text-{c}-700
// border-{c}-200`, with label text bumped to `-800` (labels are bold +
// uppercase so they take the deeper shade well) and emphasis values
// bumped to `-900` / `950` (the "hero number" tier).
//
// Tailwind v4 needs literal class names — fully enumerated so the JIT
// scanner picks every combination up at build time.
const PALETTE: Record<KeyValueChipColor, ColorPalette> = {
  neutral: {
    labelBg:           'bg-(--color-surface-muted)',
    labelText:         'text-primary-950',
    labelBorder:       'border-neutral-300',
    valueBorder:       'border-neutral-300',
    valueText:         'text-(--color-text-default)',
    valueTextEmphasis: 'text-primary-950',
  },
  primary: {
    labelBg:           'bg-primary-50',
    labelText:         'text-primary-800',
    labelBorder:       'border-primary-200',
    valueBorder:       'border-primary-200',
    valueText:         'text-primary-700',
    valueTextEmphasis: 'text-primary-950',
  },
  success: {
    labelBg:           'bg-success-50',
    labelText:         'text-success-800',
    labelBorder:       'border-success-200',
    valueBorder:       'border-success-200',
    valueText:         'text-success-700',
    valueTextEmphasis: 'text-success-900',
  },
  error: {
    labelBg:           'bg-error-50',
    labelText:         'text-error-800',
    labelBorder:       'border-error-200',
    valueBorder:       'border-error-200',
    valueText:         'text-error-700',
    valueTextEmphasis: 'text-error-900',
  },
  warning: {
    labelBg:           'bg-warning-50',
    labelText:         'text-warning-800',
    labelBorder:       'border-warning-300',
    valueBorder:       'border-warning-300',
    valueText:         'text-warning-700',
    valueTextEmphasis: 'text-warning-900',
  },
};

export function KeyValueChip({
  label,
  value,
  size: sizeProp,
  color = 'neutral',
  emphasis = false,
  layout = 'inline',
  interactive = false,
  fullWidth = false,
  multiline = false,
  groupExempt = false,
  responsiveBlock: responsiveBlockProp,
  className,
}: KeyValueChipProps) {
  const defaults = useContext(KeyValueChipDefaultsContext);
  const size: KeyValueChipSize = sizeProp ?? defaults.defaultSize ?? 'md';
  const responsiveBlock = responsiveBlockProp ?? defaults.defaultResponsiveBlock ?? false;
  const palette = PALETTE[color];

  // ── Block layout — label stacked over the value in one bordered card.
  // The leading label tile + the interactive fuse-flush behaviour are
  // inline-only concepts, so block has its own compact column render.
  if (layout === 'block') {
    const bsz = BLOCK_SIZE[size];
    return (
      <div
        data-component="KeyValueChip"
        data-size={size}
        data-color={color}
        data-tone={emphasis ? 'emphasis' : 'default'}
        data-layout="block"
        data-full-width={fullWidth ? 'true' : undefined}
        className={cn(
          fullWidth ? 'flex w-full' : 'inline-flex',
          // `overflow-hidden` clips the tinted label tile to the rounded
          // top corners so it reads as a single bordered card.  Same
          // `rounded` (4 px) as the inline chip.
          'flex-col overflow-hidden rounded border',
          palette.labelBorder,
          className,
        )}
      >
        {/* Label tile — tinted like the inline label cell. */}
        <span className={cn(
          'font-bold uppercase tracking-[0.04em] leading-[1.2]',
          bsz.labelPad, bsz.label,
          palette.labelBg, palette.labelText,
        )}>
          {label}
        </span>
        {/* Value — card surface with the divider on TOP (the inline
            label↔value border, rotated to sit between the stacked cells).
            `whitespace-pre-line` keeps paragraph breaks in long values
            (multi-paragraph bio); `break-words` stops a long token from
            overflowing the card. */}
        <span
          className={cn(
            'border-t bg-(--color-surface-card) min-w-0 break-words whitespace-pre-line',
            palette.valueBorder,
            bsz.valuePad,
            emphasis
              ? cn('font-bold leading-snug', palette.valueTextEmphasis, size === 'md' ? 'text-base' : 'text-sm')
              : cn(bsz.value, palette.valueText),
          )}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <span
      data-component="KeyValueChip"
      data-size={size}
      data-color={color}
      data-tone={emphasis ? 'emphasis' : 'default'}
      data-interactive={interactive ? 'true' : undefined}
      data-full-width={fullWidth ? 'true' : undefined}
      data-multiline={multiline ? 'true' : undefined}
      className={cn(
        // `inline-flex` is the default — chip sizes to its content so it
        // sits inside a `flex-wrap` row of sibling chips at its natural
        // width.  `fullWidth` switches to `flex w-full` so the chip
        // stretches across the row and the value cell can grow (see
        // value-side classes below).
        fullWidth ? 'flex w-full' : 'inline-flex',
        'items-stretch overflow-hidden rounded',
        SIZE[size],
        // Mobile-stacked (`responsiveBlock`): below md the chip becomes a
        // full-width column — label tile over value — reproducing the
        // `block` layout exactly.  Non-interactive chips draw the card
        // outline on this OUTER span (inner cells go borderless, divided
        // by the value's top border); interactive chips keep the control's
        // own border, so the outer stays border-less.
        responsiveBlock && 'max-md:flex max-md:w-full max-md:flex-col',
        responsiveBlock && !interactive && cn('max-md:border', palette.labelBorder),
        className,
      )}
    >
      <span
        // `groupExempt` chips skip the group's data hooks entirely — the
        // label is neither measured nor pinned to the shared width.
        data-kv-label-cell={groupExempt ? undefined : 'true'}
        className={cn(
          'flex min-w-0 px-3',
          // Multiline label tops-align next to a tall wrapping value and
          // gets vertical padding so its lines breathe.
          multiline ? 'items-start py-2' : 'items-center',
          'border border-r-0 rounded-l',
          // Stacked on mobile: label tile spans the full width (overriding
          // any KeyValueChipGroup pin) and sits in a py-1.5 band.
          responsiveBlock && 'max-md:w-full! max-md:py-1.5',
          // Non-interactive: drop the label's own border + rounding — the
          // OUTER span draws the card, the value's top border is the divider.
          responsiveBlock && !interactive && 'max-md:border-0 max-md:rounded-none',
          // Interactive: the label keeps its border but rounds the TOP
          // corners (card top) and drops its bottom edge so the control
          // below fuses under it.
          responsiveBlock && interactive && 'max-md:border-r max-md:border-b-0 max-md:rounded-t max-md:rounded-bl-none',
          palette.labelBg,
          palette.labelBorder,
          palette.labelText,
          'text-[11px] font-bold uppercase tracking-[0.04em] leading-[1.2]',
        )}
      >
        <span
          data-kv-label={groupExempt ? undefined : 'true'}
          className={cn(multiline ? 'whitespace-normal' : 'truncate', responsiveBlock && 'max-md:whitespace-normal')}
        >{label}</span>
      </span>
      <span
        className={cn(
          // Default: `shrink-0` so the value cell keeps its natural
          // width inside the parent flex-wrap row.  `fullWidth` flips
          // to `flex-1 min-w-0` so the cell stretches to fill the
          // remaining row width and truncates instead of overflowing.
          fullWidth ? 'flex flex-1 min-w-0' : 'flex shrink-0 min-w-0',
          !interactive && [
            'justify-start px-3 border rounded-r bg-(--color-surface-card)',
            multiline ? 'items-start py-2' : 'items-center',
            palette.valueBorder,
            // Without fullWidth the value stays single-line nowrap; with
            // fullWidth the value gets ellipsis truncation so a long
            // value doesn't break the row layout.  `multiline` opts out
            // of both — the value wraps with word breaks instead.
            multiline
              ? 'whitespace-normal break-words'
              : (fullWidth ? '[&>*]:truncate' : 'whitespace-nowrap'),
            // Stacked on mobile: keep ONLY the top border (the divider),
            // drop the rounded-r + side/bottom borders (outer draws them),
            // and let the value wrap instead of truncating.
            responsiveBlock && 'max-md:border-x-0 max-md:border-b-0 max-md:rounded-none max-md:py-1.5 max-md:whitespace-normal max-md:break-words max-md:[&>*]:whitespace-normal',
            emphasis
              // sm + emphasis stays at 14 px (text-sm) so the value
              // doesn't out-grow the 32 px chip; md keeps the h6 16 px
              // hero treatment.
              ? cn(
                  'font-bold leading-snug',
                  palette.valueTextEmphasis,
                  size === 'md' ? 'text-base' : 'text-sm',
                )
              : cn('text-sm leading-relaxed', palette.valueText),
          ],
          // Strip the LEFT corner radius of the embedded control so it
          // fuses flush with the label cell.  Most controls (Button,
          // Input) carry their border + radius on the outer wrapper,
          // so `[&>*]` reaches them.  Select / MultiSelect put the
          // border on an inner trigger `<button>` — the extra
          // `[&>*>button:first-child]` selector descends one level to
          // catch those without dragging in portaled dropdown items
          // (which live outside the chip via React Portal).
          interactive && 'items-stretch',
          interactive && (responsiveBlock
            // Stacked on mobile the control sits flush BELOW the label (no
            // padding gap), squares its TOP corners so it fuses under the
            // label, and stretches FULL width (both the control root and its
            // inner trigger button).  On desktop it keeps the side-by-side
            // LEFT fuse.
            ? cn(
                'md:*:rounded-l-none md:[&>*>button:first-child]:rounded-l-none',
                'max-md:*:rounded-t-none max-md:[&>*>button:first-child]:rounded-t-none',
                'max-md:[&>*]:w-full max-md:[&>*>button:first-child]:w-full',
              )
            : '*:rounded-l-none [&>*>button:first-child]:rounded-l-none'),
        )}
      >
        <KeyValueChipContext.Provider value={{ insideChip: true, size }}>
          {value}
        </KeyValueChipContext.Provider>
      </span>
    </span>
  );
}

/** Row of `KeyValueChip`s with consistent spacing — saves the same
 *  `flex flex-wrap gap-2` wrapper at every call site.  `size` / `color`
 *  cascade to every chip in the row; individual items can still
 *  override either via their own `color` / `emphasis` / `interactive`
 *  fields. */
export function KeyValueChipRow({
  items,
  size,
  color,
  className,
}: {
  items: {
    label: ReactNode;
    value: ReactNode;
    color?: KeyValueChipColor;
    emphasis?: boolean;
    interactive?: boolean;
  }[];
  size?: KeyValueChipSize;
  color?: KeyValueChipColor;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((i, idx) => (
        <KeyValueChip
          key={idx}
          label={i.label}
          value={i.value}
          size={size}
          color={i.color ?? color}
          emphasis={i.emphasis}
          interactive={i.interactive}
        />
      ))}
    </div>
  );
}

/**
 * Equal-width labels across every `KeyValueChip` inside — measures the
 * widest label text in the subtree and pins all label tiles to that
 * width via a CSS variable, so a column of chips reads like an aligned
 * form ("Lookup Code" / "Lead Creation Date" / "Note #1" all share one
 * label edge).
 *
 * Wrap ANY markup — the chips can sit in nested grids, stacks, or be
 * added later (a new note chip re-triggers the measurement through the
 * MutationObserver).  Width = widest label text + the label tile's own
 * padding/border, so the fit is exact rather than a guessed fixed width.
 */
export function KeyValueChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      let max = 0;
      // `scrollWidth` reports the FULL text width even when the span is
      // currently truncated, so re-measures stay stable once the pinned
      // width is applied (no grow-feedback loop).
      el.querySelectorAll<HTMLElement>('[data-kv-label]').forEach(s => {
        max = Math.max(max, s.scrollWidth);
      });
      // + px-3 label padding (24) + 1px left border + 1px rounding guard.
      setLabelWidth(max > 0 ? max + 26 : null);
    };
    measure();
    // Chips mounting/unmounting later (e.g. a freshly added note) re-run
    // the measurement.  Attribute changes aren't observed, so setting the
    // CSS variable below never re-triggers the observer.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-component="KeyValueChipGroup"
      style={labelWidth !== null ? ({ '--kv-label-w': `${labelWidth}px` } as CSSProperties) : undefined}
      className={cn(
        // Until the variable lands the width resolves to `auto`, so the
        // first paint shows natural labels and snaps once measured.
        '[&_[data-kv-label-cell]]:w-(--kv-label-w) [&_[data-kv-label-cell]]:shrink-0',
        className,
      )}
    >
      {children}
    </div>
  );
}


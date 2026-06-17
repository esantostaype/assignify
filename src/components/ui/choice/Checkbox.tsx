'use client';

import {
  createContext, forwardRef, useCallback, useContext, useId, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Collapse } from '@/components/ui/surfaces';
import { Icon, PiCheck, PiMinus } from '@/lib/icons';

/* ─── Group context ─────────────────────────────────────────────────────── */

export type CheckboxSize    = 'sm' | 'md' | 'lg';
export type CheckboxVariant = 'default' | 'card';

interface CheckboxGroupCtx {
  name?:     string;
  value:     string[];
  toggle:    (value: string, checked: boolean) => void;
  size:      CheckboxSize;
  variant:   CheckboxVariant;
  disabled?: boolean;
  invalid?:  boolean;
}
const CheckboxGroupContext = createContext<CheckboxGroupCtx | null>(null);

/* ─── Group component ───────────────────────────────────────────────────── */

/** Layout flavour for the group:
 *    • `inline` — laid out horizontally on `md+` screens, stacks
 *      vertically below `md` so the row never wraps onto two lines.
 *      Use for filter strips, endorsement chips, multi-answer
 *      previews, etc.
 *    • `block`  — always stacked vertically.  Use for forms where
 *      each option is its own line.  */
export type CheckboxGroupLayout = 'inline' | 'block';

export interface CheckboxGroupProps {
  /** Optional shared `name` propagated to every child `Checkbox`'s
   *  underlying `<input>` — useful when posting the group as a form
   *  field.  Each child should still set its own `value` prop. */
  name?:         string;
  /** Controlled list of selected `value`s. */
  value?:        string[];
  /** Initial selected values (uncontrolled). */
  defaultValue?: string[];
  onChange?:     (next: string[]) => void;
  size?:         CheckboxSize;
  /** "default" = checkbox + label; "card" = each option is a padded
   *  box that tints primary when checked.  Matches the matching
   *  `RadioGroup` API so a card group of checkboxes reads visually
   *  identical to a card group of radios. */
  variant?:      CheckboxVariant;
  /** Axis of the group.  `inline` (default) flows horizontally on
   *  `md+` and stacks vertically on mobile; `block` is always a
   *  vertical stack. */
  layout?:       CheckboxGroupLayout;
  disabled?:     boolean;
  /** Marks every child checkbox's box red while unchecked (validation). */
  invalid?:      boolean;
  /** Validation message shown below the group (text-xs, error color),
   *  animated with `Collapse` — matches the FormField error behaviour. */
  error?:        ReactNode;
  className?:    string;
  children:      ReactNode;
}

/** Tailwind class fragment per layout × variant pair.  Card gets a
 *  tighter inter-card gap because each option already has its own
 *  border / padding chrome — `gap-4` between default-variant options
 *  would feel overly airy between cards. */
const GROUP_LAYOUT: Record<CheckboxGroupLayout, Record<CheckboxVariant, string>> = {
  inline: {
    default: 'flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-8',
    card:    'flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2',
  },
  block: {
    default: 'flex-col gap-4',
    card:    'flex-col gap-2',
  },
};

/**
 * Multi-select wrapper around `Checkbox`.  Hands every Checkbox
 * child a shared `name`, the current selected list, and a `toggle`
 * callback through context — drop a `value` on each child to opt
 * it into the group; otherwise the Checkbox keeps its uncontrolled
 * behaviour.
 *
 * Pairs with the `inline` / `block` axis the matching `RadioGroup`
 * uses so the two stay visually in lock-step across the app.  The
 * `card` variant also mirrors RadioGroup so a row of "boxy" toggles
 * looks identical whether it's single-select (radio) or multi-select
 * (checkbox).
 */
export function CheckboxGroup({
  name,
  value, defaultValue,
  onChange,
  size = 'md',
  variant = 'default',
  layout = 'inline',
  disabled,
  invalid,
  error,
  className,
  children,
}: CheckboxGroupProps) {
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as string[]) : internal;

  const toggle = useCallback((v: string, checked: boolean) => {
    const next = checked
      ? [...current, v]
      : current.filter((x) => x !== v);
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }, [current, isControlled, onChange]);

  const group = (
    <div
      role="group"
      data-component="CheckboxGroup"
      data-layout={layout}
      data-variant={variant}
      className={cn('flex', GROUP_LAYOUT[layout][variant], className)}
    >
      {children}
    </div>
  );

  return (
    <CheckboxGroupContext.Provider value={{ name, value: current, toggle, size, variant, disabled, invalid }}>
      {error !== undefined ? (
        <div className="flex flex-col gap-1.5">
          {group}
          <Collapse open={!!error}>
            <p className="text-xs text-error-600">{error}</p>
          </Collapse>
        </div>
      ) : group}
    </CheckboxGroupContext.Provider>
  );
}

/* ─── Single checkbox ───────────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  /** Indeterminate visual state (dash mark). */
  indeterminate?: boolean;
  size?: CheckboxSize;
  /** "default" = standalone checkbox + label.  "card" = each option
   *  is a padded tinted box (heights match Input / Select).  Can be
   *  set per-item or inherited from a parent `CheckboxGroup`. */
  variant?: CheckboxVariant;
  /** When the checkbox is inside a `CheckboxGroup`, set `value` to
   *  opt into the group's controlled list.  Without it the checkbox
   *  stays uncontrolled (the original behaviour). */
  value?: string;
  /** Paints the box border red (validation error) while unchecked. */
  invalid?: boolean;
}

const BOX_SIZE: Record<CheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-4.5 w-4.5',
  lg: 'h-5 w-5',
};

/** Card-variant geometry — matches RadioGroup's CARD_SIZE so a row
 *  of card checkboxes and a row of card radios line up exactly.
 *
 *  `min-h-*` floor paired with `h-*` defends against the flex-col
 *  collapse case: a card-variant Checkbox with `flex-1` inside a
 *  `flex-col` (mobile inline-layout breakpoint) would otherwise have
 *  its `h-*` overridden by `flex-basis: 0%` and collapse to ~22 px.
 *  Same pattern as Radio + Button. */
const CARD_SIZE: Record<CheckboxSize, string> = {
  sm: 'min-h-8  h-8  px-2   text-xs rounded',
  md: 'min-h-10 h-10 px-3 text-sm rounded-md',
  lg: 'min-h-12 h-12 px-4   text-sm rounded-lg',
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label, helper, indeterminate,
    size: sizeProp, variant: variantProp,
    className, id, disabled: disabledProp,
    checked, defaultChecked, onChange,
    value, name: nameProp, invalid,
    ...rest
  },
  ref,
) {
  const ctx = useContext(CheckboxGroupContext);

  // Resolve size / variant / disabled / name from the group context
  // when the local prop isn't set — same priority order as RadioGroup.
  const size     = sizeProp     ?? ctx?.size     ?? 'md';
  const variant  = variantProp  ?? ctx?.variant  ?? 'default';
  const disabled = disabledProp ?? ctx?.disabled;
  const name     = nameProp     ?? ctx?.name;
  const isInvalid = invalid     ?? ctx?.invalid;

  const autoId  = useId();
  const inputId = id ?? autoId;

  // Three possible drivers of `checked`, picked in priority order:
  //   1. The CONTROLLED `checked` prop on this Checkbox.
  //   2. The CheckboxGroup context, if the consumer passed a `value`.
  //   3. The internal uncontrolled state, seeded from `defaultChecked`.
  const inGroup        = ctx !== null && value !== undefined;
  const groupChecked   = inGroup ? ctx!.value.includes(value!) : undefined;
  const [internal, setInternal] = useState(defaultChecked ?? false);

  const isControlled =
    checked !== undefined ||
    groupChecked !== undefined;
  const isChecked: boolean = isControlled
    ? (checked !== undefined ? !!checked : !!groupChecked)
    : internal;

  const showMark = isChecked || indeterminate;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternal(e.target.checked);
    if (inGroup) ctx!.toggle(value!, e.target.checked);
    onChange?.(e);
  };

  /** Indicator (the box + check / dash mark).  Shared between the
   *  default and card variants — they only differ in the outer
   *  label chrome.
   *
   *  WHY explicit `BOX_SIZE` on the OUTER wrapper too:  the outer
   *  `<span>` is `inline-flex` and sits as a flex item inside the
   *  parent label.  Without an explicit size it derives its height
   *  from its single in-flow child (the inner box), but the
   *  intrinsic baseline of an `inline-flex` shifts subtly when its
   *  content goes from empty (unchecked) to containing a `<svg>`
   *  (checked) — enough to nudge the whole row down by ~1 px on
   *  every state flip.  Locking the wrapper to the exact box size
   *  + `leading-none` removes any line-box contribution so the
   *  indicator stays pixel-stable through the check / uncheck
   *  transition. */
  const indicator = (
    <span className={cn('relative inline-flex shrink-0 leading-none', BOX_SIZE[size])}>
      <input
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }}
        id={inputId}
        type="checkbox"
        name={name}
        value={value}
        checked={isControlled ? isChecked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        disabled={disabled}
        onChange={handleChange}
        className="peer absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded border-2 transition-colors text-white',
          'h-full w-full',
          showMark
            ? 'bg-primary-600 border-primary-600'
            : isInvalid
              ? 'bg-(--color-surface-card) border-error-500 peer-hover:border-error-600'
              : 'bg-(--color-surface-card) border-(--color-border-strong) peer-hover:border-primary-500',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-200 peer-focus-visible:ring-offset-1',
        )}
      >
        {indeterminate ? (
          <Icon icon={PiMinus} size={size === 'sm' ? 12 : 14} className="text-white" />
        ) : isChecked ? (
          <Icon icon={PiCheck} size={size === 'sm' ? 12 : 14} className="text-white" />
        ) : null}
      </span>
    </span>
  );

  // ── Card variant — whole row becomes a tinted box when checked.
  if (variant === 'card') {
    return (
      <label
        htmlFor={inputId}
        data-component="Checkbox"
        data-variant="card"
        data-size={size}
        data-checked={isChecked ? 'true' : 'false'}
        className={cn(
          'group inline-flex items-center gap-2 cursor-pointer select-none',
          'border transition-colors',
          CARD_SIZE[size],
          isChecked
            ? 'bg-primary-50 border-primary-300 text-primary-900'
            : 'bg-(--color-surface-card) border-(--color-border-default) text-(--color-text-default) hover:border-(--color-border-strong)',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
      >
        {indicator}
        {label && (
          <span className={cn('font-medium', isChecked ? 'text-primary-900' : 'text-(--color-text-strong)')}>
            {label}
          </span>
        )}
      </label>
    );
  }

  // ── Default variant — checkbox + label / helper stacked.
  //
  // WHY `align-top` + `items-center` + dropping the legacy `-mt-px`:
  //   • The label was `inline-flex items-start` and lived in its
  //     parent's inline formatting context.  An `inline-flex`
  //     element's vertical position in its parent's line box is set
  //     by its BASELINE.  The baseline of an `inline-flex` with no
  //     baseline-aligned flex item is "synthesized from the end
  //     margin edge of the flex container," so it depended on the
  //     INNER content of the indicator — empty box vs SVG-check —
  //     and shifted by ~1 px the moment the producer ticked the
  //     box.  Every row in the doc grid that got checked floated
  //     down a pixel relative to its still-unchecked neighbours.
  //   • `align-top` (vertical-align: top) anchors the label to the
  //     top of the parent's line box and IGNORES baseline math
  //     entirely.  `items-center` centers the 16-px indicator
  //     against the 21-px text line; for single-line labels (the
  //     common case) the result is visually identical to
  //     items-start, but it removes the load-bearing `-mt-px`
  //     hack that was compensating for the baseline mismatch the
  //     align-top now fixes structurally.  Multi-line helpers
  //     still read correctly because the indicator centers
  //     against the whole content stack rather than against the
  //     first line. */
  return (
    <label
      htmlFor={inputId}
      data-component="Checkbox"
      data-variant="default"
      className={cn(
        'group inline-flex items-center gap-2 cursor-pointer select-none align-top',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {indicator}

      {(label || helper) && (
        <span className="flex flex-col">
          {label && <span className="text-sm text-(--color-text-strong) leading-tight">{label}</span>}
          {helper && <span className="text-xs text-(--color-text-muted)">{helper}</span>}
        </span>
      )}
    </label>
  );
});

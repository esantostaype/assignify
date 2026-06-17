'use client';

import {
  createContext, forwardRef, useContext, useId, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export type RadioVariant = 'default' | 'card';
export type RadioSize = 'sm' | 'md' | 'lg';

// RadioGroup context
interface RadioGroupCtx {
  name: string;
  value: string | undefined;
  onChange: (v: string) => void;
  size: RadioSize;
  variant: RadioVariant;
  disabled?: boolean;
}
const RadioGroupContext = createContext<RadioGroupCtx | null>(null);

/** Layout flavour for the group:
 *    • `inline` — laid out horizontally on `md+` screens, stacks
 *      vertically below `md` so the row never wraps onto two lines.
 *      Use for filter strips, answer-type pickers, etc.
 *    • `block`  — always stacked vertically.  Use for forms where
 *      each option is a "line" of its own.
 *
 *  Cards (`variant="card"`) honour the same axis with their own gap
 *  scale so the chips read as a row of pills, not a list. */
export type RadioGroupLayout = 'inline' | 'block';

export interface RadioGroupProps {
  name: string;
  /** Controlled selected value. */
  value?: string;
  /** Initial value (uncontrolled). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Matches Input/Select sizes — sm=32px, md=40px, lg=48px when variant="card". */
  size?: RadioSize;
  /** "default" = inline circle + label, "card" = each option is a padded box that tints when selected. */
  variant?: RadioVariant;
  /** Axis of the group.  `inline` (default) flows horizontally on
   *  `md+` and stacks vertically on mobile; `block` is always a
   *  vertical stack. */
  layout?: RadioGroupLayout;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Tailwind class fragment for each layout × variant pair.  Inline
 *  uses `md:` prefixes so the row only goes horizontal at the `md`
 *  breakpoint up — below that, every option stacks. */
const LAYOUT_CLASSES: Record<RadioGroupLayout, Record<RadioVariant, string>> = {
  inline: {
    default: 'flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-8',
    card:    'flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2',
  },
  block: {
    default: 'flex-col gap-4',
    card:    'flex-col gap-2',
  },
};

export function RadioGroup({
  name, value, defaultValue, onChange,
  size = 'md', variant = 'default', layout = 'inline', disabled,
  className, children,
}: RadioGroupProps) {
  // Track the selected value ourselves so uncontrolled groups still highlight
  // the matching radio. When `value` is supplied we run in controlled mode.
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const handleChange = (v: string) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  return (
    <RadioGroupContext.Provider value={{ name, value: current, onChange: handleChange, size, variant, disabled }}>
      <div
        role="radiogroup"
        data-component="RadioGroup"
        data-layout={layout}
        className={cn(
          'flex',
          LAYOUT_CLASSES[layout][variant],
          className,
        )}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

// Radio
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  helper?: ReactNode;
  size?: RadioSize;
  /** Overrides the parent RadioGroup variant for this single option. */
  variant?: RadioVariant;
  value: string;
}

const DOT_SIZE: Record<RadioSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-4.5 w-4.5',
  lg: 'h-5 w-5',
};

const DOT_INNER: Record<RadioSize, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

// Card-variant geometry — matches Input/Select sizes so a radio can sit
// next to a date / select without breaking the line.
//
// `min-h-*` is paired with `h-*` deliberately: when a card-variant Radio
// carries `flex-1` inside a `flex-col` group (the mobile branch of the
// inline layout), `flex-basis: 0%` overrides `height` for the main
// axis and the card collapses to its content height (~22 px).  The
// `min-height` floor isn't subject to flex distribution, so the card
// stays at the expected 32 / 40 / 48 px regardless of flex direction.
// Same pattern Button.tsx uses for its `SIZE` map.
const CARD_SIZE: Record<RadioSize, string> = {
  sm: 'min-h-8  h-8  px-2   text-xs rounded',
  md: 'min-h-10 h-10 px-3 text-sm rounded-md',
  lg: 'min-h-12 h-12 px-4   text-sm rounded-lg',
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, helper, size: sizeProp, variant: variantProp, className, id, name: nameProp, disabled: disabledProp, value, checked, defaultChecked, onChange, ...rest },
  ref,
) {
  const ctx = useContext(RadioGroupContext);
  const autoId = useId();
  const inputId = id ?? autoId;
  const size = sizeProp ?? ctx?.size ?? 'md';
  const variant = variantProp ?? ctx?.variant ?? 'default';
  const name = nameProp ?? ctx?.name ?? autoId;
  const disabled = disabledProp ?? ctx?.disabled;

  // Resolve the checked state in priority order:
  // 1. controlled `checked` prop on the Radio itself
  // 2. group context value (controlled or uncontrolled via the group)
  // 3. fall back to letting the native input drive via defaultChecked
  const groupValue = ctx?.value;
  const isControlled = checked !== undefined || groupValue !== undefined;
  const isChecked = isControlled
    ? (checked !== undefined ? checked : groupValue === value)
    : undefined;

  const indicator = (
    <span className="relative inline-flex shrink-0">
      <input
        ref={ref}
        id={inputId}
        type="radio"
        name={name}
        value={value}
        checked={isChecked}
        defaultChecked={isChecked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        onChange={(e) => { ctx?.onChange(value); onChange?.(e); }}
        className="peer absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          'inline-flex items-center justify-center rounded-full border-2 transition-colors',
          DOT_SIZE[size],
          'border-(--color-border-strong) bg-(--color-surface-card)',
          'peer-hover:border-primary-500',
          'peer-checked:border-primary-600',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-200 peer-focus-visible:ring-offset-1',
          isChecked && 'border-primary-600',
        )}
      >
        <span
          className={cn(
            'rounded-full bg-primary-600 transition-transform',
            DOT_INNER[size],
            isChecked === undefined
              ? 'scale-0 peer-checked:scale-100'
              : isChecked ? 'scale-100' : 'scale-0',
          )}
        />
      </span>
    </span>
  );

  // ── Card variant — whole row becomes a tinted box when selected.
  if (variant === 'card') {
    return (
      <label
        htmlFor={inputId}
        data-component="Radio"
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

  return (
    <label
      htmlFor={inputId}
      data-component="Radio"
      className={cn(
        'group inline-flex items-start gap-2 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {indicator}

      {(label || helper) && (
        <span className="flex flex-col -mt-px">
          {label && <span className="text-sm text-(--color-text-strong)">{label}</span>}
          {helper && <span className="text-xs text-(--color-text-muted)">{helper}</span>}
        </span>
      )}
    </label>
  );
});

'use client';

import {
  forwardRef, useId, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { FormField } from './FormField';

export type InputSize  = 'sm' | 'md' | 'lg';
/** How an adornment slot is positioned inside the input's border:
 *
 *    `inline` (default) — text or icon decoration with the standard
 *                         `px-3` inset.  Pick for static markers like
 *                         `$`, `USD`, `%`, or a leading search icon —
 *                         the inset visually balances the input text's
 *                         own padding so the marker reads as part of
 *                         the same line of typography.
 *    `action`           — for `IconButton` / `Button` adornments that
 *                         should hug the input's edge.  Drops the
 *                         outer `px-3` inset down to `px-1` (4 px) so
 *                         the actionable control sits flush against
 *                         the border without colliding with the
 *                         border line itself.  Use whenever the
 *                         adornment is a clickable surface — keeps
 *                         the click target generous and the visual
 *                         tighter than the text-marker treatment. */
export type InputAdornmentVariant = 'inline' | 'action';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'color'> {
  size?:  InputSize;
  /** Decorator rendered before the input value (icon or text like `$`). */
  startAdornment?: ReactNode;
  /** Decorator rendered after the input value (icon or text like `USD`). */
  endAdornment?:   ReactNode;
  /** Position variant for `startAdornment` — `'inline'` (default) for
   *  text / icon markers, `'action'` for clickable surfaces that
   *  should hug the input's left edge. */
  startAdornmentVariant?: InputAdornmentVariant;
  /** Position variant for `endAdornment` — `'inline'` (default) for
   *  text / icon markers, `'action'` for clickable surfaces (Button /
   *  IconButton) that should hug the input's right edge. */
  endAdornmentVariant?:   InputAdornmentVariant;
  /** Visible label above the control. */
  label?: ReactNode;
  /** Helper text shown below the control. */
  helper?: ReactNode;
  /** Error message — visually marks the field and replaces the helper. */
  error?: ReactNode;
  required?: boolean;
  /** Show the field in error styling even without an explicit message. */
  invalid?: boolean;
  fullWidth?: boolean;
}

const SIZE_CLS: Record<InputSize, { wrap: string; input: string; ad: string }> = {
  sm: { wrap: 'h-8',  input: 'text-xs px-3',   ad: 'text-xs' },
  md: { wrap: 'h-10', input: 'text-sm px-3.5', ad: 'text-sm' },
  lg: { wrap: 'h-12', input: 'text-sm px-4',   ad: 'text-sm' },
};

/** Single resting surface for every field — always `surface-card`
 *  (white in light mode, elevated neutral in dark).  The old
 *  `default`/`simple` shade variants were removed: the tinted
 *  `default` background read as a disabled/inactive field, so every
 *  control now uses the white "simple" treatment.  Token, NOT a
 *  hardcoded `bg-white`, so it keeps a proper dark-mode counterpart. */
const SURFACE_REST = 'bg-(--color-surface-card)';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    startAdornment, endAdornment,
    startAdornmentVariant = 'inline',
    endAdornmentVariant   = 'inline',
    label, helper, error, required, invalid,
    fullWidth = true,
    className, id, onFocus, onBlur, disabled, readOnly,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const isError = invalid || !!error;
  const [focused, setFocused] = useState(false);
  const sz = SIZE_CLS[size];

  // Background picked ONCE per state so two `bg-*` utilities never
  // stack in the same string (project's `cn` is a plain concatenator
  // — collisions resolve unpredictably).  Disabled gets the subtle
  // surface; every other state stays on the single white resting
  // surface.
  const bgCls = disabled ? 'bg-(--color-surface-subtle)' : SURFACE_REST;

  const wrapperCls = cn(
    // overflow-hidden: recorta el fondo del autofill del navegador a las esquinas redondeadas.
    'flex items-center gap-2 rounded-md border transition-colors min-w-0 overflow-hidden',
    sz.wrap,
    fullWidth && 'w-full',
    bgCls,
    isError
      ? 'border-error-500'
      : focused
        ? 'border-primary-600'
        : 'border-(--color-border-strong) hover:border-(--color-text-subtle)',
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  );

  const inputCls = cn(
    // self-stretch: el input ocupa TODA la altura del wrapper para que el fondo del
    // autofill (box-shadow inset, ver globals.css) cubra el control entero y no una franja.
    'min-w-0 flex-1 self-stretch bg-transparent text-(--color-text-strong) placeholder:text-(--color-text-subtle) outline-none border-0',
    sz.input,
    startAdornment ? 'pl-0' : '',
    endAdornment   ? 'pr-0' : '',
  );

  const adornCls = cn('shrink-0 flex items-center text-(--color-text-subtle)', sz.ad);

  // Outer inset per adornment slot — `inline` keeps the legacy
  // `pl-3`/`pr-3` (12 px) typography-style padding; `action` switches
  // to `pl-1`/`pr-1` (4 px) so a clickable Button / IconButton sits
  // flush against the input border without colliding with it.  The
  // gap-2 between the input value and the adornment span (set on the
  // wrapper) stays in both modes so the actionable control still has
  // breathing room from the text it sits next to.
  const startInset = startAdornmentVariant === 'action' ? 'pl-1' : 'pl-3';
  const endInset   = endAdornmentVariant   === 'action' ? 'pr-1' : 'pr-3';

  const field = (
    <div className={wrapperCls} data-component="Input" data-size={size} data-invalid={isError || undefined}>
      {startAdornment && <span className={cn(adornCls, startInset)}>{startAdornment}</span>}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={isError || undefined}
        aria-describedby={(helper || error) ? `${inputId}-desc` : undefined}
        className={inputCls}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {endAdornment && <span className={cn(adornCls, endInset)}>{endAdornment}</span>}
    </div>
  );

  if (label || helper || error) {
    return (
      <FormField
        label={label}
        helper={helper}
        error={error}
        required={required}
        htmlFor={inputId}
      >
        {field}
      </FormField>
    );
  }
  return field;
});

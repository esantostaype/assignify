'use client';

import {
  forwardRef, useCallback, useEffect, useId, useRef, useState,
  type ChangeEvent, type ForwardedRef,
  type TextareaHTMLAttributes, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { FormField } from './FormField';

export type TextareaSize = 'sm' | 'md' | 'lg';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'color'> {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  invalid?: boolean;
  fullWidth?: boolean;
  /** Height bucket — mirrors Input (`sm` 32px · `md` 40px · `lg` 48px).
   *  A `minRows={1}` textarea is exactly the matching Input's height. */
  size?: TextareaSize;
  /** Minimum number of rows.  `1` makes the field exactly an Input's
   *  height for the chosen `size`; each extra line grows it one row
   *  taller.  Default 3. */
  minRows?: number;
}

/** Single resting surface for every field — always white
 *  (`surface-card`).  See `Input.tsx`: the old tinted `default` shade
 *  read as disabled, so the shade variants were removed. */
const SURFACE_REST = 'bg-(--color-surface-card)';

// Per-size vertical metrics — picked so a 1-row textarea is exactly the
// matching Input's height and every extra line adds one clean row:
//   total = line-height + paddingY×2 + border(1px)×2
//   sm → 16 + 7×2  + 2 = 32px (Input h-8 / text-xs)   → +16px / row
//   md → 20 + 9×2  + 2 = 40px (Input h-10 / text-sm)  → +20px / row
//   lg → 20 + 13×2 + 2 = 48px (Input h-12 / text-sm)  → +20px / row
// `cls` carries the Tailwind type/leading/padding that match these
// numbers (and the horizontal padding of the matching Input).
const BORDER_Y_PX = 2;
const SIZE_META: Record<TextareaSize, { line: number; padY: number; cls: string }> = {
  sm: { line: 16, padY: 7,  cls: 'text-xs px-3   py-[7px]  leading-4' },
  md: { line: 20, padY: 9,  cls: 'text-sm px-3.5 py-[9px]  leading-5' },
  lg: { line: 20, padY: 13, cls: 'text-sm px-4   py-[13px] leading-5' },
};
const minHeightFor = (rows: number, size: TextareaSize) =>
  Math.max(1, rows) * SIZE_META[size].line + SIZE_META[size].padY * 2 + BORDER_Y_PX;

/**
 * Auto-growing textarea.  Resize is locked (no drag handle); the field
 * instead grows/shrinks to fit its content, one row at a time — press
 * Enter and it gains a row, delete the line and it gives it back, never
 * dropping below `minRows`.  At `minRows={1}` it matches an Input.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label, helper, error, required, invalid,
    fullWidth = true, size = 'md', minRows = 3,
    className, id, onFocus, onBlur, onChange, disabled, readOnly,
    value, defaultValue,
    rows: _rows, // ignored — height is content-driven, not row-count driven
    ...rest
  },
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const isError = invalid || !!error;
  const [focused, setFocused] = useState(false);

  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset to `auto` first so the field can SHRINK, then size it to the
  // content (scrollHeight is padding + content under border-box; add the
  // border to land the full outer height).  The inline `min-height`
  // clamps it up to `minRows` when the content is shorter.
  const resize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + BORDER_Y_PX}px`;
  }, []);

  // Merge the forwarded ref with our internal one, and size on mount so
  // a pre-filled value renders at the right height with no flash.
  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      resize(node);
    },
    [ref, resize],
  );

  // Re-size when the controlled value or minRows changes (covers
  // programmatic updates that don't go through the onChange handler).
  useEffect(() => {
    resize(innerRef.current);
  }, [resize, value, minRows, size]);

  // Re-size whenever the field's WIDTH changes — text rewraps at a new
  // width, so the row count (and height) can change.  Watching width
  // also self-heals a mount that measured at zero/partial width (the
  // height would otherwise stay stuck on its first, wrong reading).
  // Guard on width only: resize mutates HEIGHT, so reacting to height
  // here would feed back into an infinite observe→resize→observe loop.
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        resize(el);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    resize(e.currentTarget);
    onChange?.(e);
  };

  // Background resolved ONCE so two `bg-*` utilities never stack —
  // same rationale as Input's `bgCls`.
  const bgCls = disabled ? 'bg-(--color-surface-subtle)' : SURFACE_REST;

  const cls = cn(
    'block w-full rounded-md border',
    SIZE_META[size].cls,
    'text-(--color-text-strong) placeholder:text-(--color-text-subtle) outline-none',
    'transition-colors resize-none overflow-hidden',
    bgCls,
    isError
      ? 'border-error-500'
      : focused
        ? 'border-primary-600'
        : 'border-(--color-border-strong) hover:border-(--color-text-subtle)',
    disabled && 'opacity-50 cursor-not-allowed',
    !fullWidth && 'inline-block w-auto',
    className,
  );

  const field = (
    <textarea
      ref={setRef}
      id={inputId}
      data-component="Textarea"
      // `rows={1}` keeps the intrinsic (pre-JS / no-JS) height tiny; the
      // inline `min-height` enforces `minRows`, and the auto-resize takes
      // over once mounted.
      rows={1}
      data-size={size}
      style={{ minHeight: minHeightFor(minRows, size) }}
      disabled={disabled}
      readOnly={readOnly}
      value={value}
      defaultValue={defaultValue}
      aria-invalid={isError || undefined}
      aria-describedby={(helper || error) ? `${inputId}-desc` : undefined}
      className={cls}
      onChange={handleChange}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      {...rest}
    />
  );

  if (label || helper || error) {
    return (
      <FormField label={label} helper={helper} error={error} required={required} htmlFor={inputId}>
        {field}
      </FormField>
    );
  }
  return field;
});

'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Typography } from '@/components/ui/typography';
import { Collapse } from '@/components/ui/surfaces';

export interface FormFieldProps {
  /** Label rendered above the control. */
  label?: ReactNode;
  /** Helper / description text below the control. */
  helper?: ReactNode;
  /** Error message â€” replaces helper and switches the field into error styling. */
  error?: ReactNode;
  /** Show a red `*` next to the label. */
  required?: boolean;
  /** id of the form control â€” wires label/aria-describedby automatically. */
  htmlFor?: string;
  /** Slot rendered on the RIGHT side of the label row — e.g. a small
   *  "Remove" button that belongs with this specific field instance
   *  (repeatable list items: "Bind Order #2 — Remove").  When a
   *  `trailing` node is provided the label row becomes a flex row
   *  with the label on the left, a flexible spacer in the middle,
   *  and the trailing node anchored to the right. */
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label, helper, error, required, htmlFor, trailing, className, children,
}: FormFieldProps) {
  const describedById = htmlFor ? `${htmlFor}-desc` : undefined;
  return (
    <div
      data-component="FormField"
      // `min-w-0` lets the field shrink below its intrinsic content
      // width when it sits inside a flex / grid container — CSS sets
      // `min-width: auto` on flex / grid children by default, and
      // `<input>`'s intrinsic min-width (driven by its `size`
      // attribute, default 20 chars ≈ 170 px) would otherwise push
      // the field past its track and overflow into the neighbouring
      // cell.  Outside of constrained containers this is a no-op.
      className={cn('flex flex-col gap-1.5 min-w-0', className)}
    >
      {(label || trailing) && (
        // Label row — when a `trailing` slot is supplied we render
        // the label on the LEFT and the trailing node on the RIGHT
        // with a flex container, so siblings like "Remove" buttons
        // can live in the same row as the label without breaking
        // the existing label-only layout.  Without `trailing` the
        // label keeps its original block flow (just the Typography
        // span) — no regression for the common case.
        trailing ? (
          <div className="flex items-center justify-between gap-2 min-h-7">
            {label ? (
              <Typography variant="label" htmlFor={htmlFor}>
                {label}
                {required && <span className="ml-0.5 text-error-500">*</span>}
              </Typography>
            ) : <span />}
            <div className="shrink-0">{trailing}</div>
          </div>
        ) : (
          // Every form label across the app flows through the shared
          // `formLabel` Typography token (14 px semibold + text-default)
          // so any future tweak to the look (size, weight, color) lives
          // in one place — Typography.tsx → `VARIANT_CLS.formLabel`.
          <Typography variant="label" htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-0.5 text-error-500">*</span>}
          </Typography>
        )
      )}
      {children}
      {/* Error / helper message — wrapped in `<Collapse>` so the line
          slides in (or out) instead of snapping into the layout.
          The DOM stays mounted across the close animation so the
          parent's flex-col gap-1.5 doesn't jump when the message
          flips between `error` ↔ `helper` ↔ none.  When BOTH error
          and helper are absent, Collapse closes to height 0 and
          drops the trailing gap via its own compensation logic. */}
      <Collapse open={!!(error || helper)}>
        {error ? (
          <p id={describedById} className="text-xs text-error-600">{error}</p>
        ) : helper ? (
          <p id={describedById} className="text-xs text-(--color-text-muted)">{helper}</p>
        ) : null}
      </Collapse>
    </div>
  );
}

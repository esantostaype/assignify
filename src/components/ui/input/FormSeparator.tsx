'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Typography } from '@/components/ui/typography';

export type FormSeparatorSize = 'sm' | 'md' | 'lg' | 'xl';

export interface FormSeparatorProps {
  /** The label shown before the horizontal divider line. */
  children: ReactNode;
  /** Trailing slot to the right of the divider — e.g. a chip like
   *  "DATA FROM EPIC" or a small button.  Optional. */
  trailing?: ReactNode;
  /** Title size — drives the font-size of the label.
   *    sm  → 16 px (current default across the app)
   *    md  → 18 px
   *    lg  → 20 px
   *    xl  → 24 px
   *  The horizontal divider line is the same colour and weight at
   *  every size; only the label scales. */
  size?: FormSeparatorSize;
  /** Override the label colour.  Defaults to `primary-700` — the
   *  brand-tinted "section header" tone used in forms. */
  color?: string;
  className?: string;
}

const SIZE_TEXT: Record<FormSeparatorSize, string> = {
  sm: 'text-base]',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/**
 * Form separator — a section-titled divider used to break a long form
 * into named groups ("Account", "Search Account", "Summary", "Addons",
 * "Attachments", etc.).  Renders as a bold label on the left, a thin
 * primary-tinted horizontal line filling the remaining width, and an
 * optional trailing slot on the right.
 *
 *   Addons ─────────────────────────────────────
 *
 * Use it ABOVE a group of related form fields.  When you need the
 * group to behave as a single block (with the body wrapped in a
 * shared container), reach for `FormSection` instead — that one
 * composes a FormSeparator with a body wrapper underneath.
 */
export function FormSeparator({
  children, trailing,
  size = 'sm',
  color = 'primary-700',
  className,
}: FormSeparatorProps) {
  return (
    <header
      data-component="FormSeparator"
      data-size={size}
      className={cn(
        // Stack vertically on narrow screens (title over trailing, no
        // line); switch to the inline title · line · trailing row at md+.
        'flex flex-col items-start gap-2',
        'md:flex-row md:items-center md:gap-3',
        className,
      )}
    >
      <Typography
        variant="inherit"
        as="span"
        className={cn(SIZE_TEXT[size], 'font-bold whitespace-nowrap shrink-0 leading-tight')}
        color={color}
      >
        {children}
      </Typography>
      {/* Divider line only shows once we're inline (md+). */}
      <div className="hidden md:block flex-1 h-px bg-primary-200" />
      {trailing && <div className="md:shrink-0">{trailing}</div>}
    </header>
  );
}

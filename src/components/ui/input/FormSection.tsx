'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FormSeparator, type FormSeparatorSize } from './FormSeparator';

export interface FormSectionProps {
  /** Section label rendered before the divider line. */
  title: ReactNode;
  /** Optional trailing slot — e.g. a chip such as "DATA EXTRACTED FROM EPIC". */
  trailing?: ReactNode;
  /** Title size — forwarded to the underlying `FormSeparator`.
   *  Defaults to `sm` (16 px) to preserve the current look across the
   *  app. */
  size?: FormSeparatorSize;
  /** Section body (form fields). */
  children?: ReactNode;
  className?: string;
}

/**
 * Form section divider — a `FormSeparator` on top plus the fields
 * underneath inside a spaced wrapper.  Keep using this when you want
 * the separator AND a body block together; reach for `FormSeparator`
 * directly when you just need the titled divider without an enclosing
 * group.
 */
export function FormSection({ title, trailing, size = 'sm', children, className }: FormSectionProps) {
  return (
    <section data-component="FormSection" className={cn('space-y-4', className)}>
      <FormSeparator size={size} trailing={trailing}>{title}</FormSeparator>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

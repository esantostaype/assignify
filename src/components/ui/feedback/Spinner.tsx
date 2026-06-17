'use client';

import { cn } from '@/lib/cn';

export interface SpinnerProps {
  size?: number;
  /** Tailwind text-color class — controls the spinner color via currentColor. */
  colorClassName?: string;
  className?: string;
}

export function Spinner({ size = 18, colorClassName = 'text-primary-600', className }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      data-component="Spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn('animate-spin', colorClassName, className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

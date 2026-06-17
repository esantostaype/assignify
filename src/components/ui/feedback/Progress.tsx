'use client';

import { cn } from '@/lib/cn';

export interface ProgressProps {
  /** 0–100. Omit for an indeterminate animated bar. */
  value?: number;
  /** Visual size. */
  size?: 'sm' | 'md';
  color?: 'primary' | 'success' | 'error' | 'warning';
  className?: string;
}

const TRACK = { sm: 'h-1', md: 'h-1.5' } as const;
const BAR_COLOR = {
  primary: 'bg-primary-600',
  success: 'bg-success-600',
  error:   'bg-error-600',
  warning: 'bg-warning-500',
};

export function Progress({ value, size = 'md', color = 'primary', className }: ProgressProps) {
  const indeterminate = value === undefined;
  return (
    <div
      role="progressbar"
      data-component="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.max(0, Math.min(100, value!))}
      className={cn('w-full overflow-hidden rounded-full bg-neutral-200', TRACK[size], className)}
    >
      {indeterminate ? (
        <div className={cn('h-full w-1/3 rounded-full animate-[progress-indet_1.2s_ease-in-out_infinite]', BAR_COLOR[color])} />
      ) : (
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', BAR_COLOR[color])}
          style={{ width: `${Math.max(0, Math.min(100, value!))}%` }}
        />
      )}
      <style>{`@keyframes progress-indet { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }`}</style>
    </div>
  );
}

export interface CircularProgressProps {
  value?: number;
  size?: number;
  thickness?: number;
  color?: 'primary' | 'success' | 'error' | 'warning';
  className?: string;
}

export function CircularProgress({
  value, size = 24, thickness = 2.5,
  color = 'primary', className,
}: CircularProgressProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const indeterminate = value === undefined;
  const dash = indeterminate ? c * 0.25 : (c * Math.max(0, Math.min(100, value!))) / 100;
  const colorCls = BAR_COLOR[color].replace('bg-', 'text-');

  return (
    <svg
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(indeterminate && 'animate-spin', colorCls, className)}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth={thickness} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

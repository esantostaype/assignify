'use client';

import { type ImgHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type AvatarColor = 'primary' | 'neutral' | 'success' | 'error' | 'warning';

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'children'> {
  /** Optional image src - falls back to initials/icon if missing. */
  src?: string;
  /** Initials or text fallback (when no src). */
  children?: ReactNode;
  size?: AvatarSize;
  color?: AvatarColor;
  shape?: 'circle' | 'square';
}

// Size geometry — kept in lockstep with `<Button>` and `<IconButton>`
// so an Avatar / Button / IconButton trio at the same `size` lines
// up on a shared baseline (header user pile, drawer chrome, etc.):
//   • `xs` — 24 px  (toolbars / chip-row context)
//   • `sm` — 32 px  (matches Button sm)
//   • `md` — 40 px  (matches Button md)
//   • `lg` — 48 px  (matches Button lg)
const SIZE: Record<AvatarSize, string> = {
  xs: 'h-6  w-6  text-[10px]',
  sm: 'h-8  w-8  text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
};

const COLOR: Record<AvatarColor, string> = {
  primary: 'bg-primary-100 text-primary-700',
  neutral: 'bg-(--color-surface-subtle) text-(--color-text-default)',
  success: 'bg-success-100 text-success-700',
  error:   'bg-error-100   text-error-700',
  warning: 'bg-warning-100 text-warning-800',
};

export function Avatar({
  src, alt, children, size = 'md', color = 'primary', shape = 'circle',
  className, ...rest
}: AvatarProps) {
  const cls = cn(
    'inline-flex items-center justify-center font-semibold overflow-hidden shrink-0',
    shape === 'circle' ? 'rounded-full' : 'rounded-md',
    SIZE[size], COLOR[color], className,
  );
  if (src) {
    return <img src={src} alt={alt ?? ''} data-component="Avatar" data-size={size} data-color={color} data-shape={shape} className={cls} {...rest} />;
  }
  return <span aria-label={alt} data-component="Avatar" data-size={size} data-color={color} data-shape={shape} className={cls}>{children}</span>;
}

/** Group of avatars rendered with - small negative overlap. */
export function AvatarGroup({
  children, max, className,
}: { children: ReactNode; max?: number; className?: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const visible = max ? arr.slice(0, max) : arr;
  const extra = max && arr.length > max ? arr.length - max : 0;
  return (
    <div className={cn('inline-flex -space-x-2', className)}>
      {visible}
      {extra > 0 && (
        // `+N` pill mirrors the default Avatar md (40 px) so a group
        // built from medium avatars lines up visually with its tail.
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-(--color-text-muted) ring-2 ring-white">
          +{extra}
        </span>
      )}
    </div>
  );
}

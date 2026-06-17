'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Optional inline label (only with horizontal orientation). */
  children?: ReactNode;
  className?: string;
}

export function Divider({ orientation = 'horizontal', children, className }: DividerProps) {
  if (orientation === 'vertical') {
    return <span role="separator" data-component="Divider" aria-orientation="vertical" className={cn('inline-block w-px h-full bg-(--color-border-default)', className)} />;
  }
  if (children) {
    return (
      <div role="separator" data-component="Divider" className={cn('flex items-center gap-3 text-[11px] uppercase tracking-wide text-(--color-text-subtle)', className)}>
        <span className="h-px flex-1 bg-(--color-border-default)" />
        <span>{children}</span>
        <span className="h-px flex-1 bg-(--color-border-default)" />
      </div>
    );
  }
  return <hr role="separator" data-component="Divider" className={cn('border-0 h-px bg-(--color-border-default)', className)} />;
}

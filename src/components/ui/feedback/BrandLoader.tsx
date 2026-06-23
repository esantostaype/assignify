'use client';

import { cn } from '@/lib/cn';
import { BrandSpinner } from './BrandSpinner';

export interface BrandLoaderProps {
  /** Caption rendered below the spinner. */
  label?: string;
  /** BrandSpinner diameter in px. Default 48 (matches every loading state). */
  size?: number;
  className?: string;
}

/**
 * BrandLoader — the BrandSpinner + a caption, stacked and centred. The SINGLE
 * source for "loading…" states across the app (Settings loader, the Create Task
 * form busy overlay, …) so they all look identical: same size, same readable
 * caption colour. Drop it inside any centred container and pass a `label`.
 */
export function BrandLoader({ label, size = 48, className }: BrandLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <BrandSpinner size={size} colorClassName="text-primary-500" />
      {label && <span className="text-sm font-medium text-(--color-text-default)">{label}</span>}
    </div>
  );
}

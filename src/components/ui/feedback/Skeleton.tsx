'use client';

import { type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  /** Explicit width (`number` → px, `string` → CSS value).  When omitted
   *  the placeholder fills the parent — handy for stacking a few
   *  `Skeleton` blocks inside a flex column where each line should span
   *  the column width naturally. */
  width?: number | string;
  /** Explicit height (`number` → px, `string` → CSS value).  Optional;
   *  the `text` variant ships with its own 12 px height and the others
   *  size themselves off `width` (circles) or the parent. */
  height?: number | string;
  /** Shape preset:
   *    `text`   — slim line at 12 px high with the standard `rounded-sm`
   *               radius.  Stretch via `width` for headings / paragraph
   *               lines.
   *    `rect`   — generic block (`rounded-sm`).  Use for cards,
   *               thumbnails, button-shaped placeholders.
   *    `circle` — round avatar.  Pass equal `width` + `height`.
   */
  variant?: 'text' | 'rect' | 'circle';
  className?: string;
  style?: CSSProperties;
}

/**
 * Skeleton — content placeholder for loading states.
 *
 * Paints a slightly raised neutral block (`--color-skeleton-base`) with
 * a soft white shimmer band that sweeps left-to-right on a loop.  The
 * tone auto-flips through the project's neutral ramp in Dark mode, and
 * the shimmer pauses centred under `prefers-reduced-motion: reduce` so
 * the placeholder still reads as "loading" without any motion.
 *
 * Pairs with `<DataTable loading>` for table row placeholders and
 * stands on its own for cards, lists, headers, or any block of content
 * that hasn't loaded yet.
 *
 *   <Skeleton variant="text" width="60%" />
 *   <Skeleton variant="rect" width={120} height={120} />
 *   <Skeleton variant="circle" width={40} height={40} />
 */
export function Skeleton({ width, height, variant = 'rect', className, style }: SkeletonProps) {
  const variantCls =
    variant === 'circle' ? 'rounded-full'    :
    variant === 'text'   ? 'rounded-sm h-3'  :
                           'rounded-sm';
  return (
    <span
      aria-hidden
      data-component="Skeleton"
      data-variant={variant}
      className={cn(
        'block skeleton-shimmer',
        variantCls,
        className,
      )}
      style={{ width, height, ...style }}
    />
  );  
}

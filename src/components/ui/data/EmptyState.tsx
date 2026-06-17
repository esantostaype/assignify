'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/lib/icons';
import type { IconComponent } from '@/lib/icons';
import { Typography } from '@/components/ui/typography';

/** Layout direction for the icon vs. the text cluster:
 *    `vertical`   — icon on top, title + description below it,
 *                   everything centered.  Use it when the empty state
 *                   sits in a large open canvas (full-page emptiness).
 *    `horizontal` — icon on the left, title + description on the
 *                   right.  Use it when the empty state is wedged
 *                   inside a tight row (a card body, a sidebar slot)
 *                   where vertical space is at a premium. */
export type EmptyStateOrientation = 'vertical' | 'horizontal';

export interface EmptyStateProps {
  icon?: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Layout direction.  Default `vertical`. */
  orientation?: EmptyStateOrientation;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  orientation = 'vertical',
  className,
}: EmptyStateProps) {
  const isHorizontal = orientation === 'horizontal';
  // Horizontal alignment rule:
  //   • Content TALLER than the icon (description present, or an
  //     action below the title) → anchor icon to the TOP so it lines
  //     up with the first line of copy instead of floating in the
  //     middle of a tall paragraph.
  //   • Content SHORTER than the icon (title-only) → center the icon
  //     vertically against the single line so the block reads as
  //     balanced.  The 48 px circle would otherwise overhang.
  const horizontalTopAlign = !!description || !!action;

  return (
    <div
      data-component="EmptyState"
      data-orientation={orientation}
      className={cn(
        // Vertical → stacked + centered, generous padding (the empty
        // canvas pattern).  Horizontal → side-by-side + left-aligned,
        // tighter padding so the block reads as a compact inline note.
        isHorizontal
          ? cn(
              'flex flex-row gap-4 px-4 py-4 text-left',
              horizontalTopAlign ? 'items-start' : 'items-center',
            )
          : 'flex flex-col items-center justify-center text-center px-6 py-12',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            // 48 px tonal circle.  Vertical adds bottom margin to
            // separate from the title beneath; horizontal drops that
            // margin since the text sits beside it.
            'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700',
            !isHorizontal && 'mb-3',
          )}
        >
          <Icon icon={icon} size={24} />
        </div>
      )}

      {/* Text cluster — wrapping both `title` and `description` in a
          single block lets the horizontal variant flow them as a
          column to the right of the icon, while the vertical variant
          stacks them centered under it. */}
      <div className={cn('min-w-0', isHorizontal && 'flex-1')}>
        <Typography variant="h5" as="div">
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body"
            as="div"
            className={cn('mt-1', !isHorizontal && 'mx-auto max-w-md')}
          >
            {description}
          </Typography>
        )}
        {action && (
          <div className={cn('mt-4', isHorizontal && 'mt-3')}>{action}</div>
        )}
      </div>
    </div>
  );
}

'use client';

import {
  Children, cloneElement, isValidElement,
  type HTMLAttributes, type ReactElement, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCheckCircleFill, PiArrowRight, type IconComponent } from '@/lib/icons';

export type ListVariant = 'ordered' | 'bullet' | 'check';

export interface ListProps extends HTMLAttributes<HTMLElement> {
  /** `ordered` → `<ol>` with decimal markers; `bullet` → `<ul>` with
   *  disc markers; `check` → markerless `<ul>` with a leading
   *  check icon on every item.  Markers are muted; ordered markers
   *  are semibold. */
  variant?: ListVariant;
  /** Sub-lists nested under a parent `<li>` — adds top margin and
   *  tightens row spacing so the child list reads as belonging to the
   *  item above it. */
  nested?: boolean;
  /** `check` variant only — the leading icon rendered before each item.
   *  Default `PiCheckCircleFill` (filled circle); pass `PiCheck` for the
   *  lighter sub-item style. */
  icon?: IconComponent;
  /** `check` variant only — flow the items into a responsive grid of
   *  N columns (row-major).  `2` stacks to a single column below the
   *  `sm` breakpoint.  Default `1` (single column).  Ignored when
   *  `horizontal`. */
  columns?: 1 | 2;
  /** `check` variant only — lay the items out INLINE on one wrapping
   *  row with a right-arrow between each (process / step flows like
   *  "Intake → Marketing → … → Close").  Default `false`. */
  horizontal?: boolean;
  children: ReactNode;
}

const MARKER: Record<'ordered' | 'bullet', string> = {
  ordered: 'list-decimal marker:font-semibold marker:text-(--color-text-muted)',
  bullet:  'list-disc marker:text-(--color-text-muted)',
};

/**
 * Ordered / unordered / check list with the standard intranet text +
 * marker treatment baked in, so call sites don't re-declare the
 * `list-decimal pl-5 space-y-… marker:…` chain every time.
 *
 *   • `ordered` / `bullet` — classic marker lists.  Items are plain
 *     `<li>` children; sub-lists pass `nested` to tighten spacing.
 *   • `check` — markerless list where every item gets a leading check
 *     icon.  Authored with plain `<li>` children — the icon is injected
 *     automatically.  `columns={2}` flows into a two-column grid;
 *     `horizontal` lays the items inline with right-arrows between them;
 *     `icon` swaps the marker (filled circle ↔ plain check).
 */
export function List({
  variant = 'ordered',
  nested = false,
  icon = PiCheckCircleFill,
  columns = 1,
  horizontal = false,
  className,
  children,
  ...rest
}: ListProps) {
  if (variant === 'check') {
    const lis = Children.toArray(children).filter(isValidElement) as ReactElement<HTMLAttributes<HTMLLIElement>>[];

    // Inline / horizontal flow — items on one wrapping row, a right-arrow
    // trailing every item except the last.
    if (horizontal) {
      return (
        <ul
          data-component="List"
          data-variant="check"
          data-orientation="horizontal"
          className={cn(
            'list-none p-0 m-0 flex flex-wrap items-center gap-x-1.5 gap-y-2',
            'text-sm leading-relaxed text-(--color-text-default)',
            className,
          )}
          {...rest}
        >
          {lis.map((li, i) =>
            cloneElement(
              li,
              { key: i, className: cn('flex items-center gap-2', li.props.className) },
              <>
                <Icon icon={icon} size={18} className="shrink-0 text-primary-400" />
                <span className="whitespace-nowrap font-medium">{li.props.children}</span>
                {i < lis.length - 1 && (
                  <Icon icon={PiArrowRight} size={14} className="shrink-0 text-(--color-text-subtle) ml-1" />
                )}
              </>,
            ),
          )}
        </ul>
      );
    }

    return (
      <ul
        data-component="List"
        data-variant="check"
        data-columns={columns}
        className={cn(
          'list-none p-0 text-sm leading-relaxed text-(--color-text-default)',
          columns === 2
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3'
            : 'space-y-3',
          nested && 'mt-2',
          className,
        )}
        {...rest}
      >
        {lis.map((li, i) =>
          cloneElement(
            li,
            { key: i, className: cn('flex items-start gap-2.5', li.props.className) },
            <>
              <Icon icon={icon} size={18} className="shrink-0 mt-0.5 text-primary-400" />
              {/* `div` (not `span`) so a nested `<List>` — e.g. a checklist
                  parent's children — is valid block content here. */}
              <div className="flex-1 min-w-0">{li.props.children}</div>
            </>,
          ),
        )}
      </ul>
    );
  }

  const Tag = variant === 'ordered' ? 'ol' : 'ul';
  return (
    <Tag
      data-component="List"
      data-variant={variant}
      className={cn(
        'space-y-2 pl-5 text-sm leading-relaxed text-(--color-text-default)',
        MARKER[variant],
        nested && 'mt-2 ',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

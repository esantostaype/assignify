'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiCaretRight } from '@/lib/icons';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  /** Render as the current page (no link styling). */
  current?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

export function Breadcrumb({
  items,
  separator = <Icon icon={PiCaretRight} size={12} className="text-(--color-text-subtle)" />,
  className,
}: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" data-component="Breadcrumb" className={cn('flex items-center gap-1.5 text-[12.5px]', className)}>
      {items.map((it, idx) => {
        const last = idx === items.length - 1;
        return (
          <Fragment key={idx}>
            {it.href && !it.current ? (
              <a href={it.href} className="text-(--color-text-muted) hover:text-primary-700 transition-colors no-underline">
                {it.label}
              </a>
            ) : (
              <span className={cn(last || it.current ? 'font-semibold text-(--color-text-strong)' : 'text-(--color-text-muted)')}>
                {it.label}
              </span>
            )}
            {!last && <span className="inline-flex">{separator}</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}

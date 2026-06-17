'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiInfo, PiCheckCircle, PiWarning, PiWarningCircle, PiX } from '@/lib/icons';
import type { IconComponent } from '@/lib/icons';

export type AlertTone = 'info' | 'success' | 'warning' | 'error';
export type AlertVariant = 'soft' | 'outlined';
/** How the icon + content stack align on the cross axis:
 *    `start`  (default) — icon nudges down by `mt-0.5` so it pairs
 *                         with the first line of a multi-line body
 *                         (the original pattern; right for any
 *                         Alert with a title + paragraph stack).
 *    `center`           — icon and content are vertically centered.
 *                         Right for single-row "header + control"
 *                         strips where the body is one line and the
 *                         icon should read as a leading marker for
 *                         the whole row instead of just its top. */
export type AlertAlign = 'start' | 'center';

export interface AlertProps {
  tone?: AlertTone;
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconComponent | null;
  /** Pixel size of the leading icon.  Default `18` — matches the
   *  surrounding `text-sm` body.  Bump (e.g. `22`–`24`) on Alerts
   *  that need the leading glyph to read as a stronger visual
   *  anchor for a single-row strip. */
  iconSize?: number;
  /** Cross-axis alignment of the icon vs. the content block.  See
   *  `AlertAlign` for the trade-off — defaults to `start` to keep
   *  the existing visual contract for multi-line bodies. */
  align?: AlertAlign;
  onClose?: () => void;
  className?: string;
}

const DEFAULT_ICON: Record<AlertTone, IconComponent> = {
  info:    PiInfo,
  success: PiCheckCircle,
  warning: PiWarning,
  error:   PiWarningCircle,
};

const TONE: Record<AlertTone, Record<AlertVariant, string>> = {
  info: {
    soft:     'bg-primary-50 text-primary-800 border-primary-200',
    outlined: 'bg-(--color-surface-card) text-primary-800 border-primary-300',
  },
  success: {
    soft:     'bg-success-50 text-success-800 border-success-200',
    outlined: 'bg-(--color-surface-card) text-success-800 border-success-300',
  },
  warning: {
    soft:     'bg-warning-50 text-warning-800 border-warning-200',
    outlined: 'bg-(--color-surface-card) text-warning-800 border-warning-300',
  },
  error: {
    soft:     'bg-error-50 text-error-800 border-error-200',
    outlined: 'bg-(--color-surface-card) text-error-800 border-error-300',
  },
};

export function Alert({
  tone = 'info', variant = 'soft', title, children, icon,
  iconSize = 18,
  align = 'start',
  onClose, className,
}: AlertProps) {
  const Icn = icon === null ? null : (icon ?? DEFAULT_ICON[tone]);
  return (
    <div
      role="alert"
      data-component="Alert"
      data-tone={tone}
      data-variant={variant}
      className={cn(
        'flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm',
        align === 'center' ? 'items-center' : 'items-start',
        TONE[tone][variant],
        className,
      )}
    >
      {Icn && (
        <Icon
          icon={Icn}
          size={iconSize}
          // `mt-0.5` only when we're aligning to the start of the
          // content — it nudges the icon onto the first text line's
          // optical centerline.  In center-align mode the flex
          // container already centers the icon, so the nudge would
          // push it 2 px below center.
          className={cn('shrink-0', align === 'start' && 'mt-0.5')}
        />
      )}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold leading-tight">{title}</div>}
        {children && <div className={cn(title ? 'mt-0.5' : '', 'leading-relaxed')}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <Icon icon={PiX} size={14} />
        </button>
      )}
    </div>
  );
}

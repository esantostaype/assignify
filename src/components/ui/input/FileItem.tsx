'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiFile, PiFilePdf, PiFileXls, PiFileDoc, PiTrash } from '@/lib/icons';
import { Spinner } from '@/components/ui/feedback';
import type { IconComponent } from '@/lib/icons';

export type FileItemSize = 'sm' | 'md' | 'lg';

export interface FileItemProps {
  /** Label rendered in the middle slot.  A plain `string` (the common
   *  case) gets the standard truncated single-line treatment.  Pass a
   *  `ReactNode` when the row is being reused for a non-file context
   *  that needs richer typography (e.g. the proposal-automation-tool
   *  "Client Account Selected: <name>" recap bar uses bold + muted
   *  segments inside the same slot).  The outer wrapper still applies
   *  `truncate` + the size-appropriate font scale; consumer spans
   *  inside can override font-weight / color through their own
   *  Typography variants. */
  name: string | ReactNode;
  /** Human-readable file size — e.g. "1.2 MB".  Rendered INLINE at the
   *  right side of the row, just before the remove button.  Hidden when
   *  the row is in the uploading state (a percentage shows instead). */
  fileSize?: string;
  /** 0-100, optional.  When set < 100 the row enters the uploading
   *  state: an inline spinner replaces the trash button, the file size
   *  is swapped for a "%" readout, and a 2 px progress strip paints
   *  across the bottom edge.  Set to 100 (or leave undefined) for the
   *  "done" state. */
  progress?: number;
  /** Override the icon. Otherwise derived from the filename extension. */
  icon?: IconComponent;
  /** Tone applied to the leading icon.  File extensions auto-pick
   *  `pdf` / `xls` / `doc` / `neutral`; non-file consumers can pass
   *  `'primary'` (e.g. the proposal-automation "Client Account
   *  Selected" recap row uses `PiCheck` in the primary palette to
   *  signal a confirmed pick). */
  tone?: 'pdf' | 'xls' | 'doc' | 'neutral' | 'primary';
  /** Row height — matches Input / FileUpload simple per size (32 / 40 /
   *  48 px).  Default `md` so existing call sites keep their current
   *  look.  All paddings, font sizes and icon sizes scale together. */
  size?: FileItemSize;
  onRemove?: () => void;
  /** Override the icon shown in the trailing action button.  Defaults
   *  to `PiTrash` — pass `PiDownloadSimple` (or any other glyph) when
   *  the row sits in a read-only / download surface and the affordance
   *  is "fetch this file" rather than "remove this file".  `onRemove`
   *  stays the click handler regardless — name kept for backward
   *  compat, semantically it's now "the trailing action click". */
  actionIcon?: IconComponent;
  /** Override the trailing button's `aria-label`.  Default `"Remove
   *  {name}"`.  Swap in `"Download {name}"` whenever `actionIcon` is
   *  switched to a download glyph so the spoken label stays in sync
   *  with the visual. */
  actionAriaLabel?: string;
  /** Hover tone for the trailing action button.  `'danger'` (default)
   *  flushes red on hover — the standard "Remove" affordance.
   *  `'primary'` shifts to the primary tonal palette — pairs with
   *  `actionIcon={PiDownloadSimple}` for download surfaces so the
   *  hover doesn't shout danger for a benign action. */
  actionTone?: 'danger' | 'primary';
  className?: string;
  /** Extra content rendered AFTER the size readout and BEFORE the
   *  trash / spinner.  Use for read-only badges, status chips, etc.
   *  Doesn't change the default cluster — size + trash still render. */
  trailing?: ReactNode;
  /** Replaces the entire default right-side cluster (size readout
   *  + spinner / trash button) with the consumer's own actions.
   *  Use for view-only contexts where the row needs a Download
   *  button instead of a Remove icon, or for any other custom
   *  affordance.  When set, `fileSize`, `progress`, and `onRemove`
   *  are not rendered — the consumer owns the entire trailing
   *  slot. */
  actions?: ReactNode;
}

const ICON_BY_EXT: Record<string, { icon: IconComponent; tone: NonNullable<FileItemProps['tone']> }> = {
  pdf:  { icon: PiFilePdf,  tone: 'pdf' },
  xls:  { icon: PiFileXls,  tone: 'xls' },
  xlsx: { icon: PiFileXls,  tone: 'xls' },
  csv:  { icon: PiFileXls,  tone: 'xls' },
  doc:  { icon: PiFileDoc,  tone: 'doc' },
  docx: { icon: PiFileDoc,  tone: 'doc' },
};

const TONE_CLS: Record<NonNullable<FileItemProps['tone']>, string> = {
  pdf:     'text-error-600',
  xls:     'text-success-600',
  doc:     'text-primary-600',
  neutral: 'text-neutral-600',
  primary: 'text-primary-700',
};

/** Geometry per size — paddings + font sizes + icon sizes all scale
 *  together so the row matches the Input / FileUpload simple trigger
 *  geometry at the same size. */
const SIZE_MAP: Record<FileItemSize, {
  h: string; px: string; gap: string;
  text: string; meta: string;
  icon: number; trash: number;
}> = {
  sm: { h: 'h-8',  px: 'px-3',   gap: 'gap-2',   text: 'text-xs', meta: 'text-[11px]',   icon: 14, trash: 14 },
  md: { h: 'h-10', px: 'px-3.5', gap: 'gap-2.5', text: 'text-xs', meta: 'text-[11px]',   icon: 16, trash: 16 },
  lg: { h: 'h-12', px: 'px-4',   gap: 'gap-3',   text: 'text-sm', meta: 'text-xs',   icon: 18, trash: 18 },
};

/** Padding used when the row hosts a custom `actions` button (Download /
 *  Print …) instead of the default size + trash cluster.  Drops the fixed
 *  height in favour of an EQUAL top / bottom / right inset so the trailing
 *  button sits in a symmetric halo (pair it with a `size="xs"` button); the
 *  LEFT keeps the larger icon padding from `px`. */
const SIZE_ACTIONS_PAD: Record<FileItemSize, string> = {
  sm: 'py-1   pl-3   pr-1',
  md: 'py-1.5 pl-3.5 pr-1.5',
  lg: 'py-2   pl-4   pr-2',
};

/**
 * Compact uploaded-file row matching the FileUpload simple trigger
 * geometry.  Layout (left → right):
 *
 *   [fileIcon] name.pdf           61.44 KB  [🗑]
 *
 * During upload the trash is swapped for a spinner and a thin progress
 * strip paints across the bottom of the row.
 */
export function FileItem({
  name, fileSize, progress, icon, tone,
  size = 'md',
  onRemove,
  actionIcon,
  actionAriaLabel,
  actionTone = 'danger',
  className, trailing, actions,
}: FileItemProps) {
  // Default to the trash glyph (legacy behaviour) when the consumer
  // didn't override.  Download surfaces opt in by passing
  // `actionIcon={PiDownloadSimple}` + `actionTone='primary'`.
  const ActionIcn = actionIcon ?? PiTrash;
  const ariaLabel = actionAriaLabel ?? `Remove ${name}`;
  const actionHoverCls = actionTone === 'primary'
    ? 'hover:text-primary-700 focus-visible:ring-primary-200'
    : 'hover:text-error-600  focus-visible:ring-error-200';
  // Auto-derive the icon from the filename extension when `name`
  // is a plain string.  ReactNode labels (used by non-file
  // consumers like `<SelectedAccountBar>`) can't be parsed for a
  // file extension — they fall through to the caller's explicit
  // `icon` / `tone` overrides or the neutral fallback.
  const ext = typeof name === 'string'
    ? name.split('.').pop()?.toLowerCase() ?? ''
    : '';
  const def = ICON_BY_EXT[ext];
  const Icn = icon ?? def?.icon ?? PiFile;
  const t   = tone ?? def?.tone ?? 'neutral';
  const isUploading = typeof progress === 'number' && progress < 100;
  const sz = SIZE_MAP[size];

  return (
    <div
      data-component="FileItem"
      data-size={size}
      data-status={isUploading ? 'uploading' : 'done'}
      className={cn(
        'relative flex items-center rounded-md border border-(--color-border-default) bg-(--color-surface-card) overflow-hidden',
        // A custom `actions` button gets a symmetric inset (top = bottom =
        // right); the default cluster keeps the fixed-height + horizontal
        // padding that matches the Input / FileUpload trigger geometry.
        actions ? cn(SIZE_ACTIONS_PAD[size], sz.gap) : cn(sz.h, sz.px, sz.gap),
        className,
      )}
    >
      <Icon icon={Icn} size={sz.icon} className={cn('shrink-0', TONE_CLS[t])} />

      <span className={cn('min-w-0 flex-1 truncate font-medium text-(--color-text-strong)', sz.text)}>
        {name}
      </span>

      {/* `actions` replaces the entire right-side cluster (size +
          spinner / trash) — used by view-only surfaces that need a
          Download or Print button in that slot.  When unset, the
          default cluster renders. */}
      {actions ? (
        <div className="shrink-0 flex items-center gap-2">{actions}</div>
      ) : (
        <>
          {/* File size or progress percentage, inline at the right. */}
          {isUploading ? (
            <span className={cn('shrink-0 tabular-nums text-(--color-text-subtle)', sz.meta)}>
              {Math.round(progress)}%
            </span>
          ) : fileSize && (
            <span className={cn('shrink-0 tabular-nums text-(--color-text-subtle)', sz.meta)}>
              {fileSize}
            </span>
          )}

          {trailing}

          {/* Trailing action button (done state) or spinner (uploading).
              The default glyph is `PiTrash`; consumers swap in
              `PiDownloadSimple` via `actionIcon` for read-only surfaces.
              The spinner replaces the action button mid-upload so a
              click can't race the simulator. */}
          {isUploading ? (
            <Spinner size={sz.icon} colorClassName="text-(--color-text-subtle)" className="shrink-0" />
          ) : onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={ariaLabel}
              className={cn(
                'shrink-0 -mr-1 rounded p-1 text-(--color-text-subtle) transition-colors focus-visible:outline-none focus-visible:ring-2',
                actionHoverCls,
              )}
            >
              <Icon icon={ActionIcn} size={sz.trash} />
            </button>
          )}
        </>
      )}

      {/* Progress strip across the bottom edge while uploading. */}
      {isUploading && (
        <div className="pointer-events-none absolute left-0 bottom-0 right-0 h-[2px] bg-neutral-200">
          <div
            className="h-full bg-primary-600 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

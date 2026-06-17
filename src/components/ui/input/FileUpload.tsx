'use client';

import {
  useCallback, useRef, useState,
  type DragEvent, type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Icon, PiUploadSimple } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { FormField } from './FormField';

export type FileUploadSize    = 'sm' | 'md' | 'lg';

export interface FileUploadProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  /** Mark the field invalid — paints the (dashed) border red like any
   *  other control, WITHOUT rendering a message below.  Use this for
   *  required-on-submit validation; reach for `error` only when you
   *  want an explanatory message under the field. */
  invalid?: boolean;
  required?: boolean;
  /** Accept attribute (e.g. `.pdf,.docx`). */
  accept?: string;
  multiple?: boolean;
  /** When `true`, render the tall dashed dropzone with upload icon + CTA.
   *  When `false` (default), render a compact one-row trigger that still
   *  accepts drops.  Replaces the previous `variant` prop — `simple` is
   *  the default everywhere, and consumers opt INTO the dropzone layout
   *  on landing-style forms (proposal uploader, attachments page). */
  dropzone?: boolean;
  /** Matches Input/Select heights for the simple layout — sm 32, md 40, lg 48. */
  size?: FileUploadSize;
  /** Helper text inside the dropzone (default: "Upload only PDF Files"). */
  hint?: ReactNode;
  /** Muted sub-line under the title (dropzone variant only) — e.g.
   *  "Accepted formats: PDF, DOC, DOCX · Max size: 10MB". */
  description?: ReactNode;
  /** CTA label of the button inside the zone (dropzone variant only). */
  cta?: string;
  /** Dropzone variant only — when set, render this image as a PREVIEW in
   *  the drop area (in place of the upload icon + hint).  Used for avatar /
   *  headshot pickers so the current photo shows inline above the CTA. */
  previewSrc?: string;
  /** Alt text for the preview image (defaults to "Selected image"). */
  previewAlt?: string;
  /** Callback when files are added (drop or picker). */
  onFiles?: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
}

// Same geometry as Input/Select so a simple FileUpload can sit next to them
// in a form grid without breaking the row.
const SIMPLE_SIZE: Record<FileUploadSize, { wrap: string; text: string; icon: number }> = {
  sm: { wrap: 'h-8  px-3   text-xs', text: 'text-xs', icon: 14 },
  md: { wrap: 'h-10 px-3.5 text-sm', text: 'text-sm', icon: 16 },
  lg: { wrap: 'h-12 px-4   text-sm', text: 'text-sm', icon: 18 },
};

/** Background shades.  `rest` is the idle state — always white
 *  (`surface-card`) now that the tinted `default` shade is gone (it
 *  read as disabled; see `Input.tsx`).  `active` (dragging) stays the
 *  primary-50 "drop target" tint.  Tokens chosen so both have proper
 *  dark-mode counterparts. */
const SURFACE_REST   = 'bg-(--color-surface-card)';
const SURFACE_ACTIVE = 'bg-primary-50';

/**
 * Dropzone matching Form.pdf dashed border, upload icon, helper text,
 * and a "Choose File" soft button. Supports drag-and-drop and click-to-pick.
 */
export function FileUpload({
  label, helper, error, invalid, required,
  accept, multiple,
  dropzone = false,
  size = 'md',
  hint,
  description,
  cta = 'Choose File',
  previewSrc,
  previewAlt = 'Selected image',
  onFiles, disabled, className,
}: FileUploadProps) {
  const resolvedHint = hint ?? (dropzone ? 'Upload only PDF Files' : 'Upload a File or drag & drop it here');
  // Error border when invalid OR an error message is set — matches the
  // Input/Select contract.  `invalid` paints the border only (no message);
  // `error` paints the border AND shows the message via FormField.
  const isError = invalid || !!error;
  const sz = SIMPLE_SIZE[size];
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) onFiles?.(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) onFiles?.(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const dropzoneEl = (
    <div
      role="button"
      data-component="FileUpload"
      data-variant="dropzone"
      data-size={size}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-7 transition-colors outline-none',
        // Single resolved bg — same `bgCls` priority pattern as Input.
        // Disabled overrides everything; dragging takes the primary
        // tint; resting stays white.
        disabled ? 'bg-(--color-surface-subtle)'
        : dragging ? SURFACE_ACTIVE
        : SURFACE_REST,
        isError
          ? 'border-error-500'
          : dragging
            ? 'border-primary-600'
            : 'border-(--color-border-strong) hover:border-primary-400',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-200',
        className,
      )}
    >
      {/* Preview image (avatar / headshot picker) takes the icon + hint's
          place when `previewSrc` is set; otherwise the standard upload
          icon + hint render. */}
      {previewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt={previewAlt}
          className="h-20 w-20 rounded-md border border-(--color-border-default) object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <Icon icon={PiUploadSimple} size={26} className="text-(--color-text-muted) mb-2" />
          <p className="m-0 text-sm font-semibold text-(--color-text-default)">{resolvedHint}</p>
          {description && (
            <p className="m-0 text-xs text-(--color-text-muted)">{description}</p>
          )}
        </div>
      )}
      <Button
        type="button"
        variant="soft"
        color="primary"
        size="md"
        onClick={(e) => { e.stopPropagation(); open(); }}
        disabled={disabled}
      >
        {cta}
      </Button>
      {hiddenInput}
    </div>
  );

  const simpleEl = (
    <div
      role="button"
      data-component="FileUpload"
      data-variant="simple"
      data-size={size}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex items-center gap-2 rounded-md border transition-colors outline-none w-full',
        sz.wrap,
        // Single resolved bg — same `bgCls` priority pattern as Input
        // so `cn`'s plain concatenation never lands two `bg-*` classes
        // in the same string.
        disabled ? 'bg-(--color-surface-subtle)'
        : dragging ? SURFACE_ACTIVE
        : SURFACE_REST,
        isError
          ? 'border-error-500'
          : dragging
            ? 'border-primary-600'
            : 'border-(--color-border-strong) hover:border-(--color-text-subtle)',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-200',
        className,
      )}
    >
      {/* More discrete than the dropzone variant — both the icon and the
          helper text drop to `text-muted` (one notch lighter than the
          `text-subtle` used on inputs) so the trigger reads as a hint
          rather than a primary control.  Geometry stays in lockstep
          with Input/Select so the row aligns in form grids. */}
      <Icon icon={PiUploadSimple} size={sz.icon} className="text-(--color-text-muted) shrink-0" />
      <span className={cn('flex-1 truncate text-(--color-text-muted)', sz.text)}>{resolvedHint}</span>
      {hiddenInput}
    </div>
  );

  const zone = dropzone ? dropzoneEl : simpleEl;

  if (label || helper || error) {
    return (
      <FormField label={label} helper={helper} error={error} required={required}>
        {zone}
      </FormField>
    );
  }
  return zone;
}

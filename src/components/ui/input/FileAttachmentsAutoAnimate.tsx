'use client';

import {
  useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { FileUpload, type FileUploadSize } from './FileUpload';
import { FileItem } from './FileItem';
import { PiDownloadSimple } from '@/lib/icons';
import {
  formatBytes,
  type FileAttachmentEntry,
  type FileAttachmentsMode,
} from './FileAttachments';

/* ─── Public types ─────────────────────────────────────────────────────── */

export interface FileAttachmentsAutoAnimateProps {
  label?:    ReactNode;
  files:     FileAttachmentEntry[];
  onChange?: (next: FileAttachmentEntry[]) => void;
  multiple?: boolean;
  accept?:   string;
  size?:     FileUploadSize;
  hint?:     ReactNode;
  simulateProgress?: boolean;
  mode?: FileAttachmentsMode;
  onDownload?: (file: FileAttachmentEntry) => void;
  uploadDropzone?: boolean;
  showFileSize?: boolean;
  layout?: 'stack' | 'grid';
}

/* ─── Internals ─────────────────────────────────────────────────────────── */

interface UploadingEntry extends FileAttachmentEntry {
  progress?: number;
}

const SIMULATE_TICK_MS    = 220;
const SIMULATE_TICK_DELTA = 20;

/* ─── Component ─────────────────────────────────────────────────────────── */

/**
 * Experimental rewrite of `<FileAttachments>` that drops the
 * `<Collapse>` per-row wrapper + the `pendingRemoves` two-step
 * unmount in favour of `@formkit/auto-animate`.  Same external API —
 * drops into the same call sites with no prop changes.
 *
 * What changes internally:
 *   • Each file row is now a bare `<FileItem>`.  No `AnimatedRow`,
 *     no `<Collapse>` wrapper.
 *   • The rows container gets a `useAutoAnimate` ref — AutoAnimate
 *     attaches a MutationObserver to that node and animates child
 *     insertions, removals, and re-orders automatically (FLIP-style
 *     transitions for moves, opacity + height for enter / exit).
 *   • `removeFile` / `cancelUpload` collapse from "mark removing,
 *     wait ~280 ms, then unmount" to "remove from state, AutoAnimate
 *     plays the exit".  No setTimeout machinery, no `pendingRemoves`
 *     state.
 *
 * The committed `files` / `uploading` rows render through a single
 * `.map()` keyed by id (same as the production component), so the
 * upload → commit transition preserves the row's identity and
 * AutoAnimate sees it as a prop change rather than an unmount /
 * remount.
 *
 * Bundle cost: ~3 kB minified+gzip for `@formkit/auto-animate`.  In
 * return we drop ~80 lines of Collapse + AnimatedRow + pendingRemoves
 * machinery from this file.
 */
export function FileAttachmentsAutoAnimate({
  label,
  files,
  onChange,
  multiple = false,
  accept = '.pdf,.jpg,.jpeg,.png',
  size = 'md',
  hint,
  simulateProgress = true,
  mode = 'edit',
  onDownload,
  uploadDropzone = false,
  showFileSize = true,
  layout = 'stack',
}: FileAttachmentsAutoAnimateProps) {
  const isGridLayout = layout === 'grid';
  const rowsContainerCls = isGridLayout
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 auto-rows-min'
    : 'flex flex-col gap-2';
  const isDownload = mode === 'download';
  const handleChange = onChange ?? (() => {});

  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const timersRef = useRef<number[]>([]);

  /** AutoAnimate ref — attaches a MutationObserver to the container so
   *  child additions / removals / re-orders animate automatically.
   *  No per-row wrapper required.  The animation defaults (~250 ms
   *  cubic-bezier ease-in-out for enter/exit, 250 ms for moves) are
   *  close enough to the rest of the app's motion vocabulary that we
   *  leave them unconfigured. */
  const [rowsRef] = useAutoAnimate<HTMLDivElement>();

  // Closure-safety: always read the LATEST committed list when
  // committing back-to-back uploads.
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearInterval(t));
    timersRef.current = [];
  }, []);

  const commit = (entry: FileAttachmentEntry) => {
    const next = multiple ? [...filesRef.current, entry] : [entry];
    filesRef.current = next;
    handleChange(next);
  };

  const handleFiles = (incoming: FileList) => {
    Array.from(incoming).forEach((f) => {
      const entry: UploadingEntry = {
        id:   `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: formatBytes(f.size),
        progress: simulateProgress ? 0 : undefined,
      };

      if (!multiple) {
        timersRef.current.forEach((t) => clearInterval(t));
        timersRef.current = [];
        setUploading([entry]);
      } else {
        setUploading((prev) => [...prev, entry]);
      }

      if (!simulateProgress) {
        const finalEntry: FileAttachmentEntry = { id: entry.id, name: entry.name, size: entry.size };
        commit(finalEntry);
        setUploading((prev) => prev.filter((u) => u.id !== entry.id));
        return;
      }

      let p = 0;
      const intervalId = window.setInterval(() => {
        p += SIMULATE_TICK_DELTA;
        if (p >= 100) {
          clearInterval(intervalId);
          timersRef.current = timersRef.current.filter((t) => t !== intervalId);
          commit({ id: entry.id, name: entry.name, size: entry.size });
          setUploading((prev) => prev.filter((u) => u.id !== entry.id));
        } else {
          setUploading((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, progress: p } : u)),
          );
        }
      }, SIMULATE_TICK_MS);
      timersRef.current.push(intervalId);
    });
  };

  /** Drop the file directly — AutoAnimate plays the exit transition
   *  on the row's removal from the DOM.  No two-step `pendingRemoves`
   *  / setTimeout / wait-for-collapse-to-finish machinery needed:
   *  AutoAnimate hooks into the MutationObserver's `removedNodes`
   *  and animates the OUTGOING element before letting React's
   *  reconciler tear it down. */
  const removeFile = (id: string) => {
    handleChange(filesRef.current.filter((f) => f.id !== id));
  };

  const cancelUpload = (id: string) => {
    setUploading((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div
      data-component="FileAttachmentsAutoAnimate"
      data-size={size}
      data-mode={mode}
      className="flex flex-col gap-2"
    >
      {!isDownload && (
        <FileUpload
          label={label}
          dropzone={uploadDropzone}
          size={size}
          accept={accept}
          multiple={multiple}
          hint={hint}
          onFiles={handleFiles}
        />
      )}

      {/* Rows container — `rowsRef` is the AutoAnimate hook target.
          Every child added to / removed from this node gets the
          built-in fade + height animation; re-orders use FLIP.  No
          per-row wrapper required.  Unified loop (committed first,
          then uploading) keyed by id so AutoAnimate sees an entry's
          upload → commit transition as a prop change on a stable
          node rather than an unmount + remount. */}
      <div ref={rowsRef} className={rowsContainerCls}>
        {[
          ...files     .map((f) => ({ entry: f, isUploading: false as const })),
          ...uploading .map((u) => ({ entry: u, isUploading: true  as const })),
        ].map(({ entry, isUploading }) => (
          <FileItem
            key={entry.id}
            name={entry.name}
            fileSize={showFileSize ? entry.size : undefined}
            progress={isUploading ? (entry as UploadingEntry).progress : undefined}
            size={size}
            onRemove={() => {
              if (isUploading)   return cancelUpload(entry.id);
              if (isDownload)    return onDownload?.(entry);
              return removeFile(entry.id);
            }}
            actionIcon={isDownload && !isUploading ? PiDownloadSimple : undefined}
            actionTone={isDownload && !isUploading ? 'primary' : 'danger'}
            actionAriaLabel={
              isDownload && !isUploading
                ? `Download ${entry.name}`
                : `Remove ${entry.name}`
            }
          />
        ))}
      </div>
    </div>
  );
}

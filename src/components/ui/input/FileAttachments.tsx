'use client';

import {
  useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { FileUpload, type FileUploadSize } from './FileUpload';
import { FileItem } from './FileItem';
import { Collapse } from '@/components/ui/surfaces';
import { PiDownloadSimple } from '@/lib/icons';

/* ─── Internal: per-row animated wrapper ───────────────────────────────── */

/** Tracks the default `<Collapse>` duration plus a one-frame safety
 *  margin.  The CSS transition inside Collapse doesn't start until
 *  the layout effect's render commits and the next paint runs
 *  (~16 ms after the click), so a setTimeout at exactly the
 *  Collapse duration fires BEFORE the visual transition finishes —
 *  the row unmounts while it's still a few px tall, which reads as
 *  a tiny abrupt jump on the last frame.  The extra ~32 ms (two
 *  frames at 60 Hz) gives the transition headroom to fully settle
 *  to h=0 before the row leaves the DOM. */
const COLLAPSE_DURATION       = 260;
const REMOVAL_SETTLE_DELAY_MS = COLLAPSE_DURATION + 32;

/**
 * Wraps each `<FileItem>` in a `<Collapse>` that:
 *
 *   • Opens on the FIRST animation frame after mount — without this,
 *     passing `open={true}` from render time means the row appears
 *     at full height with no transition (picking a new file feels
 *     like a snap rather than a slide).
 *   • Closes when the parent flips `removing` to `true`.  The
 *     parent is expected to wait `COLLAPSE_DURATION` ms before
 *     actually unmounting the row from its source list — otherwise
 *     the row would disappear mid-animation.
 */
function AnimatedRow({
  children,
  removing = false,
}: {
  children: ReactNode;
  removing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (removing) setOpen(false);
  }, [removing]);
  return <Collapse open={open}>{children}</Collapse>;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface FileAttachmentEntry {
  /** Stable id for the row.  Generated when the file is added. */
  id:   string;
  /** Display name (`Individual License - File.pdf`, etc.). */
  name: string;
  /** Human-readable size — `1.2 MB` / `—` if the source only kept the
   *  filename and not the byte count. */
  size: string;
}

export type FileAttachmentsMode = 'edit' | 'download';

export interface FileAttachmentsProps {
  label?:    ReactNode;
  /** Current committed files.  Pass `[]` for empty.  Single-slot mode
   *  (`multiple={false}`) ignores everything past the first entry. */
  files:     FileAttachmentEntry[];
  /** Persists committed files.  Required in `edit` mode (the upload
   *  + remove flow needs to write back to the parent); ignored in
   *  `download` mode where the file list is read-only. */
  onChange?: (next: FileAttachmentEntry[]) => void;
  /** When false (default), picking a new file REPLACES the existing one
   *  — same shape as the Quotes COI Maxum / COI 2 slots.  When true,
   *  picking ADDS to the list — used by the Questionnaires Attachment
   *  question type and any multi-doc inbox. */
  multiple?: boolean;
  /** Forwarded to the underlying `<input type="file">` accept attribute.
   *  Default `.pdf,.jpg,.jpeg,.png` — matches the COI pattern.  Override
   *  per consumer (Excel for templates, etc.). */
  accept?:   string;
  /** Visual size of the dropzone + file rows. */
  size?:     FileUploadSize;
  /** Helper copy inside the dropzone — overrides `FileUpload`'s default. */
  hint?:     ReactNode;
  /** Disable the simulated upload progress (just commit picked files
   *  immediately).  Default `true` — keeps the prototype's "ticking
   *  progress" feel.  Set false in unit tests / stories where the
   *  deterministic state matters. */
  simulateProgress?: boolean;
  /** Mode of operation:
   *    `edit` (default) — full upload-and-manage flow.  Renders the
   *                       FileUpload dropzone + each row gets a trash
   *                       icon wired to `onChange`.
   *    `download`       — read-only file list.  The dropzone is
   *                       hidden, each row swaps its trash icon for
   *                       a download glyph that calls `onDownload`.
   *                       Use on surfaces that surface server-
   *                       generated artefacts (proposal PDFs, exported
   *                       reports) where the producer should be able
   *                       to fetch but not modify the list. */
  mode?: FileAttachmentsMode;
  /** Required when `mode='download'`.  Fires with the row that the
   *  producer clicked the download icon on.  No-op in `edit` mode. */
  onDownload?: (file: FileAttachmentEntry) => void;
  /** When `true`, the underlying upload trigger renders as the tall
   *  dashed dropzone with upload icon + CTA — use on dedicated upload
   *  sections where the file picker is the page's centerpiece (proposal
   *  builder, attachments page).  Default `false` (compact one-row
   *  pill that matches Input / Select heights and slots into form
   *  grids — the Quotes → Location COI pattern). */
  uploadDropzone?: boolean;
  /** Show the per-row size readout (`"61.44 KB"`).  Default `true` —
   *  matches the COI / questionnaire patterns.  Set `false` on
   *  surfaces where the byte count is noise (proposal cover sheets,
   *  branded asset uploaders, anywhere the producer cares about the
   *  filename and nothing else). */
  showFileSize?: boolean;
  /** How the file rows lay out under the dropzone:
   *    `stack` (default) — vertical list, one row per line.  The
   *                        standard COI / questionnaire pattern.
   *    `grid`            — responsive 1 → 2 → 3 → 4 column grid.
   *                        Use when the panel surfaces many small
   *                        artefacts that fit comfortably side-by-side
   *                        (proposal quote attachments, asset
   *                        bundles).  Breakpoints follow the
   *                        intranet's sm / lg / xl tokens.  The
   *                        dropzone stays full-width above the grid
   *                        in edit mode. */
  layout?: 'stack' | 'grid';
  /** When `true`, the dropzone and per-row remove affordances are
   *  inert (no clicks, no drag-and-drop, faded chrome).  Use to
   *  gate file uploads behind another control — e.g. a "submit this
   *  doc?" checkbox above the dropzone, where the dropzone should
   *  only accept files once the producer has ticked the box. */
  disabled?: boolean;
}

/* ─── Internals ─────────────────────────────────────────────────────────── */

interface UploadingEntry extends FileAttachmentEntry {
  /** 0-100 during the simulator's tick loop; cleared when committed. */
  progress?: number;
}

const SIMULATE_TICK_MS    = 220;
const SIMULATE_TICK_DELTA = 20;

/** Bytes → `X.X KB / MB`.  Shared helper used by both this component and
 *  any external code seeding an entry from a real `File`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

/**
 * Drop-in file picker with one animated `FileItem` per uploaded file.
 * Wraps the existing `FileUpload` (dropzone) + `FileItem` (row) into
 * the exact pattern Quotes → Location uses for COI uploads — extracted
 * here so every page that needs an "upload + show + delete" loop
 * shares the same UX, animations and progress simulation.
 *
 * Responsibilities the bare `FileUpload` doesn't handle:
 *   • Renders one `FileItem` per committed file with its delete affordance.
 *   • Simulates upload progress on a fixed tick (`220 ms / +20%`).  Picking
 *     a file ticks the progress strip to 100 then commits the row to the
 *     consumer's `files` array.
 *   • Single-slot mode (`multiple={false}`) where picking a new file
 *     replaces the existing one instead of appending — the COI pattern.
 *
 * State boundary:
 *   • Parent owns the COMMITTED `files` list (persisted in the surrounding
 *     record — `location.coiMaxum`, `question.attachmentFiles`, etc.).
 *   • Component owns the TRANSIENT "uploading" list (rows still ticking
 *     toward 100 that haven't settled yet).  Means: re-renders never
 *     drop in-flight progress, and consumers can persist the committed
 *     list without worrying about progress state.
 *
 * Closure-safety: the simulator's `setInterval` reads the latest
 * committed `files` through a ref, not the closure — uploading two
 * files back-to-back commits them both, instead of the second commit
 * overwriting the first.
 */
export function FileAttachments({
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
  disabled = false,
}: FileAttachmentsProps) {
  const isGridLayout = layout === 'grid';
  // Responsive grid classes — match the breakpoints used elsewhere
  // in the intranet (sm 640 / lg 1024 / xl 1280).  `auto-rows-min`
  // keeps each cell's height tied to its own content so a closed
  // Collapse mid-grid doesn't stretch its row.
  //
  // Stack mode uses FLEX + `gap` (not `space-y-*`) on purpose.
  // Tailwind v4's `space-y-N` puts `margin-block-end` on each
  // structural `:not(:last-child)` child — so when the LAST row of
  // a multi-row set is unmounted on delete, the second-to-last row
  // suddenly becomes `:last-child`, Tailwind drops its
  // `margin-block-end: 8 → 0`, and every sibling below the
  // container (the "Generate Proposal" button, the next form
  // section, etc.) snaps upward 8 px on the very last frame.
  // `flex flex-col gap-2` keeps the gap on the CONTAINER, so the
  // gap distribution doesn't depend on which row is currently
  // last.  The Collapse's container-kind margin compensation then
  // animates `0 → -8` on the closing row in sync with the height
  // collapse, leaving the next sibling stable through the entire
  // close → unmount sequence.
  const rowsContainerCls = isGridLayout
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 auto-rows-min'
    : 'flex flex-col gap-2';
  const isDownload = mode === 'download';
  // `edit` mode owns the consumer-side `files` state; safety-net so a
  // download surface that forgets to pass `onChange` doesn't blow up
  // when the internal commit code path tries to fire it.
  const handleChange = onChange ?? (() => {});
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  /** Ids that are currently animating OUT — held here until the
   *  Collapse close finishes, then dropped from the underlying
   *  array.  Lets the row slide away instead of vanishing in one
   *  frame. */
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<number[]>([]);

  // Always read the LATEST committed list — committing two uploads
  // back-to-back can't lose the first one to a stale closure.
  const filesRef = useRef(files);
  filesRef.current = files;

  // Drop pending timers on unmount so a late tick can't write into
  // a stale state.
  useEffect(() => () => {
    timersRef.current.forEach((t) => clearInterval(t));
    timersRef.current = [];
  }, []);

  const commit = (entry: FileAttachmentEntry) => {
    // Build the next list from the LATEST ref value, then UPDATE the
    // ref synchronously before firing `handleChange`.  Without the
    // sync ref update, a burst of uploads that all finish in the
    // same JS task (a producer dropping 3 PDFs at once: their
    // intervals share a period so the 100 %-tick callbacks run
    // back-to-back) would each read the same pre-burst ref value
    // and each `handleChange` call would overwrite the previous —
    // the parent's `files` state ends up holding only the LAST
    // committed entry instead of every uploaded file.  Updating the
    // ref here lets the next commit in the burst see the entry we
    // just appended even though the parent hasn't re-rendered yet.
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

      // Single-slot mode replaces both in-flight and committed rows.
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

  /** Mark the row as removing (kicks the Collapse close), then drop
   *  it from the consumer's list once the slide-out has had time
   *  to play. */
  const removeFile = (id: string) => {
    setPendingRemoves((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      handleChange(filesRef.current.filter((f) => f.id !== id));
      setPendingRemoves((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, REMOVAL_SETTLE_DELAY_MS);
  };

  // Cancelling an in-flight upload follows the same two-step
  // pattern as `removeFile` — slide out first, then drop from
  // `uploading` once the animation has finished.  The upload
  // simulator's `setInterval` keeps ticking in the background but
  // its setUploading callback no-ops because the entry is gone,
  // and it self-cleans at 100.
  const cancelUpload = (id: string) => {
    setPendingRemoves((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setUploading((prev) => prev.filter((u) => u.id !== id));
      setPendingRemoves((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, REMOVAL_SETTLE_DELAY_MS);
  };

  return (
    <div
      data-component="FileAttachments"
      data-size={size}
      data-mode={mode}
      // `flex flex-col gap-2` instead of `space-y-2` for the same
      // reason as the rows container below: Tailwind v4's
      // `:where(& > :not(:last-child))` selector would put a
      // `margin-block-end: 8` on the FileUpload while the
      // rows-container is the structural last child — fine on its
      // own, but it's an extra signal that's pointlessly load-
      // bearing on structural position.  Flex `gap` keeps the
      // dropzone-to-rows spacing on the container, completely
      // decoupled from `:last-child` semantics, so any future
      // children reshuffle or conditional render of the rows
      // container can't accidentally snap the layout below.
      className="flex flex-col gap-2"
    >
      {/* Dropzone — hidden in `download` mode because the producer
          can't add files to a read-only artefact list.  In `edit`
          mode it stays above the row stack as today.  `dropzone`
          forwards from `uploadDropzone` so callers can opt INTO the
          tall dashed layout; default is the compact one-row trigger. */}
      {!isDownload && (
        <FileUpload
          label={label}
          dropzone={uploadDropzone}
          size={size}
          accept={accept}
          multiple={multiple}
          hint={hint}
          onFiles={handleFiles}
          disabled={disabled}
        />
      )}
      {/* Rows container — switches between vertical stack and
          responsive grid via `layout`.  Committed + uploading rows
          render through a SINGLE `.map()` keyed by id so that the
          AnimatedRow component INSTANCE is preserved across the
          upload → commit transition.  Without the unified loop, the
          entry would unmount from the uploading-group and remount
          in the files-group with `key={id}` matched against
          different positional siblings — React tears down the
          original wrapper and mounts a fresh one that starts at
          `open=false` and re-runs its entry animation, so the row
          appears to vanish and re-appear with a slide-in at the
          exact moment the simulator hits 100 %. */}
      <div className={rowsContainerCls}>
        {[
          ...files     .map((f) => ({ entry: f, isUploading: false as const })),
          ...uploading .map((u) => ({ entry: u, isUploading: true  as const })),
        ].map(({ entry, isUploading }) => (
          <AnimatedRow key={entry.id} removing={pendingRemoves.has(entry.id)}>
            <FileItem
              name={entry.name}
              // Omit `fileSize` entirely when `showFileSize` is off —
              // FileItem hides the readout when the prop is undefined,
              // so the row collapses to `[icon] name [action]`.  When
              // mid-upload, FileItem still swaps to the `%` progress
              // indicator because `progress` is set.
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
          </AnimatedRow>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, PiX } from '@/lib/icons';
import { IconButton } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type ModalPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type ModalDensity = 'default' | 'compact';
export type ModalCloseVariant = 'soft' | 'ghost';
export type ModalCloseSize = 'sm' | 'md';
export type ModalCloseOffset = 'default' | 'corner';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Custom header content — overrides the default title/description layout. */
  header?: ReactNode;
  size?: ModalSize;
  position?: ModalPosition;
  /** `default` → 24/32/40 px paddings (mobile/tablet/desktop),
   *  `compact` → 16/20/24 px (used by AlertDialog).  The smaller mobile
   *  scale lets the dialog breathe on phones where the content is already
   *  narrow. */
  density?: ModalDensity;
  footer?: ReactNode;
  children?: ReactNode;
  staticBackdrop?: boolean;
  hideCloseButton?: boolean;
  /** Variant of the close IconButton.  Default `soft`. */
  closeButtonVariant?: ModalCloseVariant;
  /** Size of the close IconButton.  Default `md` (40px). */
  closeButtonSize?: ModalCloseSize;
  /** Position offset of the close IconButton.  `default` = top-4 right-4 (16px),
   *  `corner` = top-1 right-1 (4px — used by AlertDialog). */
  closeButtonOffset?: ModalCloseOffset;
  /** Override the modal's z-index.  Default `200` keeps the modal above
   *  the app shell but below floating panes like the side PDF preview
   *  (`230`) or its fullscreen counterpart (`260`).  Critical dialogs
   *  (AlertDialog) raise this to sit above EVERY pane in the system. */
  zIndex?: number;
  /** Override the `data-component` attribute on the dialog root.
   *  Domain wrappers (`AlertDialog`, `DiscardChangesDialog`,
   *  `DeleteConfirmDialog`) pass their own name so the Dev Mode
   *  inspector identifies them as the named components they are
   *  instead of the generic `Modal` primitive. */
  dataComponentName?: string;
  className?: string;
}

/** Sizes scale linearly from the smallest at 640px up to 2xl at 1440px. */
const SIZE: Record<ModalSize, string> = {
  sm:    'max-w-[640px]',
  md:    'max-w-[768px]',
  lg:    'max-w-[960px]',
  xl:    'max-w-[1280px]',
  '2xl': 'max-w-[1440px]',
  full:  'max-w-[calc(100vw-2rem)]',
};

const WRAP: Record<ModalPosition, string> = {
  center: 'items-center justify-center p-4',
  top:    'items-start  justify-center p-4 pt-4',
  bottom: 'items-end    justify-center p-4 pb-4',
  left:   'items-center justify-start  p-4 pl-4',
  right:  'items-center justify-end    p-4 pr-4',
};

const HIDDEN_TRANSFORM: Record<ModalPosition, string> = {
  center: 'translate3d(0, 100px, 0)',
  top:    'translate3d(0, -100px, 0)',
  bottom: 'translate3d(0, 100px, 0)',
  left:   'translate3d(-100px, 0, 0)',
  right:  'translate3d(100px, 0, 0)',
};

/** Two layout modes per density:
 *
 *   • `sections` — each of `header / body / footer` carries its own
 *     padding + a border (header `border-b`, footer `border-t`) so
 *     the dialog reads as three distinct strips.  Used by the
 *     `default` density (PayrollModal, WrittenTotalModal, …).
 *
 *   • `outer` — a single uniform padding wraps EVERYTHING; no per-
 *     section paddings, no dividers.  The sections still flow as
 *     `<header> → body → <footer>` so consumers can pass any of
 *     the three slots, but visually it's one contiguous padded
 *     space.  Used by the `compact` density (`<AlertDialog>` and
 *     friends) where the chrome would otherwise overpower the
 *     ~408 px wide surface.  `gap` adds vertical breathing room
 *     between the slots without re-introducing dividers.
 *
 *  Drawer (no density concept) inlines the `default` per-section
 *  values directly so the two surfaces share the same scale.
 */
type DensityLayout =
  | { mode: 'sections'; header: string; body: string; footer: string }
  | { mode: 'outer';    outer: string; gap: string };

const DENSITY: Record<ModalDensity, DensityLayout> = {
  default: {
    mode:   'sections',
    header: 'py-4 px-6 md:py-5 md:px-8 xl:py-6 xl:px-10',
    body:   'p-6 md:p-8 xl:p-10',
    footer: 'py-4 px-6 md:py-5 md:px-8 xl:py-6 xl:px-10',
  },
  compact: {
    mode:  'outer',
    outer: 'p-4 md:p-6',
    gap:   'gap-y-3 md:gap-y-4',
  },
};

const ENTER_MS = 360;
const EXIT_MS  = 260;
const EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Animated modal. Backdrop fades while the dialog translates 100px into its
 * resting position. No header/footer separator borders — the dialog is one
 * flat surface with unified 40px paddings (24px in compact mode).
 *
 * The close button is positioned absolutely on the dialog itself (not inside
 * the header), so it stays in the same place whether or not a title is set.
 *
 * For complex headers (icon + aligned title + description), pass a custom
 * `header` slot.  The default rendering just stacks `title` (Typography h2)
 * over `description` (bodySm).
 */
export function Modal({
  open, onClose,
  title, description, header,
  size = 'lg', position = 'center',
  density = 'default',
  footer, children, staticBackdrop, hideCloseButton,
  closeButtonVariant = 'soft',
  closeButtonSize    = 'md',
  closeButtonOffset  = 'default',
  zIndex             = 200,
  dataComponentName  = 'Modal',
  className,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const enterScheduled = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // `isMobile` (<md, < 768 px) downshifts the close IconButton from
  // `md` (40 px) to `sm` (32 px) so it stays balanced against the
  // mobile-scale header typography (h4 collapses to text-lg).  The
  // position also moves inward from `top-4 right-4` (16 px) to
  // `top-2 right-2` (8 px) so the chip sits closer to the dialog
  // corner on narrow viewports.  Consumers that explicitly pass
  // `closeButtonSize="sm"` (AlertDialog) stay sm everywhere.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767.98px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      setVisible(false);
      enterScheduled.current = false;
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted || enterScheduled.current) return;
    enterScheduled.current = true;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
      // React Strict Mode (dev) runs mount → cleanup → mount.  Reset so the
      // 2nd mount can re-schedule the rAFs instead of returning early.
      enterScheduled.current = false;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [mounted, onClose]);

  if (!mounted || typeof window === 'undefined') return null;

  const duration = visible ? ENTER_MS : EXIT_MS;
  const d = DENSITY[density];
  const hasHeader = !!(header || title || description);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-component={dataComponentName}
      data-state={visible ? 'open' : 'closed'}
      data-size={size}
      data-position={position}
      data-density={density}
      aria-labelledby={title ? 'modal-title' : undefined}
      className={cn('fixed inset-0 flex', WRAP[position])}
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (staticBackdrop) return;
        // Skip when the click came from a PORTALED sibling (another
        // Modal, AlertDialog, Drawer, etc.) — those bubble through
        // React's synthetic-event tree even though their DOM lives
        // outside the modal portal, and we shouldn't dismiss the
        // modal just because the inner dialog was dismissed.
        const target = e.target as Node;
        const portalRoot = e.currentTarget as Node;
        if (!portalRoot.contains(target)) return;
        if (dialogRef.current && !dialogRef.current.contains(target)) {
          onClose();
        }
      }}
    >
      {/* Backdrop — hard-coded black so the dimmer stays dark across themes
          (palette-inversion would otherwise flip `bg-neutral-900` to a light
          tone in dark mode and the overlay would brighten the page). */}
      <div
        className="absolute inset-0 bg-black/65"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${duration}ms ${EASE}`,
        }}
      />

      {/* Dialog — follows the active page theme.  In Dark we explicitly drop
          to neutral-100 (#101828) so the surface punches against the page
          rather than blending with the lighter raised tone. */}
      <div
        ref={dialogRef}
        className={cn(
          // Mobile drops to `rounded-lg` (8 px) so the dialog reads as a
          // tighter card on narrow viewports; tablet+ keeps the
          // expressive `rounded-2xl` (16 px) curve.
          'relative w-full rounded-lg md:rounded-2xl bg-(--color-surface-raised) dark:bg-neutral-100 dark:border dark:border-neutral-200 text-(--color-text-default) shadow-2xl flex flex-col max-h-full will-change-transform',
          SIZE[size],
          className,
        )}
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? 'translate3d(0, 0, 0)' : HIDDEN_TRANSFORM[position],
          transition: `opacity ${duration}ms ${EASE}, transform ${duration}ms ${EASE}`,
        }}
      >
        {/* Close button — absolute on the dialog itself.  The "default"
            offset tracks the outer padding scale so the button stays
            visually anchored to the content edge across breakpoints.
            On mobile (<md) the position tightens to `top-2 right-2`
            (8 px) AND the button downshifts to `sm` (32 px) when the
            consumer didn't already pick `sm` — keeps the chrome
            balanced against the mobile-scale heading typography. */}
        {!hideCloseButton && (() => {
          const effectiveSize = isMobile && closeButtonSize === 'md' ? 'sm' : closeButtonSize;
          return (
            <div className={cn(
              'absolute z-10',
              closeButtonOffset === 'corner' ? 'top-1 right-1' : 'top-2 right-2 md:top-4 md:right-4',
            )}>
              <IconButton
                aria-label="Close"
                size={effectiveSize}
                shape="circle"
                variant={closeButtonVariant}
                onClick={onClose}
              >
                <Icon icon={PiX} size={effectiveSize === 'sm' ? 14 : 16} />
              </IconButton>
            </div>
          );
        })()}

        {/* Content stack — two layout modes drive the chrome:
              • `sections` (default density) — each of header / body /
                footer carries its own padding + a divider border, so
                the dialog reads as three distinct strips.
              • `outer` (compact density) — a single outer padding
                wraps EVERYTHING, no per-section paddings, no
                dividers; just a gap-y between the three slots.  Used
                by `<AlertDialog>` so the confirm surface reads as
                one calm padded space instead of a bordered chrome
                bar stack. */}
        <div className={cn(
          'flex flex-col flex-1 min-h-0',
          d.mode === 'outer' && cn(d.outer, d.gap),
        )}>

          {hasHeader && (
            <header className={cn(d.mode === 'sections' && [d.header, 'border-b border-(--color-border-default)'])}>
              {header ?? (
                <>
                  {title && (
                    // `h4` is responsive at the variant level (18 → 20 px),
                    // so the header chrome stays compact on mobile
                    // automatically — no per-call-site override needed.
                    <Typography variant="h4" as="h2" color="primary-950" id="modal-title">
                      {title}
                    </Typography>
                  )}
                  {description && (
                    <Typography variant="bodySm" className="mt-1.5">{description}</Typography>
                  )}
                </>
              )}
            </header>
          )}

          {children && (
            <div className={cn('flex-1 overflow-auto', d.mode === 'sections' && d.body)}>
              {children}
            </div>
          )}

          {footer && (
            <div className={cn(
              'flex items-center justify-end gap-2',
              d.mode === 'sections' && [d.footer, 'border-t border-(--color-border-default)'],
            )}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

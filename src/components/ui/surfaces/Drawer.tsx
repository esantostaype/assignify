'use client';

import {
  useEffect, useRef, useState,
  type PointerEvent as RPointerEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, PiX } from '@/lib/icons';
import { IconButton } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

export type DrawerSide = 'bottom' | 'top' | 'left' | 'right';
export type DrawerSize = 'base' | 'lg';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Which edge of the viewport the drawer is anchored to (default `bottom`). */
  side?: DrawerSide;
  /**
   * Affects width for left/right drawers (no effect on bottom/top — those are
   * always full viewport width).
   *   base → 640 px wide
   *   lg   → 1080 px wide
   */
  size?: DrawerSize;
  title?: ReactNode;
  /** Helper copy rendered under the title in the header.  Body typography. */
  description?: ReactNode;
  children?: ReactNode;
  /** Sticky footer slot — rendered OUTSIDE the scrollable body so the
   *  buttons stay pinned to the bottom edge of the drawer regardless of
   *  how tall the content is.  Mirrors the `footer` slot on `<Modal>`.
   *  Comes with its own border-top divider + padding so consumers just
   *  drop in their action cluster (`<Button>` siblings, etc.). */
  footer?: ReactNode;
  hideCloseButton?: boolean;
  /** Hide the small drag handle indicator (default visible). */
  hideHandle?: boolean;
  /** Pixels past which a drag triggers close. Default 100. */
  closeThreshold?: number;
  className?: string;
}

const ENTER_MS = 360;
const EXIT_MS  = 280;
const EASE     = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Static Tailwind classes so the JIT picks them up.
const WIDTH_BASE = 'w-[640px]  max-w-[92vw]';
const WIDTH_LG   = 'w-[840px] max-w-[92vw]';

/**
 * Vaul-inspired drawer — full coverage on its perpendicular axis, square
 * corners, a small drag handle, and drag-to-close along the matching edge.
 * Animations driven by inline transforms so they don't clash with Tailwind v4's
 * `translate-*` (which uses the CSS `translate` property, not `transform`).
 */
export function Drawer({
  open, onClose, side = 'bottom', size = 'base',
  title, description, children, footer,
  hideCloseButton, hideHandle, closeThreshold = 100,
  className,
}: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const enterScheduled = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // ── mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      setVisible(false);
      setDrag(0);
      enterScheduled.current = false;
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Schedule enter transition ONCE per mount cycle. Watch `mounted` only —
  // depending on `visible` would re-fire this on close and reset visible→true.
  // Reset `enterScheduled.current` in cleanup so React Strict Mode (dev) can
  // re-schedule on the 2nd mount of the cycle.
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
      enterScheduled.current = false;
    };
  }, [mounted]);

  // Esc-to-close + body scroll lock
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

  // `isMobile` (<md) downshifts the close IconButton from `md` (40 px)
  // to `sm` (32 px) and tightens the position from `top-4 right-4`
  // (16 px) to `top-2 right-2` (8 px).  Matches the `<Modal>` primitive's
  // responsive close-button treatment so the two surfaces read
  // identically on narrow viewports.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767.98px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // ── drag ───────────────────────────────────────────────────────────────────
  const isVertical = side === 'bottom' || side === 'top';

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // Ignore drags that start on an interactive child
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    let off = 0;
    if (side === 'bottom') off = Math.max(0, dy);   // drag DOWN only
    if (side === 'top')    off = Math.min(0, dy);   // drag UP only
    if (side === 'right')  off = Math.max(0, dx);   // drag RIGHT
    if (side === 'left')   off = Math.min(0, dx);   // drag LEFT
    setDrag(off);
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    if (Math.abs(drag) >= closeThreshold) {
      onClose();           // far enough — close
    } else {
      setDrag(0);          // snap back
    }
  };

  if (!mounted || typeof window === 'undefined') return null;

  // ── geometry ───────────────────────────────────────────────────────────────
  const widthCls = size === 'lg' ? WIDTH_LG : WIDTH_BASE;

  const sheetPos =
    side === 'bottom' ? 'bottom-0 left-0 right-0 max-h-[90vh]'
  : side === 'top'    ? 'top-0    left-0 right-0 max-h-[90vh]'
  : side === 'left'   ? `top-0 bottom-0 left-0  ${widthCls}`
  :                     `top-0 bottom-0 right-0 ${widthCls}`;

  // Build inline transform: combines off-screen translate (when hidden)
  // with the user's drag offset (when visible). Inline values guarantee the
  // CSS `transform` property is animated (not Tailwind's `translate`).
  let transform = 'translate3d(0, 0, 0)';
  if (!visible) {
    if (side === 'bottom') transform = 'translate3d(0, 100%, 0)';
    if (side === 'top')    transform = 'translate3d(0, -100%, 0)';
    if (side === 'right')  transform = 'translate3d(100%, 0, 0)';
    if (side === 'left')   transform = 'translate3d(-100%, 0, 0)';
  } else if (drag !== 0) {
    transform = isVertical ? `translate3d(0, ${drag}px, 0)` : `translate3d(${drag}px, 0, 0)`;
  }

  // Backdrop opacity fades with the drag — Vaul-style.
  const backdropOpacity = !visible
    ? 0
    : Math.max(0.15, 1 - Math.abs(drag) / 400);

  // ── handle indicator (neutral-300, 2 px × 32 px) ─────────────────────────
  const handleEl = !hideHandle ? (
    <span
      aria-hidden
      data-component="DrawerHandle"
      className={cn(
        'absolute rounded-full bg-(--color-border-strong)',
        side === 'bottom' && 'top-2    left-1/2 -translate-x-1/2 h-0.5 w-8',
        side === 'top'    && 'bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-8',
        side === 'left'   && 'right-2  top-1/2 -translate-y-1/2  w-0.5 h-8',
        side === 'right'  && 'left-2   top-1/2 -translate-y-1/2  w-0.5 h-8',
      )}
    />
  ) : null;

  return createPortal(
    <div
      data-component="Drawer"
      data-state={visible ? 'open' : 'closed'}
      data-side={side}
      data-size={size}
      className="fixed inset-0 z-[200]"
      onMouseDown={(e) => {
        // Click outside the sheet closes (backdrop is its own absolute
        // child).  Skip when the click came from a PORTALED sibling such
        // as a nested AlertDialog / Modal — those bubble through React's
        // synthetic-event tree even though their DOM lives elsewhere, and
        // we shouldn't dismiss the drawer just because the dialog was
        // dismissed.
        const target = e.target as Node;
        const portalRoot = e.currentTarget as Node;
        if (!portalRoot.contains(target)) return;
        if (sheetRef.current && !sheetRef.current.contains(target)) {
          onClose();
        }
      }}
    >
      {/* Backdrop — hard-coded black so the dimmer stays dark across themes. */}
      <div
        className="absolute inset-0 bg-black/65"
        style={{
          opacity: backdropOpacity,
          transition: dragging ? 'none' : `opacity ${visible ? ENTER_MS : EXIT_MS}ms ${EASE}`,
        }}
      />

      {/* Sheet — pointer handlers attached at root so drag can fire from the
          outer 24px frame.  Content inside stops propagation so dragging on a
          form field is impossible (and doesn't interfere with Dev Mode's
          document-level click listener, which runs at capture phase). */}
      <aside
        ref={sheetRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'absolute flex flex-col bg-(--color-surface-raised) dark:bg-neutral-100 dark:border dark:border-neutral-200 text-(--color-text-default) shadow-2xl will-change-transform touch-none select-none',
          sheetPos,
          dragging ? 'cursor-grabbing' : '',
          className,
        )}
        style={{
          transform,
          transition: dragging
            ? 'none'
            : `transform ${visible ? ENTER_MS : EXIT_MS}ms ${EASE}`,
        }}
      >
        {handleEl}

        {/* Close button — soft circular IconButton anchored top-right.
            Stops pointerdown so it doesn't accidentally start a drag.
            On mobile (<md) the button is `sm` (32 px) at `top-2 right-2`
            (8 px); tablet+ uses `md` (40 px) at `top-4 right-4` (16 px).
            Mirrors the `<Modal>` primitive's close-button treatment. */}
        {!hideCloseButton && (
          <div
            className="absolute top-2 right-2 md:top-4 md:right-4 z-10"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconButton
              aria-label="Close"
              size={isMobile ? 'sm' : 'md'}
              shape="circle"
              variant="soft"
              onClick={onClose}
            >
              <Icon icon={PiX} size={isMobile ? 14 : 16} />
            </IconButton>
          </div>
        )}

        {(title || description) && (
          <header
            // Header strip — own padding + bottom border + raised
            // surface so the title sits in its own band above the
            // scrolling body.  Padding scale matches `<Modal>` (default
            // density) — `py-3 px-4 md:py-4 md:px-6` — so the two
            // surfaces read identically across the app.  `shrink-0`
            // keeps the strip from squishing inside the sheet's flex
            // column.  `pr-16 md:pr-20` reserves room for the absolute
            // close button so the title doesn't collide with it.
            className={cn(
              'shrink-0 select-text',
              'py-4 px-6 md:py-5 md:px-8 xl:py-6 xl:px-10',
              'border-b border-(--color-border-default)',
              'bg-(--color-surface-raised) dark:bg-neutral-100',
              !hideCloseButton && 'pr-16 md:pr-20',
            )}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {title && (
              // `h4` is responsive at the variant level (18 → 20 px),
              // so the drawer header stays compact on mobile
              // automatically — no per-call-site override needed.
              <Typography variant="h4" as="div" color="primary-950">
                {title}
              </Typography>
            )}
            {description && (
              <Typography variant="body" as="p" className="mt-2 text-(--color-text-muted)">
                {description}
              </Typography>
            )}
          </header>
        )}

        {/* Body — outer wrapper carries the drag-friendly frame, inner
            wrapper stops propagation so dragging from the content area
            is impossible.  `select-text` re-enables text selection
            inside the body (the aside has `select-none` to keep the
            drag clean).  Padding scale matches `<Modal>` body (default
            density) — `p-4 md:p-6` — so the two surfaces share the
            same content rhythm. */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 xl:p-10">
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="select-text"
            >
              {children}
            </div>
          </div>
        </div>

        {/* Sticky footer — sits OUTSIDE the scrollable body so the action
            cluster stays pinned to the bottom edge regardless of how tall
            the body content is.  Mirrors the Modal footer behaviour.
            Stops pointerdown so dragging from the footer doesn't trigger
            the close gesture; re-enables text selection so any inline
            helper text inside the footer remains selectable. */}
        {footer && (
          <footer
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'shrink-0 select-text',
              'py-4 px-6 md:py-5 md:px-8 xl:py-6 xl:px-10',
              'border-t border-(--color-border-default)',
              'bg-(--color-surface-raised) dark:bg-neutral-100',
            )}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}

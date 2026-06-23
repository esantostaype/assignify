'use client';

import {
  useEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { BrandSpinner } from './BrandSpinner';
import { Typography } from '@/components/ui/typography';

export interface LoadingOverlayProps {
  /** Controls visibility.  Flipping `false → true` mounts the
   *  overlay and starts the fade-in; `true → false` fades out and
   *  unmounts once the transition finishes. */
  open: boolean;
  /** Spinner diameter in px.  Default 56. */
  spinnerSize?: number;
  /** Tailwind text-color class forwarded to the inner `<Spinner>` —
   *  drives the stroke colour via `currentColor`.  Default
   *  `text-white` so the spinner reads clearly on the darkened
   *  backdrop in every theme. */
  spinnerColorClassName?: string;
  /** Optional caption rendered below the spinner.  Use a short
   *  imperative sentence — "Generating your Proposal", "Saving
   *  changes", etc.  Plain strings render as `<Typography
   *  variant="h5">`; pass a node if you need a different shape. */
  label?: ReactNode;
  /** ARIA label announced when no `label` is set.  Default
   *  `"Loading"`. */
  ariaLabel?: string;
  /** Override the stacking context.  Defaults to `200` — above the
   *  app shell, below `AlertDialog` (which uses `280` for critical
   *  confirmations).  Bump this when the overlay needs to sit on
   *  top of a custom floating pane. */
  zIndex?: number;
  /** Cross-fade duration in ms.  Default `220`.  Both directions
   *  share the same timing — kept short so the producer doesn't sit
   *  staring at a fading backdrop. */
  fadeMs?: number;
}

const DEFAULT_FADE_MS = 220;

/**
 * LoadingOverlay — full-viewport dimmed backdrop with a centred
 * spinner.  Pair with any long-running async action ("Generate
 * Report", "Generate Proposal", bulk imports) so the producer sees a
 * focused wait state instead of an inert button.
 *
 * Owns its own mount/visibility lifecycle:
 *
 *   open=true   → mount immediately, render at `opacity-0`, then
 *                 double-rAF to flip to `opacity-100` so the CSS
 *                 transition has a previous state to animate from.
 *   open=false  → flip back to `opacity-0`; `fadeMs` later, unmount.
 *
 * Portals into `document.body` so a transformed ancestor (which
 * would otherwise become the containing block of `position: fixed`)
 * can't trap the overlay inside the page chrome.
 *
 * Optional `label` renders directly under the spinner — pass a
 * string for the standard h3 treatment, or a custom node when the
 * caption needs a different shape (multi-line, a small Typography
 * variant, etc).
 */
export function LoadingOverlay({
  open,
  spinnerSize = 56,
  spinnerColorClassName = 'text-white',
  label,
  ariaLabel = 'Loading',
  zIndex = 200,
  fadeMs = DEFAULT_FADE_MS,
}: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeInRafRef = useRef<number | null>(null);
  // Tracks whether we've ever observed the browser environment so the
  // server render doesn't try to reach for `document` via the portal.
  const [canPortal, setCanPortal] = useState(false);

  useEffect(() => { setCanPortal(true); }, []);

  // Cleanup any pending timers / animation frames if the consumer
  // unmounts the overlay mid-transition.
  useEffect(() => () => {
    if (fadeOutRef.current)  clearTimeout(fadeOutRef.current);
    if (fadeInRafRef.current) cancelAnimationFrame(fadeInRafRef.current);
  }, []);

  // Mount/unmount driven by `open`.  Splits the lifecycle from the
  // visibility flip below so the initial paint reliably lands at
  // `opacity-0` (otherwise React might batch both state updates into
  // a single render and the browser would never see the start frame).
  useEffect(() => {
    if (open) {
      if (fadeOutRef.current) clearTimeout(fadeOutRef.current);
      setMounted(true);
      return;
    }
    setVisible(false);
    fadeOutRef.current = setTimeout(() => setMounted(false), fadeMs);
  }, [open, fadeMs]);

  // Fade-in scheduler.  Double rAF guarantees the browser has painted
  // the `opacity-0` frame before we flip to `opacity-100`, so the
  // CSS transition runs instead of snapping.
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setVisible(true));
      fadeInRafRef.current = id2;
    });
    fadeInRafRef.current = id;
    return () => {
      if (fadeInRafRef.current) cancelAnimationFrame(fadeInRafRef.current);
    };
  }, [mounted]);

  if (!mounted || !canPortal) return null;

  const overlay = (
    <div
      data-component="LoadingOverlay"
      data-state={visible ? 'open' : 'closed'}
      role="status"
      aria-live="polite"
      aria-label={typeof label === 'string' ? label : ariaLabel}
      style={{ transitionDuration: `${fadeMs}ms`, zIndex }}
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-center gap-4',
        'bg-black/65',
        'transition-opacity ease-app',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <BrandSpinner size={spinnerSize} colorClassName={spinnerColorClassName} />
      {label != null && (
        typeof label === 'string'
          ? (
            // Inline `color="white"` (via Typography's style prop)
            // wins over the variant's default `--color-text-default`
            // class — the plain `cn` helper is a flat concatenator,
            // not a tailwind-merge resolver, so a className override
            // would race the variant rule on CSS order alone.
            <Typography variant="h5" as="div" color="white" className="text-center">
              {label}
            </Typography>
          )
          : label
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

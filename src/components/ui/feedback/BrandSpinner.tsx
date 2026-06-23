'use client';

import { cn } from '@/lib/cn';

export interface BrandSpinnerProps {
  /** Diameter in px. Default 56. */
  size?: number;
  /** Tailwind text-color class — drives the orbiting "worm" line via
   *  `currentColor`. Default `text-white` (reads on the dark LoadingOverlay
   *  backdrop). On light surfaces pass a brand/neutral tone, e.g.
   *  `text-primary-500`, so the worm stays visible. The isotype keeps its
   *  own blue gradient in every theme. */
  colorClassName?: string;
  className?: string;
}

/**
 * BrandSpinner — Assignify's branded loader: the isotype sits still in the
 * centre while a single white "worm" arc orbits around it. The orbit uses an
 * ease-in-out rotation so the worm accelerates out of each lap and decelerates
 * as it nears completing the turn (per the brand motion spec).
 *
 * Use it for prominent, full-section/overlay wait states (LoadingOverlay,
 * page/section loaders). The plain `<Spinner>` stays the right pick for tiny
 * inline/button spinners — a logo at 16 px would be illegible.
 */
export function BrandSpinner({ size = 56, colorClassName = 'text-white', className }: BrandSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      data-component="BrandSpinner"
      className={cn('inline-block', colorClassName, className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Same diagonal gradient as the wordmark's isotype (logo.svg). */}
          <linearGradient id="assignify-brand-iso" x1="0" y1="30.09" x2="19.04" y2="11.06" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5979a9" />
            <stop offset="1" stopColor="#89a1cc" />
          </linearGradient>
        </defs>

        {/* The worm: a short arc (22% of the ring) orbiting the mark. `pathLength`
            normalises the dash to percentages; the ease-in-out keyframe gives the
            accelerate-then-decelerate-per-lap feel. Only this circle rotates —
            the isotype stays still. */}
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="22 78"
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animation: 'bsWormSpin 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
          }}
        />

        {/* Isotype, centred. The nested viewBox maps the mark's own bbox
            (x:0–22.84, y:7.25–30.09) into a 36×36 box at the centre, so the
            userSpace gradient lines up exactly like in the logo. */}
        <svg x="32" y="32" width="36" height="36" viewBox="0 7.25 22.84 22.84" overflow="visible">
          <path
            fill="url(#assignify-brand-iso)"
            d="M15.23,7.25v7.61H0v-7.61h15.23ZM15.23,14.86C6.82,14.86,0,21.68,0,30.09h7.61c0-4.21,3.41-7.61,7.61-7.61v7.61h7.61v-15.23h-7.61Z"
          />
        </svg>
      </svg>
    </span>
  );
}

'use client';

import { cn } from '@/lib/cn';

// Contorno del isotipo de Assignify (mismo path que el wordmark, logo.svg). Son dos
// subpaths: la barra superior + la figura principal con la curva. bbox ≈ x[0,22.84]
// y[7.25,30.09]; el viewBox de abajo lo encuadra con padding para que el trazo no se corte.
const ISO_PATH =
  'M15.23,7.25v7.61H0v-7.61h15.23ZM15.23,14.86C6.82,14.86,0,21.68,0,30.09h7.61c0-4.21,3.41-7.61,7.61-7.61v7.61h7.61v-15.23h-7.61Z';

export interface BrandSpinnerProps {
  /** Diameter in px. Default 56. */
  size?: number;
  /** Tailwind text-color class — drives BOTH the faint outline and the moving
   *  "worm" via `currentColor`. Default `text-white` (reads on the dark
   *  LoadingOverlay backdrop). On light surfaces pass a brand/neutral tone,
   *  e.g. `text-primary-500`, so it stays visible. */
  colorClassName?: string;
  className?: string;
}

/**
 * BrandSpinner — Assignify's branded loader. The isotype is drawn with a
 * transparent fill and a very faint outline; a short "worm" segment then
 * travels ALONG that outline (the mark's own contour, not an orbiting circle).
 * The ease-in-out dash animation makes the worm accelerate out of each lap and
 * decelerate as it nears completing the contour; because the dash period equals
 * the full path length, the loop restart is seamless.
 *
 * Use it for prominent, full-section/overlay wait states. The plain `<Spinner>`
 * stays the right pick for tiny inline/button spinners.
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
      <svg viewBox="-4 3.25 30.84 30.84" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Borde MUY tenue del isotipo (relleno transparente). */}
        <path
          d={ISO_PATH}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Gusano: tramo corto que recorre el contorno. pathLength=100 normaliza el dash;
            el offset anima 0 → -100 (una vuelta entera) con ease-in-out. */}
        <path
          d={ISO_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="20 80"
          style={{ animation: 'bsWormDraw 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite' }}
        />
      </svg>
    </span>
  );
}

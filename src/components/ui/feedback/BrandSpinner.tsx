'use client';

import { cn } from '@/lib/cn';

// Contorno del isotipo de Assignify trazado como UN SOLO path continuo (sin subpaths).
// El isotipo original (logo.svg) son dos piezas —la barra superior y la figura principal—
// que se tocan en el punto (15.23,14.86); aquí el trazo pasa por ese punto de unión para
// recorrer todo el perímetro de una sola pasada, de modo que el "gusano" nunca se parte en
// dos. bbox ≈ x[0,22.84] y[7.25,30.09]; el viewBox lo encuadra con padding.
const ISO_OUTLINE =
  'M0,7.25 L15.23,7.25 L15.23,14.86 L22.83,14.86 L22.83,30.09 L15.22,30.09 L15.22,22.48 ' +
  'C11.02,22.48 7.61,25.88 7.61,30.09 L0,30.09 C0,21.68 6.82,14.86 15.23,14.86 L0,14.86 Z';

export interface BrandSpinnerProps {
  /** Diameter in px. Default 56. */
  size?: number;
  /** Tailwind text-color class — drives BOTH the faint outline and the moving
   *  "worm" via `currentColor`. Default `text-white` (reads on the dark
   *  LoadingOverlay backdrop). On light surfaces pass a brand/neutral tone,
   *  e.g. `text-primary-500`. */
  colorClassName?: string;
  className?: string;
}

/**
 * BrandSpinner — Assignify's branded loader. The isotype is drawn with a
 * transparent fill and a very faint outline; a single short "worm" segment then
 * runs ALONG that outline (the mark's own contour, one continuous stroke — never
 * split in two). The ease-in-out dash animation accelerates the worm out of each
 * lap and decelerates it near completion; the loop restart is seamless because
 * the dash period equals the full path length.
 *
 * The stroke is a constant 2 px at any `size` (`vector-effect: non-scaling-stroke`).
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
          d={ISO_OUTLINE}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Gusano: un único tramo corto que recorre el contorno de una sola pasada. */}
        <path
          d={ISO_OUTLINE}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="22 78"
          style={{ animation: 'bsWormDraw 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite' }}
        />
      </svg>
    </span>
  );
}

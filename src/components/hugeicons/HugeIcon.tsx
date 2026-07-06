import { createElement, type SVGProps } from 'react';
import type { IconSvgElement } from '@/lib/hugeicons/stroke';

export interface HugeIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  icon: IconSvgElement;
  size?: number | string;
  /** Overrides every child's own `strokeWidth`, when it has one — lets the
   *  Icon Library's stroke-width control restyle the icon without needing
   *  per-path edits.  Fill-only shapes (e.g. a duotone background circle)
   *  have no `strokeWidth` to begin with and are left untouched. */
  strokeWidth?: number | string;
}

/**
 * Renders a Hugeicons raw node list (`[tagName, attrs][]`, vendored in
 * `@/lib/hugeicons/stroke` + `@/lib/hugeicons/duotone`) as an actual `<svg>`.
 * An explicit pixel size and no forced color, so `currentColor` cascades in
 * from the parent's text color (or an explicit `style={{ color }}` override).
 */
export function HugeIcon({ icon, size = 24, strokeWidth, ...rest }: HugeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      data-component="HugeIcon"
      {...rest}
    >
      {icon.map(([tag, attrs], i) => {
        const finalAttrs = strokeWidth !== undefined && 'strokeWidth' in attrs
          ? { ...attrs, strokeWidth }
          : attrs;
        return createElement(tag, { ...finalAttrs, key: attrs.key ?? i });
      })}
    </svg>
  );
}

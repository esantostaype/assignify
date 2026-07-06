/**
 * Ambient type for the sibling `stroke.js` — a vendored Hugeicons "stroke
 * rounded" data module.  Plain CommonJS build (`exports.NameIcon = [...]`
 * for each of ~4,567 icons) with no shipped types; this declares its shape
 * without enabling project-wide `allowJs`.  Each icon is a Hugeicons-format
 * raw SVG node list — `[tagName, attrs][]` — rendered via `HugeIcon` (see
 * `design-system/design/icon-library/_components/HugeIcon.tsx`).
 */
export type IconSvgElement = ReadonlyArray<readonly [string, Record<string, string | number>]>;
declare const icons: Record<string, IconSvgElement>;
export default icons;

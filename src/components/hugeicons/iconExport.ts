/**
 * Export helpers for the Icon Library detail modal — turning raw icon data
 * (see `HugeIcon`'s `IconSvgElement` shape) into a downloadable/copyable SVG
 * or PNG.  Plain browser API glue (Blob / Canvas / Clipboard), not UI — the
 * modal owns the try/catch + toast around each call.
 */
import type { IconSvgElement } from '@/lib/hugeicons/stroke';

const ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escapeAttr(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ESCAPE_MAP[c]);
}
function toKebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Builds a standalone SVG string directly from icon data — NOT from the
 * live-rendered `<svg>` DOM node.  Building from data (rather than reading
 * `previewRef.current`) means an export triggered in the same tick as a
 * `setState` (e.g. switching to the Outlined variant) always exports the
 * variant that was actually picked, with no dependency on React having
 * already re-rendered the preview first.
 *
 * `color` is set via `style` on the root — `currentColor` in each child
 * then resolves against it exactly like it would inheriting from a page's
 * text color, so no per-node color substitution is needed.
 */
export function buildIconSvgMarkup(
  icon: IconSvgElement,
  opts: { size: number; strokeWidth?: string; color: string },
): string {
  const { size, strokeWidth, color } = opts;
  const children = icon
    .map(([tag, attrs]) => {
      const finalAttrs = strokeWidth !== undefined && 'strokeWidth' in attrs
        ? { ...attrs, strokeWidth }
        : attrs;
      const attrStr = Object.entries(finalAttrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${toKebabCase(k)}="${escapeAttr(String(v))}"`)
        .join(' ');
      return `<${tag} ${attrStr}></${tag}>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="color:${color}">${children}</svg>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

/** Rasterizes an SVG string to a square PNG blob at `size` px. */
export function svgToPngBlob(svgMarkup: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG conversion failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize SVG'));
    };
    img.src = url;
  });
}

/** Triggers a browser download for any blob — object URL + click + revoke. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Copies actual image data (pasteable into Slack/Docs/etc.), not a file path. */
export async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

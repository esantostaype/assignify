/**
 * Body scroll lock with no layout shift.
 *
 * When `overflow: hidden` is applied to the body the vertical scrollbar
 * disappears, which widens the viewport and snaps the page (plus any fixed
 * elements pinned to the right edge) ~15 px to the right.  To avoid the jump
 * we measure the scrollbar width, expose it as `--scrollbar-width` on
 * `<html>`, and let CSS (defined in globals.css) compensate by adding
 * matching `padding-right` to the body and any fixed chrome.
 *
 * A refcount keeps multiple stacked locks (modal opening an alert dialog,
 * for example) from prematurely releasing the lock.
 */

let lockCount = 0;
let prevOverflow = '';

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    prevOverflow = document.body.style.overflow;
    document.documentElement.style.setProperty('--scrollbar-width', `${sbw}px`);
    document.documentElement.setAttribute('data-scroll-locked', '');
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = prevOverflow;
    document.documentElement.removeAttribute('data-scroll-locked');
    document.documentElement.style.removeProperty('--scrollbar-width');
  }
}

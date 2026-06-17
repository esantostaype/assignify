import type { IconType } from 'react-icons';
import type { CSSProperties } from 'react';

interface BaseProps {
  size?: string | number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Custom Inszone icons used in places where no Phosphor equivalent fits.
 * They follow the same shape as `react-icons/pi` (i.e. accept `size` /
 * `color` / `title`) so the `<Icon>` wrapper can render them transparently.
 */

/** "Open sidebar" — square with a left rail and a right-pointing chevron. */
export const PiSidebarOpenCustom: IconType = (({ size = '1em', color, title, ...rest }: BaseProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color ?? 'currentColor'}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {title && <title>{title}</title>}
    <path d="M21 11C21 7.22876 21 5.34315 19.8284 4.17157C18.6569 3 16.7712 3 13 3H11C7.22876 3 5.34315 3 4.17157 4.17157C3 5.34315 3 7.22876 3 11V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H13C16.7712 21 18.6569 21 19.8284 19.8284C21 18.6569 21 16.7712 21 13V11Z" />
    <path d="M9 3V21" />
    <path d="M14 9L15.1082 9.87868C16.3694 10.8787 17 11.3787 17 12C17 12.6213 16.3694 13.1213 15.1082 14.1213L14 15" />
  </svg>
)) as IconType;

/** "Close sidebar" — same frame but the chevron points the other way. */
export const PiSidebarCloseCustom: IconType = (({ size = '1em', color, title, ...rest }: BaseProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color ?? 'currentColor'}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {title && <title>{title}</title>}
    <path d="M21 11C21 7.22876 21 5.34315 19.8284 4.17157C18.6569 3 16.7712 3 13 3H11C7.22876 3 5.34315 3 4.17157 4.17157C3 5.34315 3 7.22876 3 11V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H13C16.7712 21 18.6569 21 19.8284 19.8284C21 18.6569 21 16.7712 21 13V11Z" />
    <path d="M9 3V21" />
    <path d="M16 9L14.8918 9.87868C13.6306 10.8787 13 11.3787 13 12C13 12.6213 13.6306 13.1213 14.8918 14.1213L16 15" />
  </svg>
)) as IconType;

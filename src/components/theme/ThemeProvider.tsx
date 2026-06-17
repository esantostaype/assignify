'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'base' | 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'theme-mode';
const VALID: ReadonlyArray<ThemeMode> = ['base', 'light', 'dark'];

/** Resolve the active mode from the most authoritative source available:
 *
 *   1. `data-theme` attribute on `<html>` — set by the inline bootstrap
 *      script BEFORE React hydrates, so it's the freshest read on first
 *      paint after a full page load.
 *   2. `localStorage.theme-mode` — fallback if `data-theme` is missing
 *      (e.g. a browser extension or a bfcache restore stripped it).
 *
 *  Returns `'base'` on the server (no `document`).  The provider's
 *  `useState` initial value is also `'base'` so SSR and the very first
 *  client render match exactly — the real mode is applied in the
 *  post-mount effect.  This intentional one-tick "base flash" is the
 *  cost of avoiding a hydration mismatch on the components that read
 *  `mode` for active styles (ThemeSwitcher pills, etc.). */
function readInitialMode(): ThemeMode {
  if (typeof document === 'undefined') return 'base';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr && VALID.includes(attr as ThemeMode)) return attr as ThemeMode;
  try {
    const ls = localStorage.getItem(STORAGE_KEY);
    if (ls && VALID.includes(ls as ThemeMode)) return ls as ThemeMode;
  } catch {}
  return 'base';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('base');

  // Hydrate `mode` from the inline script's `data-theme` (or localStorage
  // as fallback) once after mount.  Empty dep array = runs once per
  // ThemeProvider mount; the provider lives in the root layout so it
  // never re-mounts on SPA navigation.
  useEffect(() => {
    setModeState(readInitialMode());
  }, []);

  // Defensive re-apply of `data-theme` on every mode change.  In normal
  // operation `setMode` already writes the attribute, but this effect
  // also runs on the initial hydration step above — and re-running it
  // means a browser extension / bfcache restore that strips the
  // attribute gets it back on the next render cycle.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  // Cross-tab sync — when the user flips the theme in another tab, the
  // `storage` event fires here and we pick up the new value.  Without
  // this, tab A staying on 'dark' while tab B switched to 'light' would
  // diverge until a refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      if (VALID.includes(e.newValue as ThemeMode)) {
        setModeState(e.newValue as ThemeMode);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  // Memoise the context value so consumers that only depend on `setMode`
  // (which is already stable via useCallback) don't re-render whenever
  // an unrelated parent renders.  Without this, every ancestor render
  // would create a new value object and invalidate every consumer.
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

/** Inline script executed before React hydration to set `data-theme` on
 *  `<html>` from localStorage, avoiding a flash of the wrong theme.  Inject
 *  as `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />`
 *  inside `<head>` of the root layout. */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('${STORAGE_KEY}');
  if (t !== 'base' && t !== 'light' && t !== 'dark') t = 'base';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'base');
}
`;

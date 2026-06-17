'use client'
// src/providers/UiThemeProvider.tsx
// Tema del nuevo sistema de diseño (/components/ui): controla `data-theme`
// en <html>, persiste en localStorage y expone un toggle claro/oscuro.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface UiThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const UiThemeContext = createContext<UiThemeContextValue | null>(null)
const STORAGE_KEY = 'assignify-theme'

function applyTheme(t: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t
  }
}

export function UiThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  // Al montar, leer la preferencia guardada (default: dark, el look actual).
  useEffect(() => {
    let stored: Theme | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    } catch {
      /* ignore */
    }
    const initial: Theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return (
    <UiThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </UiThemeContext.Provider>
  )
}

export function useUiTheme(): UiThemeContextValue {
  const ctx = useContext(UiThemeContext)
  if (!ctx) throw new Error('useUiTheme debe usarse dentro de <UiThemeProvider>')
  return ctx
}

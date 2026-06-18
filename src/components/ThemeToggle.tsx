'use client'
// Toggle de tema como pill de 2 segmentos (Light | Dark), respaldado por el tema
// real de la app (UiThemeProvider). El segmento activo se eleva con fondo blanco.
import { cn } from '@/lib/cn'
import { useUiTheme } from '@/providers/UiThemeProvider'
import { Icon, PiSun, PiMoon } from '@/lib/icons'

const OPTIONS = [
  { id: 'light', label: 'Light', icon: PiSun },
  { id: 'dark', label: 'Dark', icon: PiMoon },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useUiTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-(--color-border-default) bg-(--color-surface-subtle) p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = theme === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
              active
                ? 'bg-(--color-surface-card) text-(--color-text-strong) shadow-sm'
                : 'text-(--color-text-muted) hover:text-(--color-text-default)',
            )}
          >
            <Icon icon={o.icon} size={14} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

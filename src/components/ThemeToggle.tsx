'use client'
// Toggle de tema como pills — MISMO componente que las demás pills de la app
// (shadcn ToggleGroup). Iconos hugeicons.
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun03Icon, Moon02Icon } from '@hugeicons/core-free-icons'
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group'
import { useUiTheme } from '@/providers/UiThemeProvider'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useUiTheme()

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(v) => {
        if (v === 'light' || v === 'dark') setTheme(v)
      }}
      aria-label="Theme"
      className={className}
    >
      <ToggleGroupItem value="light" aria-label="Light">
        <HugeiconsIcon icon={Sun03Icon} size={14} />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <HugeiconsIcon icon={Moon02Icon} size={14} />
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

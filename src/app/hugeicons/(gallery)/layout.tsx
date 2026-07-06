import { HugeiconsLogo } from '@/components/HugeiconsLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { HugeiconsSignOut } from '@/components/hugeicons/HugeiconsSignOut'

// Contenido PROTEGIDO de Hugeicons (tras el login propio). Header mínimo: logo + toggle de
// tema + logout de Hugeicons (NO el UserMenu de Auth.js, porque esta sección no usa esa
// sesión). Contenido centrado a 1280px. El guard de acceso lo hace el middleware.
export default function HugeiconsGalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto">
      <header className="sticky top-0 z-[60] flex h-16 shrink-0 items-center justify-between border-b border-(--color-border-default) bg-(--color-surface-header) px-4">
        <HugeiconsLogo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <HugeiconsSignOut />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1">{children}</main>
    </div>
  )
}

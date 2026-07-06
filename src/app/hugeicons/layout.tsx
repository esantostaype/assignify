import { Providers } from '../providers'
import { HugeiconsLogo } from '@/components/HugeiconsLogo'
import { UserMenu } from '@/components/UserMenu'

// Layout propio de Hugeicons — a propósito NO usa AppLayout: sin el panel
// fijo de Create Task, sin el nav de Tasks/Team/Types/Lists y sin
// BottomNav, porque esto es una herramienta de referencia de iconos, no
// parte de la navegación principal del producto. Header mínimo (logo +
// avatar) a 100%; el contenido de la página va centrado a 1280px.
// `Providers` se mantiene porque UserMenu (y el propio tema oscuro)
// dependen de su sesión / theme / query context.
export default function HugeiconsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex h-dvh flex-col overflow-y-auto">
        <header className="sticky top-0 z-[60] flex h-16 shrink-0 items-center justify-between border-b border-(--color-border-default) bg-(--color-surface-header) px-4">
          <HugeiconsLogo />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1">
          {children}
        </main>
      </div>
    </Providers>
  )
}

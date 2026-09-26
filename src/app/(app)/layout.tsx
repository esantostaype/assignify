import { BottomNav } from '@/components'
import { Sidebar } from '@/components/Sidebar'
import { SmoothScroll } from '@/components/SmoothScroll'
import { CreateTaskDrawer } from '@/components/create-task/CreateTaskDrawer'
import { Logo } from '@/components/Logo'
import { UserMenu } from '@/components/UserMenu'
import { Providers } from '../providers'

// Shell tipo dashboard: sidebar flush a la izquierda + contenido en un CONTENEDOR
// flotante (inset 8px arriba/abajo/derecha, redondeado) sobre el bg del frame.
// Create Task ya no es panel fijo: se abre como DRAWER (ver CreateTaskDrawer).
export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <Providers>
      {/* Frame: un tono más oscuro (dark) / gris (light) que el contenido, para que el
          panel flote en los 8px de aire. */}
      <div className="flex h-dvh overflow-hidden bg-(--color-neutral-50)">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Top bar SOLO mobile (<lg): logo + avatar sobre el frame; el container continúa debajo. */}
          <header className="flex h-14 shrink-0 items-center justify-between px-4 md:hidden">
            <Logo width={120} height={34} className="h-8 w-auto" />
            <UserMenu />
          </header>
          {/* Contenedor del contenido: aire alrededor (izquierda flush al sidebar en lg),
              esquinas redondeadas, bg surface-app → las cards (surface-card) resaltan.
              min-h-0: el section toma alto por flex-grow, sin esto la cadena h-full del
              SmoothScroll no acota y el contenido no scrollea / se mete bajo el footer. */}
          <section className="min-h-0 min-w-0 flex-1 p-3 max-md:pb-16 max-md:pt-0 md:pl-0">
            <SmoothScroll className="rounded-2xl bg-(--color-surface-app)" contentClassName="flex h-full flex-col">
              {children}
            </SmoothScroll>
          </section>
        </div>
      </div>
      <CreateTaskDrawer />
      {modal}
      {/* Bottom nav: solo mobile/tablet (<lg). */}
      <BottomNav />
    </Providers>
  )
}

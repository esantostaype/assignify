import { Header, CreateTaskForm } from '@/components'
import { Providers } from '../providers'

// El panel de Create Task es FIJO a la derecha en desktop/laptop (lg+) y se OCULTA en
// mobile/tablet, donde Create vive en su ruta /create (bottom nav — F3). `modal` es el slot
// paralelo @modal: muestra Types/Lists como modal interceptado en desktop (o null vía
// default.tsx cuando no hay ninguno).
export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <Providers>
      <main className="flex">
        <section className="flex-1 h-dvh overflow-y-auto flex flex-col">
          <Header />
          {children}
        </section>
        <aside className="hidden h-dvh w-[28rem] shrink-0 overflow-y-auto border-l border-(--color-border-default) bg-(--color-surface-card) lg:block">
          <CreateTaskForm />
        </aside>
      </main>
      {modal}
    </Providers>
  )
}

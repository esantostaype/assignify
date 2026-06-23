import { Header } from '@/components'
import { Providers } from '../providers'

// `modal` es el slot paralelo @modal: renderiza el modal interceptado (Create/Types/Lists)
// en desktop, o null (default.tsx) cuando no hay ninguno. El form de Create ya NO es un
// aside permanente: vive en su ruta /create.
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
      </main>
      {modal}
    </Providers>
  )
}

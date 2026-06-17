import { CreateTaskForm, Header } from '@/components'
import { Providers } from '../providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className='flex'>
        <section className='flex-1 h-dvh overflow-y-auto flex flex-col'>
          <Header />
          {children}
        </section>
        <CreateTaskForm />
      </main>
    </Providers>
  )
}

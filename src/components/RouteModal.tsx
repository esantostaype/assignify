'use client'
// Envuelve contenido en un Modal cuya X / backdrop / Escape hacen router.back(), de modo
// que el modal está atado a la URL (intercepting routes): al navegar a /types, /lists, etc.
// desde la app, se ve como modal; cerrar = volver a la ruta anterior.
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Modal } from '@/components/ui'

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export function RouteModal({
  title,
  description,
  size = 'md',
  children,
}: {
  title?: string
  description?: string
  size?: Size
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <Modal open onClose={() => router.back()} title={title} description={description} size={size}>
      {children}
    </Modal>
  )
}

'use client'
// src/components/RealtimeListener.tsx — Monta el suscriptor de Pusher.
// Se renderiza una sola vez en el árbol autenticado (dentro de React Query)
// y no pinta nada; solo mantiene viva la conexión de tiempo real.
import { usePusherTaskSync } from '@/hooks/usePusherTaskSync'

export const RealtimeListener = () => {
  usePusherTaskSync()
  return null
}

'use client'
// src/hooks/usePusherTaskSync.ts — Suscriptor de Pusher en el CLIENTE.
// Al recibir un cambio de ClickUp, invalida las queries del kanban y la carga
// del equipo para que React Query las vuelva a pedir y todo se repinte en vivo,
// y emite UNA notificación del navegador + sonido.
import { useEffect } from 'react'
import PusherClient from 'pusher-js'
import { useQueryClient } from '@tanstack/react-query'
import { taskKeys } from '@/hooks/queries/useTasks'
import { workloadKeys } from '@/hooks/queries/useWorkload'
import { requestNotificationPermission, notifyTaskChange } from '@/utils/notifications'
import { useWorkspaces } from '@/hooks/queries/useWorkspaces'

interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
  fromStatus?: string
  toStatus?: string
}

// Conexión Pusher ÚNICA a nivel de módulo. Evita que React StrictMode (dev) o
// varios montajes creen MÚLTIPLES conexiones/bindings, que era la causa de las
// notificaciones duplicadas (2 por cada cambio en ClickUp).
let pusherSingleton: PusherClient | null = null
function getPusher(key: string, cluster: string): PusherClient {
  if (!pusherSingleton) pusherSingleton = new PusherClient(key, { cluster })
  return pusherSingleton
}

// Anti-duplicados GLOBAL: ClickUp puede emitir varios eventos por un mismo cambio.
const lastNotified = { taskId: undefined as string | undefined, at: 0 }

export const usePusherTaskSync = () => {
  const queryClient = useQueryClient()
  // El cliente solo escucha el canal de SU workspace activo (aislamiento por inquilino).
  const { data: wsData } = useWorkspaces()
  const activeId = wsData?.activeId

  useEffect(() => {
    // Pedir permiso de notificaciones del navegador (si aún no se decidió).
    requestNotificationPermission()

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster || !activeId) return

    const client = getPusher(key, cluster)
    // Canal por workspace: mismo patrón que taskChannelForWorkspace() en src/lib/pusher.ts.
    const channelName = `tasks-${activeId}`
    const channel = client.subscribe(channelName)

    const handler = (payload: TaskUpdatePayload) => {
      // ClickUp no envía el nombre en el webhook; intentamos sacarlo de la caché.
      let taskName = payload?.name
      if (!taskName && payload?.taskId) {
        const data = queryClient.getQueryData<{
          clickupTasks?: Array<{ clickupId: string; name: string }>
        }>(taskKeys.clickup())
        taskName = data?.clickupTasks?.find((t) => t.clickupId === payload.taskId)?.name
      }

      // El kanban y el panel "Carga del equipo" leen en vivo → re-pedir queries.
      queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })
      queryClient.invalidateQueries({ queryKey: workloadKeys.all })

      // Anti-duplicados: si el mismo taskId llegó hace < 4s, no volver a notificar.
      const now = Date.now()
      if (lastNotified.taskId === payload?.taskId && now - lastNotified.at < 4000) {
        return
      }
      lastNotified.taskId = payload?.taskId
      lastNotified.at = now

      // "in progress" → "In Progress" (los estados de ClickUp vienen en minúsculas).
      const titleCase = (s?: string) =>
        s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s
      const label = taskName ? `"${taskName}"` : 'A task'

      // Descripción detallada: el cambio de estado si lo tenemos, si no la acción.
      let body: string
      if (payload?.event === 'taskCreated') {
        body = `${label} was created`
      } else if (payload?.event === 'taskDeleted') {
        body = `${label} was deleted`
      } else if (payload?.fromStatus && payload?.toStatus) {
        body = `${label}: ${titleCase(payload.fromStatus)} → ${titleCase(payload.toStatus)}`
      } else if (payload?.toStatus) {
        body = `${label} → ${titleCase(payload.toStatus)}`
      } else {
        body = `${label} was updated`
      }

      // UNA notificación del navegador + sonido (alert.mp3). Sin toast.
      notifyTaskChange('Assignify · ClickUp', body)
    }

    // Rebind defensivo: quita cualquier handler previo del evento antes de
    // añadir el nuevo, para que un re-montaje (StrictMode) no acumule listeners.
    channel.unbind('task-updated')
    channel.bind('task-updated', handler)

    return () => {
      // Quitamos NUESTRO handler y nos desuscribimos del canal del workspace; la
      // conexión singleton se reutiliza. Al cambiar de workspace activo, el effect
      // se re-ejecuta y deja el canal previo antes de suscribir el nuevo.
      channel.unbind('task-updated', handler)
      client.unsubscribe(channelName)
    }
  }, [queryClient, activeId])
}

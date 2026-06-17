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

interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
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

  useEffect(() => {
    // Pedir permiso de notificaciones del navegador (si aún no se decidió).
    requestNotificationPermission()

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster) return

    const client = getPusher(key, cluster)
    const channel = client.subscribe(taskKeys.all[0]) // 'tasks'

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

      const action =
        payload?.event === 'taskCreated'
          ? 'created'
          : payload?.event === 'taskDeleted'
            ? 'deleted'
            : 'updated'
      const message = taskName ? `Task "${taskName}" ${action}` : 'Task board updated'

      // UNA notificación del navegador + sonido (alert.mp3). Sin toast.
      notifyTaskChange('Assignify · ClickUp', message)
    }

    // Rebind defensivo: quita cualquier handler previo del evento antes de
    // añadir el nuevo, para que un re-montaje (StrictMode) no acumule listeners.
    channel.unbind('task-updated')
    channel.bind('task-updated', handler)

    return () => {
      // Solo quitamos NUESTRO handler; la conexión singleton se reutiliza.
      channel.unbind('task-updated', handler)
    }
  }, [queryClient])
}

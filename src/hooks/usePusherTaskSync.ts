'use client'
// src/hooks/usePusherTaskSync.ts — Suscriptor de Pusher en el CLIENTE.
// Al recibir un cambio de ClickUp, invalida la query del kanban para que
// React Query la vuelva a pedir y la lista se repinte sola en tiempo real.
import { useEffect, useRef } from 'react'
import PusherClient from 'pusher-js'
import { useQueryClient } from '@tanstack/react-query'
import { taskKeys } from '@/hooks/queries/useTasks'
import { requestNotificationPermission, notifyTaskChange } from '@/utils/notifications'

interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
}

export const usePusherTaskSync = () => {
  const queryClient = useQueryClient()
  // Evita notificaciones duplicadas cuando ClickUp manda varios eventos por un mismo cambio.
  const lastNotifiedRef = useRef<{ taskId?: string; at: number }>({ at: 0 })

  useEffect(() => {
    // Pedir permiso de notificaciones del navegador (si aún no se decidió).
    requestNotificationPermission()

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!key || !cluster) {
      console.warn('[realtime] Pusher no configurado: faltan NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER')
      return
    }

    const pusher = new PusherClient(key, { cluster })
    const channel = pusher.subscribe(taskKeys.all[0]) // 'tasks'

    channel.bind('task-updated', (payload: TaskUpdatePayload) => {
      // ClickUp no envía el nombre en el webhook; intentamos sacarlo de la caché.
      let nombre = payload?.name
      if (!nombre && payload?.taskId) {
        const data = queryClient.getQueryData<{
          clickupTasks?: Array<{ clickupId: string; name: string }>
        }>(taskKeys.clickup())
        nombre = data?.clickupTasks?.find((t) => t.clickupId === payload.taskId)?.name
      }
      // El kanban lee en vivo desde ClickUp → re-pedir la query para repintar (siempre).
      queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })

      // Anti-duplicados: si el mismo taskId llegó hace < 4s, no volver a notificar.
      const now = Date.now()
      const last = lastNotifiedRef.current
      if (last.taskId === payload?.taskId && now - last.at < 4000) {
        return
      }
      lastNotifiedRef.current = { taskId: payload?.taskId, at: now }

      const accion =
        payload?.event === 'taskCreated'
          ? 'creada'
          : payload?.event === 'taskDeleted'
          ? 'eliminada'
          : 'actualizada'
      const mensaje = nombre ? `Tarea "${nombre}" ${accion}` : 'Tablero de tareas actualizado'

      // Solo notificación del navegador + sonido (sin toast).
      notifyTaskChange('Assignify · ClickUp', mensaje)
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(taskKeys.all[0])
      pusher.disconnect()
    }
  }, [queryClient])
}

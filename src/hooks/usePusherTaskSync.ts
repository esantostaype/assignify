'use client'
// src/hooks/usePusherTaskSync.ts — Suscriptor de Pusher en el CLIENTE.
// Al recibir un cambio de ClickUp, invalida la query del kanban para que
// React Query la vuelva a pedir y la lista se repinte sola en tiempo real.
import { useEffect } from 'react'
import PusherClient from 'pusher-js'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { taskKeys } from '@/hooks/queries/useTasks'

interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
}

export const usePusherTaskSync = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
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
      // El kanban lee en vivo desde ClickUp → re-pedir la query para repintar.
      queryClient.invalidateQueries({ queryKey: taskKeys.clickup() })
      toast.info(nombre ? `Tarea "${nombre}" actualizada` : 'Tablero de tareas actualizado')
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(taskKeys.all[0])
      pusher.disconnect()
    }
  }, [queryClient])
}

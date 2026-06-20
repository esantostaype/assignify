// src/lib/pusher.ts — Cliente de Pusher para el SERVIDOR (API routes / webhook).
// Se usa para publicar eventos en tiempo real cuando ClickUp notifica cambios.
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
})

// Canal y eventos para sincronización en tiempo real (mismo canal por workspace).
export const TASKS_CHANNEL = 'tasks'
export const TASK_UPDATED_EVENT = 'task-updated'
// Cambios en las LISTAS de ClickUp (crear/editar/borrar lista del workspace).
export const LISTS_UPDATED_EVENT = 'lists-updated'

export interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
  /** Estado anterior y nuevo (de history_items) para notificar "X → Y". */
  fromStatus?: string
  toStatus?: string
}

/**
 * Canal de tareas POR workspace (aísla el realtime entre inquilinos). Sin workspace
 * → canal global (compat). El cliente arma el MISMO nombre en usePusherTaskSync.
 */
export function taskChannelForWorkspace(workspaceId?: string | null): string {
  return workspaceId ? `${TASKS_CHANNEL}-${workspaceId}` : TASKS_CHANNEL
}

/**
 * Publica un evento de actualización de tareas en el canal del workspace. No lanza si
 * Pusher falla: el realtime es una mejora, nunca debe tumbar el webhook.
 */
export async function publishTaskUpdate(
  payload: TaskUpdatePayload,
  workspaceId?: string | null
): Promise<void> {
  try {
    await pusherServer.trigger(taskChannelForWorkspace(workspaceId), TASK_UPDATED_EVENT, payload)
  } catch (err) {
    console.error('[pusher] Failed to emit task-updated:', err instanceof Error ? err.message : err)
  }
}

/**
 * Notifica que las LISTAS del workspace cambiaron en ClickUp (crear/editar/borrar)
 * para que el cliente refresque su lista de listas. No lanza si Pusher falla.
 */
export async function publishListsUpdate(workspaceId?: string | null): Promise<void> {
  try {
    await pusherServer.trigger(taskChannelForWorkspace(workspaceId), LISTS_UPDATED_EVENT, { at: Date.now() })
  } catch (err) {
    console.error('[pusher] Failed to emit lists-updated:', err instanceof Error ? err.message : err)
  }
}

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

// Canal y evento únicos para sincronización de tareas.
export const TASKS_CHANNEL = 'tasks'
export const TASK_UPDATED_EVENT = 'task-updated'

export interface TaskUpdatePayload {
  taskId?: string
  name?: string
  status?: string
  event?: string
}

/**
 * Publica un evento de actualización de tareas. No lanza si Pusher falla:
 * el realtime es una mejora, nunca debe tumbar el webhook.
 */
export async function publishTaskUpdate(payload: TaskUpdatePayload): Promise<void> {
  try {
    await pusherServer.trigger(TASKS_CHANNEL, TASK_UPDATED_EVENT, payload)
  } catch (err) {
    console.error('[pusher] Failed to emit task-updated:', err instanceof Error ? err.message : err)
  }
}

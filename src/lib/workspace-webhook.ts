// src/lib/workspace-webhook.ts  [SaaS fase 4 — webhooks por workspace]
// Registro IDEMPOTENTE del webhook de ClickUp por workspace. SOLO servidor.
// Al conectar un workspace registramos su webhook (vía la API de ClickUp con el token
// del usuario) y guardamos su secret CIFRADO; el handler lo resuelve por `?ws=`.
import axios from 'axios'
import { eq } from 'drizzle-orm'
import { API_CONFIG } from '@/config'
import { db } from '@/db'
import { workspaceWebhook } from '@/db/schema'
import { encryptSecret } from '@/lib/crypto'

// Eventos de tarea que nos interesan (mismo set que el handler).
const WEBHOOK_EVENTS = [
  'taskCreated',
  'taskUpdated',
  'taskDeleted',
  'taskStatusUpdated',
  'taskAssigneeUpdated',
  'taskPriorityUpdated',
  'taskDueDateUpdated',
  'taskMoved',
]

/** Endpoint público (estable) del webhook para un workspace, o null si no hay base. */
export function getWebhookEndpoint(workspaceId: string): string | null {
  const base = process.env.WEBHOOK_PUBLIC_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/api/clickup-webhook?ws=${encodeURIComponent(workspaceId)}`
}

/**
 * Asegura que el workspace `teamId` tenga su webhook registrado en ClickUp.
 * Idempotente (si ya hay fila, no hace nada). Usa el token (OAuth) del usuario.
 * NUNCA lanza: el registro es best-effort y no debe bloquear el login. Si no hay
 * WEBHOOK_PUBLIC_URL (local/preview), no registra (el endpoint no sería estable).
 */
export async function ensureWorkspaceWebhook(teamId: string, token: string): Promise<void> {
  try {
    const endpoint = getWebhookEndpoint(teamId)
    if (!endpoint) return

    const existing = await db.query.workspaceWebhook.findFirst({
      where: eq(workspaceWebhook.workspaceId, teamId),
    })
    if (existing) return

    const { data } = await axios.post(
      `${API_CONFIG.CLICKUP_API_BASE}/team/${teamId}/webhook`,
      { endpoint, events: WEBHOOK_EVENTS },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    const w = data?.webhook ?? data
    if (!w?.id || !w?.secret) return

    await db.insert(workspaceWebhook).values({
      workspaceId: teamId,
      webhookId: String(w.id),
      secretEnc: encryptSecret(String(w.secret)),
      endpoint,
    })
  } catch {
    /* best-effort: no bloquear el login si ClickUp falla o el webhook ya existe */
  }
}

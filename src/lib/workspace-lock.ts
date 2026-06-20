// src/lib/workspace-lock.ts  [SaaS fase 8 — concurrencia]
// Lock por WORKSPACE para SERIALIZAR la creación de tareas: si dos personas crean
// casi a la vez en el mismo workspace, la 2ª espera a que la 1ª termine y así calcula
// la fecha (y, en automático, el mejor diseñador) viendo ya la tarea de la 1ª — sin
// apilar dos tareas solapadas en el mismo miembro.
//
// Implementado sobre Turso (tabla assignment_lock) porque en serverless no hay estado
// compartido entre lambdas. Tiene TTL: un lock más viejo que TTL se considera colgado
// (p.ej. una creación que crasheó) y otro proceso puede robarlo. Si el lock falla por
// lo que sea, NO bloqueamos la creación: degradamos al comportamiento anterior.
import { sql } from 'drizzle-orm'
import { db } from '@/db'

const TTL_MS = 15_000 // un lock más viejo que esto puede robarse (creación colgada)
const MAX_WAIT_MS = 6_000 // tiempo máximo esperando el lock antes de proceder igual
const RETRY_MS = 120

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Intenta adquirir el lock. Devuelve el token (locked_at) si lo logró, o null. */
async function tryAcquire(workspaceId: string): Promise<number | null> {
  const token = Date.now()
  // 1) Adquirir si está libre (PK garantiza que solo uno gana la inserción).
  const ins = await db.run(
    sql`INSERT INTO assignment_lock (workspace_id, locked_at) VALUES (${workspaceId}, ${token})
        ON CONFLICT(workspace_id) DO NOTHING`
  )
  if ((ins.rowsAffected ?? 0) > 0) return token
  // 2) Robar si el lock vigente ya expiró (creación previa colgada).
  const upd = await db.run(
    sql`UPDATE assignment_lock SET locked_at = ${token}
        WHERE workspace_id = ${workspaceId} AND locked_at < ${token - TTL_MS}`
  )
  return (upd.rowsAffected ?? 0) > 0 ? token : null
}

/**
 * Ejecuta `fn` con el lock del workspace tomado. Si no se puede adquirir a tiempo
 * (o el lock falla), ejecuta `fn` igualmente (degradación). Libera solo SU lock
 * (por token), así no pisa un lock que otro robó si `fn` tardó más que el TTL.
 */
export async function withWorkspaceLock<T>(workspaceId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (!workspaceId) return fn()

  let token: number | null = null
  const deadline = Date.now() + MAX_WAIT_MS
  while (Date.now() < deadline) {
    try {
      token = await tryAcquire(workspaceId)
    } catch (error) {
      // Tabla ausente / DB intermitente → no bloquear la creación.
      console.error('[lock] acquire failed, proceeding without lock:', error instanceof Error ? error.message : error)
      return fn()
    }
    if (token !== null) break
    await sleep(RETRY_MS)
  }

  try {
    return await fn()
  } finally {
    if (token !== null) {
      try {
        await db.run(
          sql`DELETE FROM assignment_lock WHERE workspace_id = ${workspaceId} AND locked_at = ${token}`
        )
      } catch {
        /* best-effort: si no se borra, el TTL lo libera */
      }
    }
  }
}

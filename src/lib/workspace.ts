// src/lib/workspace.ts  [SaaS fase 2]
// Resuelve el workspace ACTIVO de la request (SOLO servidor). Toda query de config
// debe filtrarse por este id para aislar inquilinos.
//   - Si el usuario inició sesión con ClickUp → su clickup_connection.workspaceId.
//   - Si entró con email/password (admin actual) → DEFAULT_WORKSPACE_ID (Inszone),
//     así el single-tenant sigue viendo su data tras el scoping.
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { clickupConnection } from '@/db/schema'
import { decryptSecret } from '@/lib/crypto'

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const session = await auth()
  const uid = session?.user?.id
  if (uid) {
    const conn = await db.query.clickupConnection.findFirst({
      where: eq(clickupConnection.clickupUserId, uid),
    })
    if (conn?.workspaceId) return conn.workspaceId
  }
  return process.env.DEFAULT_WORKSPACE_ID ?? null
}

/**
 * [SaaS fase 3] Contexto de ClickUp de la request: el TOKEN con el que llamar a la
 * API de ClickUp y el `teamId` (workspace) al que acotar.
 *   - Usuario logueado con ClickUp → su token (descifrado) + su workspace.
 *   - Admin email/password → token global (CLICKUP_API_TOKEN) + DEFAULT_WORKSPACE_ID.
 * Así un inquilino solo ve/crea en SU propio ClickUp.
 */
export async function getCurrentClickUpContext(): Promise<{
  token: string | undefined
  teamId: string | null
}> {
  const session = await auth()
  const uid = session?.user?.id
  if (uid) {
    const conn = await db.query.clickupConnection.findFirst({
      where: eq(clickupConnection.clickupUserId, uid),
    })
    if (conn?.accessTokenEnc) {
      try {
        return { token: decryptSecret(conn.accessTokenEnc), teamId: conn.workspaceId ?? null }
      } catch {
        /* token corrupto: cae al global */
      }
    }
  }
  return { token: process.env.CLICKUP_API_TOKEN, teamId: process.env.DEFAULT_WORKSPACE_ID ?? null }
}

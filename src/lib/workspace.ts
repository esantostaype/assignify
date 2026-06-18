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

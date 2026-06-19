// src/app/api/workspaces/route.ts  [SaaS fase 4 — selector multi-workspace]
// Lista los workspaces de ClickUp que el usuario autorizó y permite cambiar el ACTIVO
// (el que aísla su data). El activo vive en clickup_connection.workspaceId, que es lo
// que leen getCurrentWorkspaceId/getCurrentClickUpContext.
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { clickupConnection } from '@/db/schema'

export const dynamic = 'force-dynamic'

/** GET → { workspaces: [{id,name}], activeId } del usuario actual. */
export async function GET() {
  const session = await auth()
  const uid = session?.user?.id
  if (uid) {
    const conn = await db.query.clickupConnection.findFirst({
      where: eq(clickupConnection.clickupUserId, uid),
    })
    if (conn) {
      // Conn antigua (anterior a la migración): sin `workspaces` pero con un activo →
      // devolvemos ese como lista de 1; la lista completa se rellena al re-loguear.
      const workspaces =
        conn.workspaces && conn.workspaces.length
          ? conn.workspaces
          : conn.workspaceId
            ? [{ id: conn.workspaceId, name: conn.workspaceName }]
            : []
      return NextResponse.json({ workspaces, activeId: conn.workspaceId ?? null })
    }
  }
  // Admin email/password (sin conexión ClickUp): no hay selector, opera el default.
  return NextResponse.json({ workspaces: [], activeId: process.env.DEFAULT_WORKSPACE_ID ?? null })
}

/** PATCH { workspaceId } → fija el workspace activo (debe ser uno autorizado). */
export async function PATCH(req: Request) {
  const session = await auth()
  const uid = session?.user?.id
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = (await req.json()) as { workspaceId?: string }
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  const conn = await db.query.clickupConnection.findFirst({
    where: eq(clickupConnection.clickupUserId, uid),
  })
  if (!conn) return NextResponse.json({ error: 'No ClickUp connection for this user' }, { status: 403 })

  // Solo se puede activar un workspace que el usuario realmente autorizó (anti-fuga).
  const target = (conn.workspaces ?? []).find((w) => w.id === workspaceId)
  if (!target) {
    return NextResponse.json({ error: 'Workspace not authorized for this user' }, { status: 403 })
  }

  await db
    .update(clickupConnection)
    .set({ workspaceId: target.id, workspaceName: target.name, updatedAt: new Date() })
    .where(eq(clickupConnection.clickupUserId, uid))

  return NextResponse.json({ activeId: target.id })
}

// src/app/api/users/[userId]/route.ts
// CRUD del recurso usuario:
//   - GET    → detalle completo (roles + vacaciones)
//   - PATCH  → actualizar campos editables (nivel, activo/inactivo)
//   - DELETE → desincronizar: quitar el miembro (y sus roles/vacaciones) del workspace
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user, userRole, userVacation } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { Level } from '@/db/enums'
import { invalidateAllCache } from '@/utils/cache'
import { getCurrentWorkspaceId } from '@/lib/workspace'

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    userId: string
  }
}

/**
 * GET /api/users/[userId]
 * Detalle completo del usuario (roles + vacaciones).
 *
 * Usa la API relacional de Drizzle. Antes se ensamblaba a mano porque, con el
 * cliente libSQL reutilizado, la query relacional devolvía datos obsoletos;
 * ahora las lecturas son frescas (no-store en `@/db`), así que `findFirst` con
 * `with` es seguro. Mantiene la MISMA forma de respuesta: user con
 * roles[{id,userId,typeId,brandId,isPrimary,type{id,name},brand{id,name}}] y
 * vacations[].
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // [SaaS] El mismo userId (id de ClickUp) puede existir en varios workspaces (PK
    // compuesto). Acotamos al workspace activo para devolver al usuario correcto y SUS roles.
    const wsId = await getCurrentWorkspaceId()
    const result = await db.query.user.findFirst({
      where: and(eq(user.id, userId), eq(user.workspaceId, wsId ?? '__none__')),
      with: {
        roles: {
          with: {
            type: { columns: { id: true, name: true } },
            brand: { columns: { id: true, name: true } },
          },
        },
        vacations: {
          orderBy: asc(userVacation.startDate),
        },
      },
    })

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error loading user details:', error)

    return NextResponse.json(
      {
        error: 'Internal server error loading user details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[userId]
 * Actualiza campos del usuario. Hoy solo `level` (JUNIOR/MID/SENIOR).
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const body = await req.json()

    // Campos editables: level (JUNIOR/MID/SENIOR) y/o active (activar/desactivar).
    const updates: { level?: Level; active?: boolean } = {}
    if (body.level !== undefined) {
      const levelParam = String(body.level).toUpperCase()
      if (!['JUNIOR', 'MID', 'SENIOR'].includes(levelParam)) {
        return NextResponse.json({ error: 'level inválido. Use JUNIOR, MID o SENIOR.' }, { status: 400 })
      }
      updates.level = levelParam as Level
    }
    if (body.active !== undefined) {
      updates.active = !!body.active
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar (level o active).' }, { status: 400 })
    }

    // [SaaS] Acotar al workspace activo (el mismo userId puede existir en varios).
    const wsId = await getCurrentWorkspaceId()
    const [updated] = await db
      .update(user)
      .set(updates)
      .where(and(eq(user.id, userId), eq(user.workspaceId, wsId ?? '__none__')))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // El nivel afecta la asignación automática: limpiar el cache del motor.
    invalidateAllCache()

    console.log(`✅ Nivel actualizado para ${updated.name} (${updated.id}): ${updated.level}`)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('❌ Error updating user:', error)
    return NextResponse.json(
      {
        error: 'Internal server error updating user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[userId]
 * Desincroniza al miembro del workspace activo: borra sus roles y vacaciones y luego el
 * miembro. No toca ClickUp (es la fuente); se puede volver a sincronizar después.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const wsId = await getCurrentWorkspaceId()
    const scope = and(eq(user.id, userId), eq(user.workspaceId, wsId ?? '__none__'))

    // Borrar primero las dependencias (roles, vacaciones) del miembro EN este workspace.
    await db.delete(userRole).where(and(eq(userRole.userId, userId), eq(userRole.workspaceId, wsId ?? '__none__')))
    await db.delete(userVacation).where(and(eq(userVacation.userId, userId), eq(userVacation.workspaceId, wsId ?? '__none__')))

    const removed = await db.delete(user).where(scope).returning()
    if (removed.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    invalidateAllCache()
    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error('❌ Error removing user:', error)
    return NextResponse.json(
      {
        error: 'Internal server error removing user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

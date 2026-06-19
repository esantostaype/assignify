// src/app/api/users/[userId]/route.ts
// CRUD del recurso usuario:
//   - GET   → detalle completo (roles + vacaciones)
//   - PATCH → actualizar campos editables (por ahora: el nivel)
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user, userVacation } from '@/db/schema'
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
    const levelParam = String(body.level || '').toUpperCase()

    if (!['JUNIOR', 'MID', 'SENIOR'].includes(levelParam)) {
      return NextResponse.json(
        { error: 'level inválido. Use JUNIOR, MID o SENIOR.' },
        { status: 400 }
      )
    }

    const level = levelParam as Level

    // [SaaS] Acotar al workspace activo (el mismo userId puede existir en varios).
    const wsId = await getCurrentWorkspaceId()
    const [updated] = await db
      .update(user)
      .set({ level })
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

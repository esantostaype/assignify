// src/app/api/users/[userId]/route.ts
// PATCH para actualizar campos editables del usuario (por ahora: el nivel).
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Level } from '@/db/enums'
import { invalidateAllCache } from '@/utils/cache'

// Escribe en la DB en vivo: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    userId: string
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

    const [updated] = await db
      .update(user)
      .set({ level })
      .where(eq(user.id, userId))
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

// src/app/api/onboarding/route.ts  [SaaS fase 5 — onboarding]
// Flag POR WORKSPACE de si ya se mostró/completó el wizard de onboarding. Se guarda
// como una fila de system_settings (category 'onboarding'), igual que la unidad de tiers.
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { systemSettings } from '@/db/schema'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const CATEGORY = 'onboarding'
const KEY = 'completed'

async function findFlag(wsId: string | null) {
  return db.query.systemSettings.findFirst({
    where: and(
      eq(systemSettings.workspaceId, wsId ?? '__none__'),
      eq(systemSettings.category, CATEGORY),
      eq(systemSettings.key, KEY)
    ),
  })
}

/** GET → { completed } del workspace activo (fallback false). */
export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId()
    const row = await findFlag(wsId)
    return NextResponse.json({ completed: row?.value === true || row?.value === 'true' })
  } catch (error) {
    // Ante cualquier fallo, no bloquear la app: asumir completado (no mostrar wizard).
    console.error('Error reading onboarding flag:', error)
    return NextResponse.json({ completed: true })
  }
}

/** PATCH { completed } → marca el onboarding como completado/saltado para el workspace. */
export async function PATCH(req: Request) {
  try {
    const wsId = await getCurrentWorkspaceId()
    const { completed } = (await req.json()) as { completed?: boolean }
    const value = !!completed

    const existing = await findFlag(wsId)
    if (existing) {
      await db.update(systemSettings).set({ value }).where(eq(systemSettings.id, existing.id))
    } else {
      await db.insert(systemSettings).values({
        category: CATEGORY,
        key: KEY,
        value,
        dataType: 'boolean',
        label: 'Onboarding completed',
        description: 'Whether the workspace onboarding wizard was completed or skipped',
        group: 'onboarding',
        order: 0,
        required: false,
        workspaceId: wsId,
      })
    }
    return NextResponse.json({ completed: value })
  } catch (error) {
    console.error('Error updating onboarding flag:', error)
    return NextResponse.json(
      { error: 'Internal server error updating onboarding flag', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

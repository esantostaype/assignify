import { NextResponse } from 'next/server'
import { db } from '@/db'
import { holiday } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { invalidateHolidays, parseHolidayInput } from '@/services/holidays.service'

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

// PATCH → edita un feriado (fila completa) acotado al workspace activo.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid holiday ID' }, { status: 400 })
    }

    const parsed = parseHolidayInput(await request.json())
    if (typeof parsed === 'string') {
      return NextResponse.json({ error: parsed }, { status: 400 })
    }

    const wsId = await getCurrentWorkspaceId()
    const scope = and(eq(holiday.id, id), eq(holiday.workspaceId, wsId ?? '__none__'))

    const existing = await db.select({ id: holiday.id }).from(holiday).where(scope)
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    const [updated] = await db.update(holiday).set(parsed).where(scope).returning()
    invalidateHolidays(wsId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 })
  }
}

// DELETE → elimina un feriado acotado al workspace activo.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Invalid holiday ID' }, { status: 400 })
    }

    const wsId = await getCurrentWorkspaceId()
    const scope = and(eq(holiday.id, id), eq(holiday.workspaceId, wsId ?? '__none__'))

    const existing = await db.select({ id: holiday.id }).from(holiday).where(scope)
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }

    await db.delete(holiday).where(scope)
    invalidateHolidays(wsId)
    return NextResponse.json({ message: 'Holiday deleted successfully' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}

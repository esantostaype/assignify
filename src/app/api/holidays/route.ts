import { NextResponse } from 'next/server'
import { db } from '@/db'
import { holiday } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { invalidateHolidays, parseHolidayInput } from '@/services/holidays.service'

// Lee/escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

// GET → feriados del workspace activo, ordenados (mes, día, año; recurrentes primero).
export async function GET() {
  try {
    const wsId = await getCurrentWorkspaceId()
    const rows = await db
      .select()
      .from(holiday)
      .where(eq(holiday.workspaceId, wsId ?? '__none__'))
    rows.sort(
      (a, b) => a.month - b.month || a.day - b.day || (a.year ?? 0) - (b.year ?? 0)
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

// POST → crea un feriado en el workspace activo.
export async function POST(request: Request) {
  try {
    const parsed = parseHolidayInput(await request.json())
    if (typeof parsed === 'string') {
      return NextResponse.json({ error: parsed }, { status: 400 })
    }

    const wsId = await getCurrentWorkspaceId()
    const [created] = await db
      .insert(holiday)
      .values({ ...parsed, workspaceId: wsId })
      .returning()

    invalidateHolidays(wsId)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating holiday:', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

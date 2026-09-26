// src/app/api/reports/created/route.ts
// Reporte de tareas creadas por mes (intake), con fecha de creación EFECTIVA que
// deshace el reseteo de date_created por la migración de workspace.
import { NextResponse } from 'next/server'
import { getCurrentClickUpContext } from '@/lib/workspace'
import { fetchCreatedSeries } from '@/services/clickup-reports.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { token, teamId } = await getCurrentClickUpContext()
  if (!token) {
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN is not configured' }, { status: 500 })
  }

  const sp = new URL(request.url).searchParams
  const assignees = sp.get('assignees')
  const assigneeIds = assignees ? assignees.split(',').filter(Boolean) : null
  const from = sp.get('from') ? Number(sp.get('from')) : null
  const to = sp.get('to') ? Number(sp.get('to')) : null

  try {
    const series = await fetchCreatedSeries({ token, teamId, assigneeIds, from, to })
    return NextResponse.json(series)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to build report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// src/app/api/reports/tasks-created/route.ts
// Reporte de tareas creadas por mes (histórico completo de ClickUp).
import { NextResponse } from 'next/server'
import { getCurrentClickUpContext } from '@/lib/workspace'
import { fetchWorkloadSeries } from '@/services/clickup-reports.service'

// Se lee en vivo de ClickUp: nunca pre-renderizar/cachear en build.
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
    const series = await fetchWorkloadSeries({ token, teamId, assigneeIds, from, to })
    return NextResponse.json(series)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

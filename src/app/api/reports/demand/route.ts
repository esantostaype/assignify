// src/app/api/reports/demand/route.ts
// Reporte híbrido: días de trabajo (peso) por mes de creación efectiva.
import { NextResponse } from 'next/server'
import { getCurrentClickUpContext } from '@/lib/workspace'
import { fetchDemandSeries } from '@/services/clickup-reports.service'

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
    const series = await fetchDemandSeries({ token, teamId, assigneeIds, from, to })
    return NextResponse.json(series)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to build report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// src/app/api/sync/clickup-tasks/bulk/route.ts
// Sincronización masiva: trae todas las tareas activas de ClickUp y las upsertea en la DB.
import { NextResponse } from 'next/server'
import { bulkSyncAllTasks } from '@/services/clickup-sync.service'

export async function POST() {
  try {
    const summary = await bulkSyncAllTasks()
    return NextResponse.json({
      success: true,
      created: summary.created,
      updated: summary.updated,
      completed: summary.completed,
      skipped: summary.skipped,
      total: summary.total,
    })
  } catch (error) {
    console.error('❌ Error en sync masiva:', error)
    return NextResponse.json(
      { error: 'bulk sync failed', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

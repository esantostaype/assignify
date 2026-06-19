// src/app/api/cron/complete-stale-approvals/route.ts
//
// Cron diario: auto-completa en ClickUp las tareas "On Approval" cuyo deadline
// (due_date) ya pasó hace MÁS de N días, SALVO que tengan el tag `keep`.
//
// [SaaS] La función es CONFIGURABLE POR WORKSPACE (Settings → "Approvals"):
//   - `auto_complete_enabled` (on/off): si está off, ese workspace se omite.
//   - `auto_complete_days`: cuántos días tras el deadline esperar (def. 14).
//   Se agrupan los brands por workspace y cada uno usa SU config.
//
// - Fuente de listas: brands ACTIVOS en Turso (brand.id === list.id de ClickUp).
// - Lee tareas EN VIVO de ClickUp por lista (axios) y detecta las que mapean a
//   'ON_APPROVAL' con mapClickUpStatusToLocal.
// - Marca COMPLETE con PUT /task/{id}. El nombre del estado complete se obtiene
//   de getClickUpStatusName(Status.COMPLETE) ('complete'); si ClickUp lo rechaza
//   se reintenta con 'closed'.
// - Protección opcional: si CRON_SECRET está definido, exige
//   `Authorization: Bearer <CRON_SECRET>` (Vercel Cron lo envía).
import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { db } from '@/db'
import { brand } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { API_CONFIG } from '@/config'
import { mapClickUpStatusToLocal } from '@/utils/clickup-status-mapping-utils'
import { getClickUpStatusName } from '@/utils/clickup-task-mapping-utils'
import { getApprovalSettings } from '@/services/app-settings.service'
import { Status } from '@/db/enums'

export const dynamic = 'force-dynamic'

const BASE = API_CONFIG.CLICKUP_API_BASE
const DAY_MS = 24 * 60 * 60 * 1000

// Nombre del estado "complete" a enviar a ClickUp. Preferimos el del mapeo del
// proyecto; mantenemos 'closed' como reintento por si una lista nombra distinto
// su estado final.
const PRIMARY_COMPLETE_STATUS = getClickUpStatusName(Status.COMPLETE) // 'complete'
const FALLBACK_COMPLETE_STATUSES = ['closed', 'done', 'completed'].filter(
  (s) => s.toLowerCase() !== PRIMARY_COMPLETE_STATUS.toLowerCase()
)

function authHeaders(token: string) {
  return { Authorization: token, 'Content-Type': 'application/json' }
}

/** ¿Alguno de los tags de la tarea es "keep" (case-insensitive)? */
function hasKeepTag(task: any): boolean {
  return (task.tags || []).some(
    (tag: any) => (tag?.name || '').toLowerCase().trim() === 'keep'
  )
}

/** PUT a ClickUp para cambiar el estado; prueba el primario y luego fallbacks. */
async function setTaskStatus(
  taskId: string,
  token: string
): Promise<string | null> {
  const candidates = [PRIMARY_COMPLETE_STATUS, ...FALLBACK_COMPLETE_STATUSES]
  for (const status of candidates) {
    try {
      await axios.put(
        `${BASE}/task/${taskId}`,
        { status },
        { headers: authHeaders(token) }
      )
      return status
    } catch {
      // Estado no válido para esta lista: probamos el siguiente candidato.
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  // 1) Auth opcional por CRON_SECRET.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const token = process.env.CLICKUP_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'CLICKUP_API_TOKEN is not configured' },
      { status: 500 }
    )
  }

  const now = Date.now()

  try {
    // 2) Listas = brands activos en Turso (con su workspace para aplicar la config por inquilino).
    const brands = await db.query.brand.findMany({
      columns: { id: true, name: true, workspaceId: true },
      where: eq(brand.isActive, true),
    })

    // Agrupar por workspace: cada inquilino define on/off + días por su cuenta.
    const byWorkspace = new Map<string, typeof brands>()
    for (const b of brands) {
      const ws = b.workspaceId ?? '__none__'
      const list = byWorkspace.get(ws)
      if (list) list.push(b)
      else byWorkspace.set(ws, [b])
    }

    let reviewed = 0 // tareas ON_APPROVAL revisadas
    let completed = 0 // tareas marcadas como completadas
    const completedTasks: Array<{
      id: string
      name: string
      brand: string
      status: string
    }> = []
    const errors: Array<{ taskId: string; name: string; reason: string }> = []
    const workspacesProcessed: Array<{ workspaceId: string; days: number }> = []
    const workspacesSkipped: string[] = [] // función desactivada para ese workspace

    for (const [workspaceId, wsBrands] of byWorkspace) {
      // Config de ESTE workspace. Si está desactivada, se omite por completo.
      const cfg = await getApprovalSettings(workspaceId === '__none__' ? null : workspaceId)
      if (!cfg.enabled) {
        workspacesSkipped.push(workspaceId)
        continue
      }
      const thresholdMs = cfg.days * DAY_MS
      workspacesProcessed.push({ workspaceId, days: cfg.days })

      for (const b of wsBrands) {
        let listTasks: any[] = []
        try {
          const { data } = await axios.get(
            `${BASE}/list/${b.id}/task?archived=false&include_closed=false&subtasks=true`,
            { headers: authHeaders(token) }
          )
          listTasks = data.tasks || []
        } catch {
          // Lista inaccesible (sin permisos / no existe): la omitimos sin abortar.
          continue
        }

        for (const t of listTasks) {
          const statusStr = t.status?.status || ''
          if (mapClickUpStatusToLocal(statusStr) !== 'ON_APPROVAL') continue

          reviewed++

          // Necesita due_date.
          if (!t.due_date) continue
          const dueMs = parseInt(t.due_date, 10)
          if (Number.isNaN(dueMs)) continue

          // ¿El deadline pasó hace más de los días configurados de este workspace?
          if (dueMs + thresholdMs >= now) continue

          // ¿Tiene el tag `keep`? -> no tocar.
          if (hasKeepTag(t)) continue

          const applied = await setTaskStatus(t.id, token)
          if (applied) {
            completed++
            completedTasks.push({
              id: t.id,
              name: t.name,
              brand: b.name,
              status: applied,
            })
          } else {
            errors.push({
              taskId: t.id,
              name: t.name,
              reason: 'Could not apply any valid complete status',
            })
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      reviewedOnApproval: reviewed,
      completed,
      completedTasks,
      completedNames: completedTasks.map((c) => c.name),
      errors,
      brandsChecked: brands.length,
      workspacesProcessed,
      workspacesSkipped,
      ranAt: new Date(now).toISOString(),
    })
  } catch (error: any) {
    console.error('complete-stale-approvals error:', error?.message || error)
    return NextResponse.json(
      { error: 'Failed to complete stale approvals' },
      { status: 500 }
    )
  }
}

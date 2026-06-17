/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/clickup-sync.service.ts
// Sincroniza tareas de ClickUp hacia la DB local (usado por el webhook y la sync masiva).
// Mapeo: brand = task.list.id; tier/type por defecto al crear (se preservan si la tarea ya existe).
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status } from '@prisma/client'
import { API_CONFIG } from '@/config'
import { mapClickUpStatusToLocal, mapClickUpPriority } from '@/utils/clickup-status-mapping-utils'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export type SyncOutcome = 'created' | 'updated' | 'completed' | 'deleted' | 'skipped'
export interface SyncResult {
  outcome: SyncOutcome
  taskId: string
  name?: string
  reason?: string
}

async function fetchClickUpTask(taskId: string): Promise<any | null> {
  if (!CLICKUP_TOKEN) return null
  try {
    const res = await axios.get(`${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`, {
      headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' },
    })
    return res.data
  } catch {
    return null
  }
}

async function resolveDefaults(): Promise<{ tierId: number | null; typeId: number | null }> {
  const [defaultTier, defaultType] = await Promise.all([
    prisma.tierList.findFirst({ where: { name: 'D' } }),
    prisma.taskType.findFirst({ where: { name: 'General Design' } }),
  ])
  const typeId = defaultType?.id ?? (await prisma.taskType.findFirst())?.id ?? null
  return { tierId: defaultTier?.id ?? null, typeId }
}

async function syncAssignees(taskId: string, assignees: any[]): Promise<void> {
  const ids: string[] = []
  for (const a of assignees || []) {
    const uid = String(a.id)
    const user = await prisma.user.findUnique({ where: { id: uid } })
    if (user) ids.push(uid)
  }
  await prisma.taskAssignment.deleteMany({ where: { taskId } })
  if (ids.length) {
    await prisma.taskAssignment.createMany({
      data: ids.map((userId) => ({ taskId, userId })),
      skipDuplicates: true,
    })
  }
}

/**
 * Crea o actualiza una tarea local a partir de su versión en ClickUp.
 * Pasa `prefetched` para evitar un fetch extra (útil en la sync masiva).
 */
export async function upsertTaskFromClickUp(taskId: string, prefetched?: any): Promise<SyncResult> {
  const ct = prefetched ?? (await fetchClickUpTask(taskId))
  if (!ct) return { outcome: 'skipped', taskId, reason: 'no encontrada en ClickUp' }

  const localStatus = mapClickUpStatusToLocal(ct.status?.status || '')

  // Completada en ClickUp: marcar si existe localmente; si no, ignorar.
  if (localStatus === null) {
    const existing = await prisma.task.findUnique({ where: { id: taskId } })
    if (existing) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'COMPLETE' as Status, syncStatus: 'SYNCED', lastSyncAt: new Date() },
      })
      return { outcome: 'completed', taskId, name: ct.name }
    }
    return { outcome: 'skipped', taskId, name: ct.name, reason: 'completada' }
  }

  if (!ct.start_date || !ct.due_date) {
    return { outcome: 'skipped', taskId, name: ct.name, reason: 'sin fecha de inicio/entrega' }
  }

  const listId = ct.list?.id
  const brand = listId ? await prisma.brand.findUnique({ where: { id: listId } }) : null
  if (!brand) {
    return { outcome: 'skipped', taskId, name: ct.name, reason: `lista ${listId} no mapea a un brand` }
  }

  const baseData = {
    name: ct.name,
    description: ct.description || ct.text_content || null,
    status: localStatus as Status,
    priority: mapClickUpPriority(ct.priority?.priority),
    startDate: new Date(parseInt(ct.start_date)),
    deadline: new Date(parseInt(ct.due_date)),
    timeEstimate: ct.time_estimate ? Math.round(ct.time_estimate / 3600000) : null,
    url: ct.url ?? null,
    brandId: brand.id,
    lastSyncAt: new Date(),
    syncStatus: 'SYNCED',
  }

  const existing = await prisma.task.findUnique({ where: { id: taskId } })

  if (existing) {
    // No tocamos tierId/typeId: se preserva la categorización existente.
    await prisma.task.update({ where: { id: taskId }, data: baseData })
    await syncAssignees(taskId, ct.assignees)
    return { outcome: 'updated', taskId, name: ct.name }
  }

  const { tierId, typeId } = await resolveDefaults()
  if (!tierId || !typeId) {
    return { outcome: 'skipped', taskId, name: ct.name, reason: 'no hay tier/type por defecto (¿falta seed?)' }
  }

  await prisma.task.create({ data: { id: taskId, ...baseData, tierId, typeId } })
  await syncAssignees(taskId, ct.assignees)
  return { outcome: 'created', taskId, name: ct.name }
}

/** Marca una tarea como eliminada/completada cuando se borra en ClickUp. */
export async function markTaskDeleted(taskId: string): Promise<SyncResult> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing) return { outcome: 'skipped', taskId, reason: 'no existe localmente' }
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'COMPLETE' as Status, syncStatus: 'DELETED', lastSyncAt: new Date() },
  })
  return { outcome: 'deleted', taskId }
}

export interface BulkSyncSummary {
  created: number
  updated: number
  completed: number
  skipped: number
  total: number
  details: SyncResult[]
}

/** Recorre las listas de cada brand activo y sincroniza todas sus tareas activas. */
export async function bulkSyncAllTasks(): Promise<BulkSyncSummary> {
  const summary: BulkSyncSummary = { created: 0, updated: 0, completed: 0, skipped: 0, total: 0, details: [] }
  if (!CLICKUP_TOKEN) return summary

  const brands = await prisma.brand.findMany({ where: { isActive: true } })

  for (const brand of brands) {
    let page = 0
    let hasMore = true
    while (hasMore && page < 20) {
      let tasks: any[] = []
      try {
        const res = await axios.get(`${API_CONFIG.CLICKUP_API_BASE}/list/${brand.id}/task`, {
          headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' },
          params: { archived: false, page, include_closed: false, subtasks: true },
        })
        tasks = res.data.tasks || []
      } catch {
        break
      }

      for (const ct of tasks) {
        const r = await upsertTaskFromClickUp(ct.id, ct)
        summary.total++
        if (r.outcome === 'created') summary.created++
        else if (r.outcome === 'updated') summary.updated++
        else if (r.outcome === 'completed') summary.completed++
        else summary.skipped++
        summary.details.push(r)
      }

      hasMore = tasks.length >= 100
      page++
    }
  }

  return summary
}

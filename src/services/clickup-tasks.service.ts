/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/clickup-tasks.service.ts
// Lee las tareas ACTIVAS (con fechas) en vivo de ClickUp. Es la fuente única que
// alimenta tanto el tablero como el panel de "Carga del equipo", de modo que
// ambos muestren exactamente lo mismo (sin depender de la copia local).
import axios from 'axios'
import { inArray } from 'drizzle-orm'
import { API_CONFIG } from '@/config'
import { db } from '@/db'
import { taskMeta } from '@/db/schema'
import { getFromCache, setInCache, invalidateCacheByPrefix } from '@/utils/cache'
import {
  mapClickUpStatusToLocal,
  isActiveTaskStatus,
  getValidLocalStatuses,
  type LocalTaskStatus,
} from '@/utils/clickup-status-mapping-utils'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

// El crawl de ClickUp (team→space→folder→list, paginado) es CARO y lo consumen el
// kanban, el panel de carga y el motor. Se cachea brevemente para que esas vistas
// compartan UNA sola lectura en lugar de recorrer la API en cada request. La clave
// incluye el teamId → caché POR workspace (multi-inquilino). Se invalida al crear y
// desde el webhook.
const ACTIVE_TASKS_CACHE_PREFIX = 'active-clickup-tasks:'
const ACTIVE_TASKS_TTL_SECONDS = 45

/** [SaaS] Token + workspace con los que leer ClickUp (ver getCurrentClickUpContext). */
export interface ClickUpFetchOptions {
  /** Token de ClickUp. Default: el global (CLICKUP_API_TOKEN). */
  token?: string
  /** Acota el crawl a ESTE team/workspace. Default: todos los del token. */
  teamId?: string | null
}

/** Invalida la caché del crawl de ClickUp (todos los workspaces). */
export function invalidateActiveClickUpTasksCache(): void {
  invalidateCacheByPrefix(ACTIVE_TASKS_CACHE_PREFIX)
}

export interface ClickUpAssignee {
  id: string
  name: string
  email: string
  initials: string
  color: string
}

export interface ActiveClickUpTask {
  clickupId: string
  name: string
  status: LocalTaskStatus
  priority: string
  priorityColor: string
  assignees: ClickUpAssignee[]
  startDate: string
  dueDate: string
  list: { id: string; name: string }
  space: { id: string; name: string }
  url: string
  tags: string[]
  // Duración REAL (días) si la tarea fue creada por Assignify (de task_meta).
  // `undefined` para tareas creadas directo en ClickUp → el motor usa un fallback.
  durationDays?: number
}

async function cu(path: string, token: string): Promise<any> {
  const res = await axios.get(`${API_CONFIG.CLICKUP_API_BASE}${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  })
  return res.data
}

// Una tarea entra si está activa (no completada), mapea a un estado válido y tiene fechas.
function isSyncableTask(t: any): boolean {
  // Tareas "Ongoing" (continuas, sin fecha fija): se marcan con el tag `ongoing`
  // en ClickUp. No son asignables (deadline lejano/cambiante), así que las
  // excluimos para que ni el motor de asignación, ni el panel de carga, ni el
  // kanban las consideren.
  const isOngoing = (t.tags || []).some(
    (tag: any) => (tag?.name || '').toLowerCase() === 'ongoing'
  )
  if (isOngoing) return false

  const s = t.status?.status || ''
  const sType = t.status?.type || ''
  if (!isActiveTaskStatus(s, sType)) return false
  const mapped = mapClickUpStatusToLocal(s, sType)
  const valid = mapped !== null && getValidLocalStatuses().includes(mapped)
  return valid && !!t.start_date && !!t.due_date
}

async function collectListTasks(listId: string, out: any[], token: string): Promise<void> {
  try {
    let page = 0
    let hasMore = true
    while (hasMore && page < 5) {
      const data = await cu(
        `/list/${listId}/task?archived=false&page=${page}&order_by=updated&reverse=true&subtasks=true&include_closed=false`,
        token
      )
      const tasks: any[] = data.tasks || []
      out.push(...tasks.filter(isSyncableTask))
      hasMore = tasks.length >= 100
      page++
    }
  } catch {
    // Lista inaccesible: la omitimos sin abortar el resto.
  }
}

/**
 * Devuelve las tareas activas (con fechas) de ClickUp.
 * [SaaS] Con `opts.token` usa el token de ESE usuario; con `opts.teamId` acota el
 * crawl a ESE workspace. Sin opts → token global + todos los teams (single-tenant).
 */
export async function fetchActiveClickUpTasks(opts: ClickUpFetchOptions = {}): Promise<ActiveClickUpTask[]> {
  const token = opts.token ?? CLICKUP_TOKEN
  if (!token) return []

  const cacheKey = `${ACTIVE_TASKS_CACHE_PREFIX}${opts.teamId ?? 'all'}`
  const cached = getFromCache<ActiveClickUpTask[]>(cacheKey)
  if (cached !== undefined) return cached

  const raw: any[] = []
  // Acotar a un team concreto (multi-tenant) o recorrer todos los del token.
  const teams: any[] = opts.teamId
    ? [{ id: opts.teamId }]
    : (await cu('/team', token)).teams || []

  for (const team of teams) {
    let spaces: any[] = []
    try {
      spaces = (await cu(`/team/${team.id}/space?archived=false`, token)).spaces || []
    } catch {
      continue
    }

    for (const space of spaces) {
      // Listas directas del space
      try {
        const lists: any[] = (await cu(`/space/${space.id}/list?archived=false`, token)).lists || []
        for (const list of lists) await collectListTasks(list.id, raw, token)
      } catch {
        /* sin listas directas */
      }
      // Listas dentro de folders
      try {
        const folders: any[] = (await cu(`/space/${space.id}/folder?archived=false`, token)).folders || []
        for (const folder of folders) {
          const lists: any[] = folder.lists || []
          for (const list of lists) await collectListTasks(list.id, raw, token)
        }
      } catch {
        /* sin folders */
      }
    }
  }

  // Dedup por id (las subtareas pueden aparecer en varias páginas/listas).
  const seen = new Set<string>()
  const result: ActiveClickUpTask[] = []
  for (const t of raw) {
    if (!t.id || !t.name || seen.has(t.id)) continue
    seen.add(t.id)
    result.push({
      clickupId: t.id,
      name: t.name,
      status: mapClickUpStatusToLocal(t.status?.status || '', t.status?.type || '') as LocalTaskStatus,
      priority: t.priority?.priority || 'normal',
      priorityColor: t.priority?.color || '#6366f1',
      assignees: (t.assignees || []).map((a: any) => ({
        id: a.id.toString(),
        name: a.username,
        email: a.email,
        initials: a.initials,
        color: a.color,
      })),
      startDate: new Date(parseInt(t.start_date)).toISOString(),
      dueDate: new Date(parseInt(t.due_date)).toISOString(),
      list: { id: t.list?.id ?? '', name: t.list?.name ?? '' },
      space: { id: t.space?.id ?? '', name: t.space?.name ?? '' },
      url: t.url ?? '',
      tags: (t.tags || []).map((tag: any) => tag.name),
    })
  }

  // Enriquecer con la duración REAL desde task_meta (left-join por id de ClickUp).
  // Las tareas creadas fuera de Assignify simplemente no matchean → durationDays undefined.
  const ids = result.map((r) => r.clickupId)
  if (ids.length > 0) {
    try {
      const metas = await db
        .select({ clickupTaskId: taskMeta.clickupTaskId, durationDays: taskMeta.durationDays })
        .from(taskMeta)
        .where(inArray(taskMeta.clickupTaskId, ids))
      const durationById = new Map(metas.map((m) => [m.clickupTaskId, m.durationDays]))
      for (const t of result) {
        const d = durationById.get(t.clickupId)
        if (d !== undefined) t.durationDays = d
      }
    } catch {
      // Si la DB falla, seguimos sin duración real (el motor usa su fallback).
    }
  }

  setInCache(cacheKey, result, ACTIVE_TASKS_TTL_SECONDS)
  return result
}

/**
 * Tareas activas de ClickUp asignadas a un usuario concreto.
 * Reusa `fetchActiveClickUpTasks` (cacheado) y filtra por asignado.
 * El id de ClickUp del asignado coincide con el user.id local.
 */
export async function getActiveClickUpTasksByUser(
  userId: string,
  opts: ClickUpFetchOptions = {}
): Promise<ActiveClickUpTask[]> {
  const all = await fetchActiveClickUpTasks(opts)
  return all.filter((t) => t.assignees.some((a) => a.id === userId))
}

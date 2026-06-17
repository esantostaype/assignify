/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/clickup-tasks.service.ts
// Lee las tareas ACTIVAS (con fechas) en vivo de ClickUp. Es la fuente única que
// alimenta tanto el tablero como el panel de "Carga del equipo", de modo que
// ambos muestren exactamente lo mismo (sin depender de la copia local).
import axios from 'axios'
import { API_CONFIG } from '@/config'
import {
  mapClickUpStatusToLocal,
  isActiveTaskStatus,
  getValidLocalStatuses,
  type LocalTaskStatus,
} from '@/utils/clickup-status-mapping-utils'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

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
}

async function cu(path: string): Promise<any> {
  const res = await axios.get(`${API_CONFIG.CLICKUP_API_BASE}${path}`, {
    headers: { Authorization: CLICKUP_TOKEN as string, 'Content-Type': 'application/json' },
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
  if (!isActiveTaskStatus(s)) return false
  const mapped = mapClickUpStatusToLocal(s)
  const valid = mapped !== null && getValidLocalStatuses().includes(mapped)
  return valid && !!t.start_date && !!t.due_date
}

async function collectListTasks(listId: string, out: any[]): Promise<void> {
  try {
    let page = 0
    let hasMore = true
    while (hasMore && page < 5) {
      const data = await cu(
        `/list/${listId}/task?archived=false&page=${page}&order_by=updated&reverse=true&subtasks=true&include_closed=false`
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

/** Devuelve todas las tareas activas (con fechas) de todos los spaces de ClickUp. */
export async function fetchActiveClickUpTasks(): Promise<ActiveClickUpTask[]> {
  if (!CLICKUP_TOKEN) return []

  const raw: any[] = []
  const teams: any[] = (await cu('/team')).teams || []

  for (const team of teams) {
    let spaces: any[] = []
    try {
      spaces = (await cu(`/team/${team.id}/space?archived=false`)).spaces || []
    } catch {
      continue
    }

    for (const space of spaces) {
      // Listas directas del space
      try {
        const lists: any[] = (await cu(`/space/${space.id}/list?archived=false`)).lists || []
        for (const list of lists) await collectListTasks(list.id, raw)
      } catch {
        /* sin listas directas */
      }
      // Listas dentro de folders
      try {
        const folders: any[] = (await cu(`/space/${space.id}/folder?archived=false`)).folders || []
        for (const folder of folders) {
          const lists: any[] = folder.lists || []
          for (const list of lists) await collectListTasks(list.id, raw)
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
      status: mapClickUpStatusToLocal(t.status?.status || '') as LocalTaskStatus,
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
  return result
}

/**
 * Tareas activas de ClickUp asignadas a un usuario concreto (sin caché).
 * El id de ClickUp del asignado coincide con el user.id local.
 */
export async function getActiveClickUpTasksByUser(userId: string): Promise<ActiveClickUpTask[]> {
  const all = await fetchActiveClickUpTasks()
  return all.filter((t) => t.assignees.some((a) => a.id === userId))
}

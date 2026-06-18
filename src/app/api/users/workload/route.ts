// src/app/api/users/workload/route.ts
// Carga y disponibilidad de cada diseñador (vista general, sin contexto de tarea).
// Las TAREAS se leen en vivo de ClickUp (misma fuente que el tablero) y se cruzan
// con los usuarios/roles/vacaciones locales. Así el panel siempre coincide con el
// kanban, sin depender de la copia local (que puede estar desincronizada).
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user, userRole, userVacation, taskType } from '@/db/schema'
import { eq, and, asc, gte } from 'drizzle-orm'
import { fetchActiveClickUpTasks, type ActiveClickUpTask } from '@/services/clickup-tasks.service'
import { mapClickUpPriority } from '@/utils/clickup-status-mapping-utils'
import { getCurrentWorkspaceId } from '@/lib/workspace'

// Lee ClickUp en vivo: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

export type WorkloadStatus = 'available' | 'busy' | 'overloaded' | 'on_vacation'

// Un diseñador está "sobrecargado" si su trabajo pendiente lo ocupa más allá de
// 2 semanas desde hoy.
const OVERLOAD_HORIZON_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
// Estados que cuentan como trabajo pendiente (ocupan al diseñador).
const PENDING_STATUSES = new Set(['TO_DO', 'IN_PROGRESS'])

export async function GET() {
  try {
    const now = new Date()
    const overloadThreshold = new Date(now.getTime() + OVERLOAD_HORIZON_DAYS * DAY_MS)
    const wsId = await getCurrentWorkspaceId()

    // IMPORTANTE: consultas DIRECTAS (sin la query relacional `with` de Drizzle).
    // En el dev server (cliente libSQL reusado) la versión relacional devolvía
    // roles/vacaciones/nivel OBSOLETOS; las directas siempre son frescas.
    const [activeUsers, allRoles, allTypes, futureVacations, tasks] = await Promise.all([
      db.query.user.findMany({
        where: and(eq(user.active, true), eq(user.workspaceId, wsId ?? '__none__')),
        orderBy: asc(user.name),
      }),
      db.query.userRole.findMany(),
      db.query.taskType.findMany(),
      db.query.userVacation.findMany({
        where: gte(userVacation.endDate, now),
        orderBy: asc(userVacation.startDate),
      }),
      fetchActiveClickUpTasks(),
    ])

    const typeNameById = new Map(allTypes.map((t) => [t.id, t.name]))

    // Roles (con nombre de tipo + primario) por usuario.
    const roleDetailsByUser = new Map<string, { typeName: string; isPrimary: boolean }[]>()
    for (const r of allRoles) {
      const arr = roleDetailsByUser.get(r.userId) ?? []
      arr.push({ typeName: typeNameById.get(r.typeId) ?? '', isPrimary: r.isPrimary })
      roleDetailsByUser.set(r.userId, arr)
    }

    // Vacaciones futuras/activas por usuario.
    const vacationsByUser = new Map<string, typeof futureVacations>()
    for (const v of futureVacations) {
      const arr = vacationsByUser.get(v.userId) ?? []
      arr.push(v)
      vacationsByUser.set(v.userId, arr)
    }

    // Agrupar tareas por asignado. El id de ClickUp del asignado == user.id local.
    const tasksByUser = new Map<string, ActiveClickUpTask[]>()
    for (const t of tasks) {
      for (const a of t.assignees) {
        const arr = tasksByUser.get(a.id) ?? []
        arr.push(t)
        tasksByUser.set(a.id, arr)
      }
    }

    const result = activeUsers.map((u) => {
      const userTasks = tasksByUser.get(u.id) ?? []
      // Pendientes (TO_DO / IN_PROGRESS) = carga real. ON_APPROVAL ya está entregado.
      const pendingTasks = userTasks.filter((t) => PENDING_STATUSES.has(t.status))
      const approvalCount = userTasks.filter((t) => t.status === 'ON_APPROVAL').length
      const taskCount = pendingTasks.length

      // "Se libera" = la fecha de su última entrega PENDIENTE, no antes de hoy.
      let availableFrom: Date
      if (pendingTasks.length > 0) {
        const lastDeadline = Math.max(...pendingTasks.map((t) => new Date(t.dueDate).getTime()))
        availableFrom = new Date(Math.max(lastDeadline, now.getTime()))
      } else {
        availableFrom = now
      }
      const availableInDays = Math.max(
        0,
        Math.ceil((availableFrom.getTime() - now.getTime()) / DAY_MS)
      )

      const userVacations = vacationsByUser.get(u.id) ?? []
      const currentVacation = userVacations.find(
        (v) => new Date(v.startDate) <= now && new Date(v.endDate) >= now
      )
      const upcomingVacations = userVacations.filter((v) => new Date(v.startDate) > now)

      const userRoleDetails = roleDetailsByUser.get(u.id) ?? []
      const roles = Array.from(new Set(userRoleDetails.map((r) => r.typeName)))
      const isSpecialist = roles.length === 1

      let status: WorkloadStatus
      if (currentVacation) status = 'on_vacation'
      else if (taskCount > 0 && availableFrom > overloadThreshold) status = 'overloaded'
      else if (taskCount > 0) status = 'busy'
      else status = 'available'

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        level: u.level,
        roles,
        roleDetails: userRoleDetails,
        isSpecialist,
        taskCount,
        approvalCount,
        availableFrom: availableFrom.toISOString(),
        availableInDays,
        status,
        currentVacation: currentVacation
          ? {
              startDate: currentVacation.startDate.toISOString(),
              endDate: currentVacation.endDate.toISOString(),
            }
          : null,
        upcomingVacations: upcomingVacations.map((v) => ({
          startDate: v.startDate.toISOString(),
          endDate: v.endDate.toISOString(),
        })),
        // Barras para el timeline de capacidad (ordenadas por inicio).
        pendingTasks: pendingTasks
          .slice()
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .map((t) => ({
            name: t.name,
            startDate: t.startDate,
            dueDate: t.dueDate,
            priority: mapClickUpPriority(t.priority),
            durationDays: t.durationDays,
          })),
      }
    })

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('Error en /api/users/workload:', error)
    return NextResponse.json(
      { error: 'Error al calcular la carga del equipo', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

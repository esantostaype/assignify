// src/app/api/users/workload/route.ts
// Carga y disponibilidad de cada diseñador (vista general, sin contexto de tarea).
// Las TAREAS se leen en vivo de ClickUp (misma fuente que el tablero) y se cruzan
// con los usuarios/roles/vacaciones locales. Así el panel siempre coincide con el
// kanban, sin depender de la copia local (que puede estar desincronizada).
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { getNextAvailableStart } from '@/utils/task-calculation-utils'
import { fetchActiveClickUpTasks, type ActiveClickUpTask } from '@/services/clickup-tasks.service'

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

    // Usuarios locales (roles, vacaciones) + tareas en vivo de ClickUp, en paralelo.
    const [users, tasks] = await Promise.all([
      prisma.user.findMany({
        where: { active: true },
        include: {
          roles: { include: { type: true } },
          vacations: { where: { endDate: { gte: now } }, orderBy: { startDate: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
      fetchActiveClickUpTasks(),
    ])

    // Agrupar tareas por asignado. El id de ClickUp del asignado == user.id local.
    const tasksByUser = new Map<string, ActiveClickUpTask[]>()
    for (const t of tasks) {
      for (const a of t.assignees) {
        const arr = tasksByUser.get(a.id) ?? []
        arr.push(t)
        tasksByUser.set(a.id, arr)
      }
    }

    const result = await Promise.all(
      users.map(async (u) => {
        const userTasks = tasksByUser.get(u.id) ?? []
        // Pendientes (TO_DO / IN_PROGRESS) = carga real. ON_APPROVAL ya está entregado.
        const pendingTasks = userTasks.filter((t) => PENDING_STATUSES.has(t.status))
        const approvalCount = userTasks.filter((t) => t.status === 'ON_APPROVAL').length
        const taskCount = pendingTasks.length

        // Se libera tras su última entrega pendiente (no antes de hoy); salta findes/festivos.
        let availableFrom: Date
        if (pendingTasks.length > 0) {
          const lastDeadline = Math.max(
            ...pendingTasks.map((t) => new Date(t.dueDate).getTime())
          )
          availableFrom = await getNextAvailableStart(
            new Date(Math.max(lastDeadline, now.getTime()))
          )
        } else {
          availableFrom = await getNextAvailableStart(now)
        }
        const availableInDays = Math.max(
          0,
          Math.ceil((availableFrom.getTime() - now.getTime()) / DAY_MS)
        )

        const currentVacation = u.vacations.find(
          (v) => new Date(v.startDate) <= now && new Date(v.endDate) >= now
        )
        const upcomingVacations = u.vacations.filter((v) => new Date(v.startDate) > now)

        const roles = Array.from(new Set(u.roles.map((r) => r.type.name)))
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
          roles,
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
        }
      })
    )

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('❌ Error en /api/users/workload:', error)
    return NextResponse.json(
      { error: 'Error al calcular la carga del equipo', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

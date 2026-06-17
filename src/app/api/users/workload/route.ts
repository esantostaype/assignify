// src/app/api/users/workload/route.ts
// Carga y disponibilidad de cada diseñador (vista general, sin contexto de tarea).
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { Status } from '@prisma/client'
import { getNextAvailableStart, OCCUPYING_STATUSES } from '@/utils/task-calculation-utils'

export type WorkloadStatus = 'available' | 'busy' | 'overloaded' | 'on_vacation'

// Un diseñador se considera "sobrecargado" si su trabajo pendiente lo mantiene
// ocupado más allá de 2 semanas desde hoy.
const OVERLOAD_HORIZON_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const now = new Date()
    const overloadThreshold = new Date(now.getTime() + OVERLOAD_HORIZON_DAYS * DAY_MS)

    const users = await prisma.user.findMany({
      where: { active: true },
      include: {
        roles: { include: { type: true } },
        vacations: { where: { endDate: { gte: now } }, orderBy: { startDate: 'asc' } },
        tasks: { include: { task: { include: { tier: true } } } },
      },
      orderBy: { name: 'asc' },
    })

    const result = await Promise.all(
      users.map(async (u) => {
        const allTasks = u.tasks.map((a) => a.task).filter(Boolean)

        // Solo TO_DO / IN_PROGRESS cuentan como carga real. ON_APPROVAL ya está
        // entregado (esperando revisión) → el diseñador puede tomar trabajo nuevo.
        const pendingTasks = allTasks.filter((t) => OCCUPYING_STATUSES.includes(t.status))
        const approvalCount = allTasks.filter((t) => t.status === Status.ON_APPROVAL).length

        const taskCount = pendingTasks.length
        const totalDurationDays = pendingTasks.reduce(
          (sum, t) => sum + (t.customDuration ?? t.tier?.duration ?? 0),
          0
        )

        // Se libera tras su última entrega PENDIENTE (no antes de hoy); salta
        // findes/festivos hasta el siguiente inicio laborable.
        let availableFrom: Date
        if (pendingTasks.length > 0) {
          const lastDeadline = Math.max(
            ...pendingTasks.map((t) => new Date(t.deadline).getTime())
          )
          availableFrom = await getNextAvailableStart(new Date(Math.max(lastDeadline, now.getTime())))
        } else {
          availableFrom = await getNextAvailableStart(now)
        }
        const availableInDays = Math.max(
          0,
          Math.ceil((availableFrom.getTime() - now.getTime()) / DAY_MS)
        )

        // Vacaciones: la que está en curso (si hay) y las futuras.
        const currentVacation = u.vacations.find(
          (v) => new Date(v.startDate) <= now && new Date(v.endDate) >= now
        )
        const upcomingVacations = u.vacations.filter((v) => new Date(v.startDate) > now)

        // Tipos que maneja (roles). Especialista = un solo tipo.
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
          totalDurationDays,
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

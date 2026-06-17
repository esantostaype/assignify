// src/app/api/users/workload/route.ts
// Carga y disponibilidad de cada diseñador (vista general, sin contexto de tarea).
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { Status } from '@prisma/client'
import { getNextAvailableStart } from '@/utils/task-calculation-utils'

export type WorkloadStatus = 'available' | 'busy' | 'overloaded' | 'on_vacation'

export async function GET() {
  try {
    const now = new Date()

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
        // Tareas activas (no completadas) del usuario.
        const activeTasks = u.tasks
          .map((a) => a.task)
          .filter((t) => t && t.status !== Status.COMPLETE)

        const taskCount = activeTasks.length
        const totalDurationDays = activeTasks.reduce(
          (sum, t) => sum + (t.customDuration ?? t.tier?.duration ?? 0),
          0
        )

        // Próxima fecha en que se libera (tras su última entrega; salta findes/festivos).
        let availableFrom: Date
        if (activeTasks.length > 0) {
          const lastDeadline = new Date(
            Math.max(...activeTasks.map((t) => new Date(t.deadline).getTime()))
          )
          availableFrom = await getNextAvailableStart(lastDeadline)
        } else {
          availableFrom = await getNextAvailableStart(now)
        }

        // Vacaciones: la que está en curso (si hay) y las futuras.
        const currentVacation = u.vacations.find(
          (v) => new Date(v.startDate) <= now && new Date(v.endDate) >= now
        )
        const upcomingVacations = u.vacations.filter((v) => new Date(v.startDate) > now)

        // Tipos que maneja (roles). Especialista = un solo tipo.
        const roles = Array.from(new Set(u.roles.map((r) => r.type.name)))
        const isSpecialist = roles.length === 1

        let status: WorkloadStatus = 'available'
        if (currentVacation) status = 'on_vacation'
        else if (totalDurationDays >= 10) status = 'overloaded'
        else if (totalDurationDays >= 3) status = 'busy'

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          roles,
          isSpecialist,
          taskCount,
          totalDurationDays,
          availableFrom: availableFrom.toISOString(),
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

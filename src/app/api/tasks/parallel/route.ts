/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/tasks/parallel/route.ts
// Crea una tarea SOLO en ClickUp (la DB ya no guarda tareas). El motor de
// prioridades (modelo de carriles) calcula las fechas leyendo las tareas en vivo
// de ClickUp; aquí solo se valida config, se elige diseñador y se crea en ClickUp.

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tierList, taskType as taskTypeTable, brand as brandTable, user as userTable, userRole, taskMeta } from '@/db/schema'
import { eq, and, inArray, or, isNull } from 'drizzle-orm'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { Level } from '@/db/enums'
import { getBestUserWithCache } from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { TaskCreationParams, UserWithRoles, ClickUpBrand } from '@/interfaces'
import { calculateParallelPriorityInsertion } from '@/services/parallel-priority-insertion.service'
import { invalidateAllCache } from '@/utils/cache'
import { publishTaskUpdate } from '@/lib/pusher'

// Lee DB y crea tareas en ClickUp en vivo: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    console.error('CLICKUP_API_TOKEN is not configured.')
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN is not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const {
      name,
      description,
      typeId,
      tierId,
      priority,
      brandId,
      assignedUserIds,
      durationDays,
      suggestedUserId,
    }: TaskCreationParams = body

    if (!name || !typeId || !tierId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({
        error: 'Missing required fields or invalid duration',
        required: ['name', 'typeId', 'tierId', 'priority', 'brandId', 'durationDays'],
      }, { status: 400 })
    }

    // Nivel solicitado (opcional; default MID). NO se persiste en la tarea:
    // solo decide a qué diseñador escalar en la asignación AUTOMÁTICA.
    const levelParam = String(body.level || 'MID').toUpperCase()
    const reqLevel: Level = (['JUNIOR', 'MID', 'SENIOR'].includes(levelParam)
      ? levelParam
      : 'MID') as Level

    // [SaaS] Workspace activo: toda la config se valida acotada a este inquilino.
    const wsId = await getCurrentWorkspaceId()

    // Config desde la DB (Drizzle/Turso), acotada al workspace.
    const [tier, type, brand] = await Promise.all([
      db.query.tierList.findFirst({ where: and(eq(tierList.id, tierId), eq(tierList.workspaceId, wsId ?? '__none__')) }),
      db.query.taskType.findFirst({ where: and(eq(taskTypeTable.id, typeId), eq(taskTypeTable.workspaceId, wsId ?? '__none__')) }),
      db.query.brand.findFirst({ where: and(eq(brandTable.id, brandId), eq(brandTable.workspaceId, wsId ?? '__none__')) }),
    ])

    if (!tier) return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
    if (!type) return NextResponse.json({ error: 'Task type not found' }, { status: 404 })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    // ¿La duración es personalizada (distinta a la del tier)?
    const isCustomDuration = Math.abs(durationDays - tier.duration) > 0.001

    // Determinar diseñadores a asignar.
    let usersToAssign: string[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      const specificUsersResults = await Promise.all(
        assignedUserIds.map(userId =>
          db.query.user.findFirst({
            where: and(eq(userTable.id, userId), eq(userTable.workspaceId, wsId ?? '__none__')),
            with: {
              roles: { where: or(eq(userRole.brandId, brandId), isNull(userRole.brandId)) },
            },
          })
        )
      )

      const validUsers: UserWithRoles[] = specificUsersResults.filter(
        (user): user is NonNullable<typeof user> =>
          user != null &&
          user.active &&
          user.roles.some(role => role.typeId === typeId)
      ) as UserWithRoles[]

      if (validUsers.length === 0) {
        return NextResponse.json({
          error: 'None of the specified users are compatible with this task type',
          details: 'Make sure the users exist, are active, and have compatible roles',
        }, { status: 400 })
      }

      usersToAssign = validUsers.map(user => user.id)
    } else {
      const bestUser = await getBestUserWithCache(typeId, brandId, priority, durationDays, reqLevel, wsId)

      if (!bestUser) {
        return NextResponse.json({
          error: 'Could not find an optimal designer for automatic assignment',
          details: 'No available users meet the assignment criteria considering vacations and workload',
        }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
    }

    // Calcular fechas con el modelo de carriles + vacaciones para cada usuario.
    // calculateParallelPriorityInsertion ya considera vacaciones internamente.
    const userDuration = durationDays / usersToAssign.length

    const insertionResults = await Promise.all(
      usersToAssign.map(async (userId) => {
        const result = await calculateParallelPriorityInsertion(userId, priority, userDuration)
        return { userId, ...result }
      })
    )

    // Con varios usuarios se toma la fecha más tardía (la más conservadora).
    const finalInsertion = insertionResults.reduce((latest, current) =>
      current.startDate > latest.startDate ? current : latest
    )

    const vacationAdjustments = insertionResults.filter(r => r.vacationAdjustment)

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? '',
    }

    const { clickupTaskId, clickupTaskUrl } = await createTaskInClickUp({
      name,
      description,
      priority,
      deadline: finalInsertion.deadline,
      startDate: finalInsertion.startDate,
      usersToAssign,
      tier,
      brand: brandForClickUp,
      customDurationDays: isCustomDuration ? durationDays : undefined,
    })

    // Persistir la metadata SIDECAR (write-once): lo inmutable de creación que
    // ClickUp no puede representar (tier/duración real, nivel) + el rastro de la
    // sugerencia para medir el motor. Si falla, NO rompemos la creación (la tarea ya
    // existe en ClickUp); solo lo registramos.
    try {
      await db.insert(taskMeta).values({
        clickupTaskId,
        typeId,
        tierId,
        durationDays,
        brandId,
        priority,
        requestedLevel: reqLevel,
        suggestedUserId: suggestedUserId ?? null,
        assignedUserIds: usersToAssign,
        wasOverride: suggestedUserId ? !usersToAssign.includes(suggestedUserId) : false,
        workspaceId: wsId,
      })
    } catch (metaError) {
      console.error('No se pudo guardar task_meta (la tarea sí se creó en ClickUp):', metaError)
    }

    // Notificar en tiempo real (el tablero se lee en vivo de ClickUp).
    await publishTaskUpdate({
      taskId: clickupTaskId,
      name,
      status: 'TO_DO',
      event: 'taskCreated',
    })

    invalidateAllCache()

    // Datos de los asignados desde la DB (config), sin leer la tarea de la DB.
    const assigneeUsers = await db.query.user.findMany({
      where: inArray(userTable.id, usersToAssign),
      columns: { id: true, name: true, email: true },
    })

    return NextResponse.json({
      id: clickupTaskId,
      name,
      description: description ?? null,
      status: 'TO_DO',
      priority,
      startDate: finalInsertion.startDate.toISOString(),
      deadline: finalInsertion.deadline.toISOString(),
      url: clickupTaskUrl,
      tier: {
        id: tier.id,
        name: tier.name,
        duration: tier.duration,
        type: { id: type.id, name: type.name },
      },
      brand: { id: brand.id, name: brand.name },
      assignees: assigneeUsers.map(user => ({
        userId: user.id,
        user: { id: user.id, name: user.name, email: user.email },
      })),
      clickupInfo: {
        clickupId: clickupTaskId,
        clickupUrl: clickupTaskUrl,
        createdInClickUp: true,
      },
      vacationInfo: {
        hadVacationConflicts: vacationAdjustments.length > 0,
        adjustments: vacationAdjustments.map(adj => ({
          userId: adj.userId,
          originalStartDate: adj.vacationAdjustment!.originalDate.toISOString(),
          adjustedStartDate: adj.vacationAdjustment!.adjustedDate.toISOString(),
          conflictingVacations: adj.vacationAdjustment!.conflictingVacations,
        })),
      },
      priorityDetails: {
        insertionReason: finalInsertion.insertionReason,
        appliedPriorityRules: true,
        appliedVacationLogic: true,
        appliedParallelLogic: true,
        noTasksAffected: true,
      },
    })
  } catch (error) {
    console.error('Failed to create task:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

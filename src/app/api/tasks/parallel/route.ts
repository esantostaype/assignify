/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/tasks/parallel/route.ts
// Crea una tarea SOLO en ClickUp (la DB ya no guarda tareas). El motor de
// prioridades (modelo de carriles) calcula las fechas leyendo las tareas en vivo
// de ClickUp; aquí solo se valida config, se elige diseñador y se crea en ClickUp.

import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { getBestUserWithCache } from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { TaskCreationParams, UserWithRoles, ClickUpBrand } from '@/interfaces'
import { calculateParallelPriorityInsertion } from '@/services/parallel-priority-insertion.service'
import { invalidateAllCache } from '@/utils/cache'
import { publishTaskUpdate } from '@/lib/pusher'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado.')
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN no configurado' }, { status: 500 })
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
    }: TaskCreationParams = body

    if (!name || !typeId || !tierId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({
        error: 'Faltan campos requeridos o duración inválida',
        required: ['name', 'typeId', 'tierId', 'priority', 'brandId', 'durationDays'],
      }, { status: 400 })
    }

    console.log(`🚀 === CREANDO TAREA "${name}" EN CLICKUP (motor de prioridades en vivo) ===`)
    console.log(`   - Priority: ${priority}`)
    console.log(`   - Duration: ${durationDays} días`)
    console.log(`   - Type ID: ${typeId} | Tier ID: ${tierId} | Brand ID: ${brandId}`)
    console.log(`   - Users: ${assignedUserIds || 'AUTO-ASSIGNMENT'}`)

    // Config desde la DB (esto SÍ sigue viviendo en Prisma).
    const [tier, type, brand] = await Promise.all([
      prisma.tierList.findUnique({ where: { id: tierId } }),
      prisma.taskType.findUnique({ where: { id: typeId } }),
      prisma.brand.findUnique({ where: { id: brandId } }),
    ])

    if (!tier) return NextResponse.json({ error: 'Tier no encontrado' }, { status: 404 })
    if (!type) return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
    if (!brand) return NextResponse.json({ error: 'Brand no encontrado' }, { status: 404 })

    console.log(`✅ Tier: ${tier.name} (${type.name}) | Brand: ${brand.name}`)

    // ¿La duración es personalizada (distinta a la del tier)?
    const isCustomDuration = Math.abs(durationDays - tier.duration) > 0.001

    // Determinar diseñadores a asignar.
    let usersToAssign: string[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      console.log('👤 Asignación manual de usuarios:', assignedUserIds)

      const specificUsersResults = await Promise.all(
        assignedUserIds.map(userId =>
          prisma.user.findUnique({
            where: { id: userId },
            include: {
              roles: { where: { OR: [{ brandId: brandId }, { brandId: null }] } },
            },
          })
        )
      )

      const validUsers: UserWithRoles[] = specificUsersResults.filter(
        (user): user is NonNullable<typeof user> =>
          user !== null &&
          user.active &&
          user.roles.some(role => role.typeId === typeId)
      ) as UserWithRoles[]

      if (validUsers.length === 0) {
        return NextResponse.json({
          error: 'Ninguno de los usuarios especificados es compatible con este tipo de tarea',
          details: 'Verifique que los usuarios existan, estén activos y tengan roles compatibles',
        }, { status: 400 })
      }

      usersToAssign = validUsers.map(user => user.id)
      console.log(`✅ Usuarios válidos para asignación manual: ${usersToAssign.length}`)
    } else {
      console.log('🤖 Iniciando asignación automática...')
      const bestUser = await getBestUserWithCache(typeId, brandId, priority, durationDays)

      if (!bestUser) {
        return NextResponse.json({
          error: 'No se pudo encontrar un diseñador óptimo para la asignación automática',
          details: 'No hay usuarios disponibles que cumplan con los criterios de asignación considerando vacaciones y carga de trabajo',
        }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
      console.log('✅ Usuario seleccionado automáticamente:', {
        name: bestUser.userName,
        carga: bestUser.cargaTotal,
        disponible: bestUser.availableDate.toISOString(),
        especialista: bestUser.isSpecialist,
      })
    }

    // Calcular fechas con el modelo de carriles + vacaciones para cada usuario.
    // calculateParallelPriorityInsertion ya considera vacaciones internamente.
    console.log(`\n🎯 === CALCULANDO FECHAS (modelo de carriles + vacaciones) ===`)
    const userDuration = durationDays / usersToAssign.length

    const insertionResults = await Promise.all(
      usersToAssign.map(async (userId) => {
        const result = await calculateParallelPriorityInsertion(userId, priority, userDuration)
        console.log(`👤 ${userId}: ${result.startDate.toISOString()} → ${result.deadline.toISOString()} (${result.insertionReason})`)
        return { userId, ...result }
      })
    )

    // Con varios usuarios se toma la fecha más tardía (la más conservadora).
    const finalInsertion = insertionResults.reduce((latest, current) =>
      current.startDate > latest.startDate ? current : latest
    )

    console.log(`📅 Fecha final: ${finalInsertion.startDate.toISOString()} → ${finalInsertion.deadline.toISOString()}`)

    const vacationAdjustments = insertionResults.filter(r => r.vacationAdjustment)

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? '',
    }

    console.log('📤 Creando tarea EN CLICKUP REAL...')

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

    console.log(`✅ Tarea creada en ClickUp: ${clickupTaskId}`)
    console.log(`🔗 URL: ${clickupTaskUrl}`)

    // Notificar en tiempo real (el tablero se lee en vivo de ClickUp).
    await publishTaskUpdate({
      taskId: clickupTaskId,
      name,
      status: 'TO_DO',
      event: 'taskCreated',
    })

    invalidateAllCache()
    console.log('🗑️ Cache invalidado después de crear tarea')

    // Datos de los asignados desde la DB (config), sin leer la tarea de la DB.
    const assigneeUsers = await prisma.user.findMany({
      where: { id: { in: usersToAssign } },
      select: { id: true, name: true, email: true },
    })

    console.log(`🎉 === TAREA "${name}" CREADA EN CLICKUP ===`)

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
    console.error('❌ Error general al crear tarea:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 })
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// PASO 2: CREAR ARCHIVO
// src/app/api/tasks/v2/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import { Priority } from '@prisma/client'
import { 
  calculatePriorityInsertion, 
  shiftTasksAfterInsertion 
} from '@/services/priority-insertion.service'

interface TaskCreationParams {
  name: string;
  description?: string;
  typeId: number;
  tierId: number;
  priority: Priority;
  brandId: string;
  assignedUserIds?: string[];
  durationDays: number;
}

/**
 * GET /api/tasks/v2 - Lista tareas con orden natural
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const brandId = searchParams.get('brandId')

    const where: any = {}
    if (userId) {
      where.assignees = { some: { userId } }
    }
    if (brandId) {
      where.brandId = brandId
    }

    // ✅ ORDEN NATURAL: Solo por fechas
    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { startDate: 'asc' },
        { deadline: 'asc' }
      ],
      include: {
        tier: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    console.log(`📋 API v2: ${tasks.length} tareas ordenadas por fecha natural`)

    return NextResponse.json({
      version: 'v2-priority-insertion',
      data: tasks.map((task, index) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate.toISOString(),
        deadline: task.deadline.toISOString(),
        // ✅ Posición natural basada en orden de fechas
        naturalPosition: index + 1,
        // ✅ NO incluir queuePosition
        url: task.url,
        tier: {
          id: task.tier.id,
          name: task.tier.name,
          duration: task.tier.duration,
          type: {
            id: task.type.id,
            name: task.type.name
          }
        },
        brand: {
          id: task.brand.id,
          name: task.brand.name
        },
        assignees: task.assignees.map(assignment => ({
          userId: assignment.userId,
          user: {
            id: assignment.user.id,
            name: assignment.user.name,
            email: assignment.user.email
          }
        }))
      })),
      metadata: {
        orderingMethod: 'natural_date_ordering',
        usesQueuePosition: false,
        priorityMethod: 'temporal_insertion'
      }
    })
  } catch (error) {
    console.error('❌ Error en API v2:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * POST /api/tasks/v2 - Crear tarea con prioridades por inserción
 */
export async function POST(req: Request) {
  try {
    const body: TaskCreationParams = await req.json()
    const {
      name,
      description,
      typeId,
      tierId,
      priority,
      brandId,
      assignedUserIds,
      durationDays
    } = body

    // Validaciones básicas
    if (!name || !typeId || !tierId || !priority || !brandId || !durationDays) {
      return NextResponse.json({
        error: 'Faltan campos requeridos',
        required: ['name', 'typeId', 'tierId', 'priority', 'brandId', 'durationDays']
      }, { status: 400 })
    }

    console.log(`🚀 API v2: Creando tarea "${name}" con prioridad ${priority}`)

    // Verificar que existen tier y brand
    const [tier, brand] = await Promise.all([
      prisma.tierList.findUnique({
        where: { id: tierId }
      }),
      prisma.brand.findUnique({
        where: { id: brandId }
      })
    ])

    if (!tier || !brand) {
      return NextResponse.json({
        error: 'Tier o Brand no encontrado'
      }, { status: 404 })
    }

    // Determinar usuarios a asignar
    let usersToAssign: string[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      // Validar usuarios manualmente asignados
      const validUsers = await prisma.user.findMany({
        where: { 
          id: { in: assignedUserIds },
          active: true,
          roles: {
            some: {
              typeId: typeId,
              OR: [
                { brandId: brandId },
                { brandId: null }
              ]
            }
          }
        }
      })

      if (validUsers.length === 0) {
        return NextResponse.json({
          error: 'Ningún usuario válido encontrado'
        }, { status: 400 })
      }

      usersToAssign = validUsers.map(u => u.id)
    } else {
      // TODO: Implementar selección automática
      return NextResponse.json({
        error: 'Asignación automática no implementada en v2. Proporciona assignedUserIds.'
      }, { status: 400 })
    }

    console.log(`👥 Usuarios asignados: ${usersToAssign.join(', ')}`)

    // ✅ NUEVA LÓGICA: Calcular inserción por prioridad
    const insertionResults = []
    
    for (const userId of usersToAssign) {
      const insertionResult = await calculatePriorityInsertion(
        userId, 
        priority, 
        durationDays / usersToAssign.length
      )
      
      insertionResults.push({
        userId,
        ...insertionResult
      })
    }

    // Para múltiples usuarios, usar fechas más conservadoras
    const finalInsertion = insertionResults.reduce((latest, current) => 
      current.startDate > latest.startDate ? current : latest
    )

    console.log(`🎯 Fechas finales: ${finalInsertion.startDate.toISOString()} → ${finalInsertion.deadline.toISOString()}`)

    // Generar ID único para testing (reemplazar por ClickUp en producción)
    const taskId = `v2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // ✅ CREAR TAREA SIN queuePosition
    const task = await prisma.task.create({
      data: {
        id: taskId,
        name,
        description: description || '',
        typeId: typeId,
        tierId: tierId,
        brandId: brandId,
        priority,
        startDate: finalInsertion.startDate,
        deadline: finalInsertion.deadline,
        // ✅ NO incluir queuePosition
        url: `https://test-v2.com/task/${taskId}`,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
        customDuration: durationDays !== tier.duration ? durationDays : null
      },
      include: {
        tier: true,
        type: true,
        brand: true
      }
    })

    // Crear asignaciones
    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    })

    // ✅ RECALCULAR TAREAS AFECTADAS
    for (const result of insertionResults) {
      if (result.affectedTasks.length > 0) {
        await shiftTasksAfterInsertion(result.affectedTasks, result.deadline)
      }
    }

    console.log(`✅ Tarea v2 creada: ${task.name}`)

    // Obtener tarea completa con asignaciones
    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        tier: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      version: 'v2-priority-insertion',
      success: true,
      task: {
        id: taskWithAssignees?.id,
        name: taskWithAssignees?.name,
        priority: taskWithAssignees?.priority,
        startDate: taskWithAssignees?.startDate.toISOString(),
        deadline: taskWithAssignees?.deadline.toISOString(),
        // ✅ NO incluir queuePosition
        tier: {
          id: taskWithAssignees?.tier.id,
          name: taskWithAssignees?.tier.name,
          duration: taskWithAssignees?.tier.duration
        },
        brand: {
          id: taskWithAssignees?.brand.id,
          name: taskWithAssignees?.brand.name
        },
        assignees: taskWithAssignees?.assignees.map(assignment => ({
          userId: assignment.userId,
          user: {
            id: assignment.user.id,
            name: assignment.user.name
          }
        })) || []
      },
      priorityInsertion: {
        insertionReason: finalInsertion.insertionReason,
        affectedTasksCount: finalInsertion.affectedTasks.length
      }
    })

  } catch (error) {
    console.error('❌ Error creando tarea v2:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
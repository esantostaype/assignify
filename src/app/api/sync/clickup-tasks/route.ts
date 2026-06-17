/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts - UPDATED to filter completed tasks

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';
import { 
  mapClickUpStatusToLocal, 
  mapClickUpStatusToLocalSafe,
  isActiveTaskStatus,
  mapClickUpPriority,
  getValidLocalStatuses
} from '@/utils/clickup-status-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

// El tablero se lee en vivo de ClickUp: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

// ✅ SIMPLIFICADO: Ya no calculamos posiciones, solo validamos fechas
async function validateTaskDatesForSync(
  userId: string, 
  startDate: Date, 
  deadline: Date,
  brandId: string
): Promise<boolean> {
  console.log(`🔍 Validando fechas para usuario ${userId} en brand ${brandId}`);
  
  // Obtener tareas existentes del usuario para referencia
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { 
      id: true, 
      startDate: true, 
      deadline: true,
      name: true,
      typeId: true
    }
  });

  console.log(`   📊 Tareas existentes del usuario en brand ${brandId}: ${userTasks.length}`);
  userTasks.forEach(task => {
    console.log(`     - "${task.name}": ${task.startDate.toISOString()} → ${task.deadline.toISOString()}`);
  });

  // Validar que las fechas sean coherentes
  if (startDate >= deadline) {
    console.log(`   ❌ Fechas inválidas: startDate >= deadline`);
    return false;
  }

  console.log(`   ✅ Fechas válidas: ${startDate.toISOString()} → ${deadline.toISOString()}`);
  return true;
}

// ✅ SIMPLIFICADO: Solo log del estado actual, sin reordenar posiciones
async function logUserTasksAfterSync(
  userId: string, 
  brandId: string,
  newTaskId: string
): Promise<void> {
  console.log(`📊 Estado de tareas para usuario ${userId}, brand ${brandId} después del sync`);
  
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' }, // ✅ Solo ordenar por fecha
    select: { id: true, startDate: true, deadline: true, name: true, typeId: true }
  });

  console.log(`   📊 Total tareas ordenadas por fecha: ${userTasks.length}`);

  userTasks.forEach((task, index) => {
    const isNew = task.id === newTaskId;
    const prefix = isNew ? '🆕' : '📋';
    console.log(`   ${prefix} ${index + 1}. "${task.name}": ${task.startDate.toISOString()} → ${task.deadline.toISOString()}`);
  });
}

export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 Obteniendo tareas activas de ClickUp (excluyendo completadas)...');

    const teamsResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const allSpaces = [];
    for (const team of teamsResponse.data.teams) {
      try {
        const spacesResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/team/${team.id}/space?archived=false`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );
        allSpaces.push(...spacesResponse.data.spaces);
      } catch (error) {
        console.warn(`⚠️ Error obteniendo spaces del team ${team.name}:`, error);
      }
    }

    console.log(`📊 Spaces encontrados: ${allSpaces.length}`);

    const allTasks: any[] = [];
    
    async function getTasksFromList(list: any, tasksArray: any[]) {
      try {
        console.log(`       Obteniendo tareas de la lista: ${list.name}`);
        
        let page = 0;
        let hasMorePages = true;
        
        while (hasMorePages && page < 5) {
          const tasksResponse = await axios.get(
            `${API_CONFIG.CLICKUP_API_BASE}/list/${list.id}/task`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json',
              },
              params: {
                archived: false,
                page: page,
                order_by: 'updated',
                reverse: true,
                subtasks: true,
                include_closed: false, // ✅ MEJORADO: Excluir tareas cerradas desde ClickUp
              }
            }
          );

          const tasks = tasksResponse.data.tasks || [];
          
          // ✅ FILTROS MEJORADOS: Estado activo + Fechas requeridas + Incluir ON APPROVAL
          const filteredTasks = tasks.filter((task: any) => {
            const taskStatus = task.status?.status || '';
            
            console.log(`\n📋 Analyzing task: "${task.name}"`);
            console.log(`   📊 Status: "${taskStatus}"`);
            
            // ✅ MEJORADO: Usar nueva utilidad para verificar si está activa
            if (!isActiveTaskStatus(taskStatus)) {
              console.log(`   🚫 Task EXCLUDED: completed/invalid status`);
              return false;
            }
            
            const mappedStatus = mapClickUpStatusToLocal(taskStatus);
            console.log(`   🔄 Mapped status: ${taskStatus} -> ${mappedStatus}`);
            
            // ✅ MEJORADO: Incluir todas las tareas activas (TO_DO, IN_PROGRESS, ON_APPROVAL)
            const validStatuses = getValidLocalStatuses();
            const hasValidStatus = mappedStatus && validStatuses.includes(mappedStatus);
            
            const hasStartDate = task.start_date && task.start_date !== null;
            const hasDueDate = task.due_date && task.due_date !== null;
            
            console.log(`   📅 Has start date: ${hasStartDate}`);
            console.log(`   📅 Has due date: ${hasDueDate}`);
            console.log(`   ✅ Valid mapped status: ${hasValidStatus} (${mappedStatus})`);
            
            if (hasValidStatus && hasStartDate && hasDueDate) {
              console.log(`   ✅ Task INCLUDED: "${task.name}" (${taskStatus} → ${mappedStatus})`);
              return true;
            }
            
            // Log de exclusión para tareas activas sin fechas
            if (!hasStartDate) {
              console.log(`   🚫 Task EXCLUDED: missing start date`);
            } else if (!hasDueDate) {
              console.log(`   🚫 Task EXCLUDED: missing due date`);
            } else if (!hasValidStatus) {
              console.log(`   🚫 Task EXCLUDED: invalid mapped status (${mappedStatus})`);
            }
            
            return false;
          });
          
          tasksArray.push(...filteredTasks);
          
          console.log(`         Página ${page}: ${tasks.length} tareas totales, ${filteredTasks.length} tareas activas con fechas válidas`);
          
          hasMorePages = tasks.length > 0 && tasks.length >= 100;
          page++;
        }
        
      } catch (taskError: any) {
        console.warn(`       ⚠️ Error obteniendo tareas de la lista ${list.name}:`, taskError.response?.status || taskError.message);
      }
    }

    // Procesar todos los spaces
    for (const space of allSpaces) {
      try {
        console.log(`   Obteniendo folders del space: ${space.name}`);
        
        const foldersResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/space/${space.id}/folder?archived=false`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        const folders = foldersResponse.data.folders || [];

        // Obtener listas directas del space
        try {
          const spaceListsResponse = await axios.get(
            `${API_CONFIG.CLICKUP_API_BASE}/space/${space.id}/list?archived=false`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json',
              },
            }
          );

          const spaceLists = spaceListsResponse.data.lists || [];
          for (const list of spaceLists) {
            await getTasksFromList(list, allTasks);
          }
        } catch (spaceListError) {
          console.warn(`⚠️ Error obteniendo listas directas del space ${space.name}`);
        }

        // Obtener listas de cada folder
        for (const folder of folders) {
          try {
            const listsResponse = await axios.get(
              `${API_CONFIG.CLICKUP_API_BASE}/folder/${folder.id}/list?archived=false`,
              {
                headers: {
                  'Authorization': CLICKUP_TOKEN,
                  'Content-Type': 'application/json',
                },
              }
            );

            const lists = listsResponse.data.lists || [];
            for (const list of lists) {
              await getTasksFromList(list, allTasks);
            }
          } catch (folderError) {
            console.warn(`⚠️ Error obteniendo listas del folder ${folder.name}`);
          }
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Error obteniendo contenido del space ${space.name}:`, error.response?.status || error.message);
      }
    }

    console.log(`🎯 Total de tareas activas con fechas válidas en ClickUp: ${allTasks.length}`);

    // El tablero se alimenta EN VIVO de ClickUp: ya no se compara con la DB local.
    const clickupTasks = allTasks
      .filter(clickupTask => {
        if (!clickupTask.id || !clickupTask.name) {
          console.warn(`⚠️ Tarea sin ID/nombre omitida:`, clickupTask.id);
          return false;
        }
        return true;
      })
      .map(clickupTask => {
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');

        return {
          clickupId: clickupTask.id,
          customId: clickupTask.custom_id,
          name: clickupTask.name,
          description: clickupTask.description || clickupTask.text_content || '',
          status: mappedStatus,
          statusColor: clickupTask.status.color,
          priority: clickupTask.priority?.priority || 'normal',
          priorityColor: clickupTask.priority?.color || '#6366f1',
          assignees: clickupTask.assignees.map((assignee: any) => ({
            id: assignee.id.toString(),
            name: assignee.username,
            email: assignee.email,
            initials: assignee.initials,
            color: assignee.color
          })),
          dueDate: new Date(parseInt(clickupTask.due_date)).toISOString(),
          startDate: new Date(parseInt(clickupTask.start_date)).toISOString(),
          timeEstimate: clickupTask.time_estimate,
          timeSpent: clickupTask.time_spent,
          points: clickupTask.points,
          tags: clickupTask.tags.map((tag: any) => tag.name),
          list: {
            id: clickupTask.list.id,
            name: clickupTask.list.name
          },
          folder: {
            id: clickupTask.folder.id,
            name: clickupTask.folder.name
          },
          space: {
            id: clickupTask.space.id,
            name: clickupTask.space.name
          },
          url: clickupTask.url,
          dateCreated: new Date(parseInt(clickupTask.date_created)).toISOString(),
          dateUpdated: new Date(parseInt(clickupTask.date_updated)).toISOString(),
          dateClosed: clickupTask.date_closed ? new Date(parseInt(clickupTask.date_closed)).toISOString() : null,
          // El tablero ya no sincroniza con la DB: estos flags se quedan en false.
          existsInLocal: false,
          canSync: false,
        };
      });

    return NextResponse.json({
      clickupTasks,
      statistics: {
        totalClickUpTasks: allTasks.length,
        existingInLocal: 0,
        availableToSync: 0,
        totalLocalTasks: 0
      },
      spaces: allSpaces.map(space => ({
        id: space.id,
        name: space.name,
        private: space.private,
        taskCount: clickupTasks.filter(t => t.space.id === space.id).length
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo tareas de ClickUp:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener tareas de ClickUp',
        details: message,
        status: status
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    const {
      taskIds,
      tierId,
      brandId
    }: {
      taskIds: string[];
      tierId?: number;
      brandId: string;
    } = await req.json();

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({
        error: 'Se requiere un array de taskIds para sincronizar'
      }, { status: 400 });
    }

    if (!brandId) {
      return NextResponse.json({
        error: 'brandId es requerido'
      }, { status: 400 });
    }

    console.log(`🔄 === SINCRONIZANDO ${taskIds.length} TAREAS ACTIVAS ===`);
    console.log(`📋 Brand ID: ${brandId}`);
    console.log(`📋 Tier ID: ${tierId || 'default'}`);

    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return NextResponse.json({
        error: 'Brand no encontrado'
      }, { status: 404 });
    }

    // Determinar tier/type por defecto
    const defaultTier = await prisma.tierList.findFirst({
      where: { name: 'D' }
    });

    const finalTierId = tierId ?? defaultTier?.id;

    if (!finalTierId) {
      return NextResponse.json({
        error: 'No se pudo determinar un tier para las tareas (tier por defecto "D" no existe)'
      }, { status: 400 });
    }

    // Type por defecto: "General Design" o el primero disponible
    let defaultType = await prisma.taskType.findFirst({
      where: { name: 'General Design' }
    });

    if (!defaultType) {
      defaultType = await prisma.taskType.findFirst();
    }

    if (!defaultType) {
      return NextResponse.json({
        error: 'No se pudo determinar un type para las tareas (no hay TaskType disponibles)'
      }, { status: 400 });
    }

    const finalTypeId = defaultType.id;

    console.log(`✅ Usando tier por defecto ID: ${finalTierId} | Type: ${defaultType.name} (ID: ${finalTypeId})`);

    // Obtener información de tareas desde ClickUp
    const tasksData: any[] = [];
    const notFoundTasks: string[] = [];

    for (const taskId of taskIds) {
      try {
        console.log(`   🔍 Obteniendo datos de tarea ${taskId}...`);
        
        const taskResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        const task = taskResponse.data;
        
        // ✅ MEJORADO: Verificar que no esté completada usando nueva utilidad
        if (!isActiveTaskStatus(task.status?.status || '')) {
          console.log(`   🚫 Tarea ${taskId} omitida: está completada (${task.status?.status})`);
          notFoundTasks.push(taskId);
          continue;
        }
        
        if (!task.start_date || !task.due_date) {
          console.log(`   ⚠️ Tarea ${taskId} omitida: sin startDate o dueDate`);
          notFoundTasks.push(taskId);
          continue;
        }

        const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
        const validStatuses = getValidLocalStatuses();
        if (mappedStatus && validStatuses.includes(mappedStatus)) {
          tasksData.push(task);
          console.log(`   ✅ Tarea válida: ${task.name} (${mappedStatus})`);
        } else {
          console.log(`   ⚠️ Tarea ${taskId} omitida por estado: ${mappedStatus}`);
          notFoundTasks.push(taskId);
        }
        
      } catch (error) {
        console.warn(`   ❌ Tarea ${taskId} no encontrada o error al obtener datos`);
        notFoundTasks.push(taskId);
      }
    }

    if (tasksData.length === 0) {
      return NextResponse.json({
        error: 'No se encontró información de ninguna tarea válida activa con fechas en ClickUp',
        notFoundTasks: notFoundTasks
      }, { status: 400 });
    }

    // Verificar que las tareas no existan ya
    const existingTasks = await prisma.task.findMany({
      where: {
        OR: [
          { id: { in: tasksData.map(t => t.id) } },
          { url: { in: tasksData.map(t => t.url) } }
        ]
      },
      select: { id: true, name: true, url: true }
    });

    if (existingTasks.length > 0) {
      const existingInfo = existingTasks.map(t => `${t.name} (ID: ${t.id})`);
      console.warn(`⚠️ Tareas ya existentes omitidas: ${existingInfo.join(', ')}`);
    }

    const existingIds = new Set(existingTasks.map(t => t.id));
    const existingUrls = new Set(existingTasks.map(t => t.url));
    const newTasksData = tasksData.filter(task => 
      !existingIds.has(task.id) && !existingUrls.has(task.url)
    );

    if (newTasksData.length === 0) {
      return NextResponse.json({
        message: 'Todas las tareas seleccionadas ya existen en la base de datos',
        skippedTasks: existingTasks
      });
    }

    // Ordenar por fecha de inicio
    newTasksData.sort((a, b) => {
      const dateA = parseInt(a.start_date);
      const dateB = parseInt(b.start_date);
      return dateA - dateB;
    });

    console.log(`📅 === PROCESANDO ${newTasksData.length} TAREAS ACTIVAS ORDENADAS POR FECHA ===`);

    const createdTasks = [];
    const errors = [];
    
    for (const clickupTask of newTasksData) {
      try {
        console.log(`\n🔄 === PROCESANDO: "${clickupTask.name}" ===`);

        const taskId = clickupTask.id;
        const mappedStatus = mapClickUpStatusToLocalSafe(clickupTask.status?.status || '');
        
        console.log(`   🔄 Status mapeado seguro: ${clickupTask.status?.status} → ${mappedStatus}`);

        const startDate = new Date(parseInt(clickupTask.start_date));
        const deadline = new Date(parseInt(clickupTask.due_date));
        
        console.log(`   📅 Fechas de ClickUp:`);
        console.log(`     Start: ${startDate.toISOString()}`);
        console.log(`     Due: ${deadline.toISOString()}`);

        // ✅ VALIDAR FECHAS SIN CALCULAR POSICIÓN
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          const firstAssigneeId = clickupTask.assignees[0].id.toString();
          
          const isValid = await validateTaskDatesForSync(
            firstAssigneeId,
            startDate,
            deadline,
            brandId
          );
          
          if (!isValid) {
            console.log(`   ❌ Fechas inválidas para usuario ${firstAssigneeId}`);
            errors.push(`Fechas inválidas para tarea ${clickupTask.name}`);
            continue;
          }
        }

        // ✅ CREAR TAREA SIN queuePosition
        const newTask = await prisma.task.create({
          data: {
            id: taskId,
            name: clickupTask.name,
            description: clickupTask.description || clickupTask.text_content || '',
            status: mappedStatus,
            priority: mapClickUpPriority(clickupTask.priority?.priority),
            startDate: startDate,
            deadline: deadline,
            timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null,
            points: clickupTask.points,
            tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
            url: clickupTask.url,
            // ✅ NO incluir queuePosition
            typeId: finalTypeId,
            tierId: finalTierId,
            brandId: brandId,
          },
          include: {
            tier: true,
            type: true,
            brand: true
          }
        });

        console.log(`   ✅ Tarea creada en DB:`);
        console.log(`     ID: ${newTask.id}`);
        console.log(`     Type ID: ${newTask.typeId}`);
        console.log(`     Brand ID: ${newTask.brandId}`);
        console.log(`     Fechas: ${newTask.startDate.toISOString()} → ${newTask.deadline.toISOString()}`);

        // ✅ CREAR ASIGNACIONES Y LOG ESTADO
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          for (const assignee of clickupTask.assignees) {
            const assigneeId = assignee.id.toString();
            
            const userExists = await prisma.user.findUnique({
              where: { id: assigneeId }
            });
            
            if (userExists) {
              try {
                await prisma.taskAssignment.create({
                  data: {
                    userId: assigneeId,
                    taskId: taskId
                  }
                });
                
                // ✅ SOLO LOG, SIN REORDENAR
                await logUserTasksAfterSync(assigneeId, brandId, taskId);
                
                console.log(`   ✅ Usuario ${assignee.username} asignado exitosamente`);
              } catch (assignError) {
                console.warn(`   ⚠️ Error asignando usuario ${assignee.username}:`, assignError);
              }
            } else {
              console.warn(`   ⚠️ Usuario ${assigneeId} no existe en DB local`);
            }
          }
        }

        createdTasks.push(newTask);

      } catch (createError) {
        const errorMsg = `Error creando tarea ${clickupTask.name}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n🎉 === SINCRONIZACIÓN COMPLETADA (SOLO TAREAS ACTIVAS) ===`);
    console.log(`✅ ${createdTasks.length} tareas creadas exitosamente`);
    console.log(`⚠️ ${errors.length} errores`);
    console.log(`🚫 ${notFoundTasks.length} tareas omitidas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas activas sincronizadas exitosamente con fechas ordenadas`,
      createdTasks: createdTasks,
      skippedTasks: existingTasks,
      notFoundTasks: notFoundTasks.length > 0 ? notFoundTasks : undefined,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        requested: taskIds.length,
        foundInClickUp: tasksData.length,
        notFoundInClickUp: notFoundTasks.length,
        alreadyExisting: existingTasks.length,
        created: createdTasks.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Error en sincronización de tareas:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor durante la sincronización',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
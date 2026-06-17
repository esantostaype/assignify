/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts - UPDATED to filter completed tasks

import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/config';
import {
  mapClickUpStatusToLocal,
  isActiveTaskStatus,
  getValidLocalStatuses
} from '@/utils/clickup-status-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

// El tablero se lee en vivo de ClickUp: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic';

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

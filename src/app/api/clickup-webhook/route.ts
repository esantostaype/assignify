/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/clickup-webhook/route.ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils'
import { publishTaskUpdate } from '@/lib/pusher'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN
const WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET
// Rechaza webhooks con firma inválida. Déjalo desactivado hasta confirmar en los
// logs que la firma coincide; luego pon CLICKUP_VERIFY_SIGNATURE=true en producción.
const VERIFY_SIGNATURE = process.env.CLICKUP_VERIFY_SIGNATURE === 'true'

// Eventos de ClickUp que modifican tareas y disparan actualización en tiempo real.
const MUTATING_EVENTS = ['taskUpdated', 'taskStatusUpdated', 'taskAssigneeUpdated', 'taskDeleted', 'taskCreated']

// Logs de depuración silenciados por defecto. Actívalos con DEBUG_WEBHOOK=true.
const _rawLog = console.log.bind(console)
const dlog = (...args: any[]) => { if (process.env.DEBUG_WEBHOOK === 'true') _rawLog(...args) }

// ✅ MEJORADO: Log de entrada más detallado
function logWebhookEntry(req: Request, body: any) {
  const timestamp = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const contentType = req.headers.get('content-type') || 'unknown';
  const signature = req.headers.get('x-signature') || 'no-signature';
  
  dlog('\n🔔 =============== CLICKUP WEBHOOK RECEIVED ===============');
  dlog(`⏰ Timestamp: ${timestamp}`);
  dlog(`🌐 User-Agent: ${userAgent}`);
  dlog(`📝 Content-Type: ${contentType}`);
  dlog(`🔐 Signature: ${signature}`);
  dlog(`📋 Event Type: ${body.event || 'NO_EVENT'}`);
  dlog(`📦 Task ID: ${body.task_id || 'NO_TASK_ID'}`);
  dlog(`📊 Payload Size: ${JSON.stringify(body).length} chars`);
  
  // Log completo del payload para debugging
  dlog(`📦 FULL PAYLOAD:`);
  dlog(JSON.stringify(body, null, 2));
  dlog('========================================================\n');
}

// ✅ MEJORADO: Log de headers del request
function logRequestHeaders(req: Request) {
  dlog('📨 REQUEST HEADERS:');
  req.headers.forEach((value, key) => {
    dlog(`   ${key}: ${value}`);
  });
  dlog('');
}

// ✅ NUEVO: Log de verificación de webhook
function logWebhookVerification(signature: string | null) {
  dlog('🔐 WEBHOOK VERIFICATION:');
  dlog(`   WEBHOOK_SECRET configured: ${WEBHOOK_SECRET ? 'YES' : 'NO'}`);
  dlog(`   Signature received: ${signature ? 'YES' : 'NO'}`);
  dlog(`   Signature value: ${signature || 'none'}`);
  
  if (WEBHOOK_SECRET && signature) {
    // Aquí podrías implementar verificación HMAC si ClickUp la soporta
    dlog(`   ✅ Signature verification: SKIPPED (implement HMAC if needed)`);
  } else {
    dlog(`   ⚠️ Webhook running without signature verification`);
  }
  dlog('');
}

// ✅ MEJORADO: Log de respuesta
function logWebhookResponse(eventType: string, success: boolean, message: string, taskId?: string) {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  
  dlog(`${status} WEBHOOK RESPONSE [${timestamp}]:`);
  dlog(`   Event: ${eventType}`);
  dlog(`   Task ID: ${taskId || 'none'}`);
  dlog(`   Success: ${success}`);
  dlog(`   Message: ${message}`);
  dlog('========================================================\n');
}

interface ClickUpWebhookEvent {
  event: string;
  task_id?: string;
  history_items?: Array<{
    field: string;
    before: any;
    after: any;
  }>;
  task?: {
    id: string;
    name: string;
    description: string;
    status: {
      status: string;
      color: string;
      type: string;
    };
    priority: {
      priority: string;
      color: string;
    };
    assignees: Array<{
      id: number;
      username: string;
      email: string;
    }>;
    due_date: string | null;
    start_date: string | null;
    time_estimate: number | null;
  };
}

export async function GET(req: Request) {
  dlog('📥 GET request to webhook endpoint');
  
  try {
    const { searchParams } = new URL(req.url)
    const challenge = searchParams.get('challenge')
    
    // Manejar verificación de ClickUp
    if (challenge) {
      dlog('🔐 ClickUp webhook verification challenge received:', challenge);
      return new Response(challenge, { 
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    }

    // Health check y lógica GET existente
    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    dlog(`📊 GET request with params: brandId=${brandId}, status=${status}, priority=${priority}, page=${page}`);

    // Health check si no hay parámetros
    if (!brandId && !status && !priority && page === 1) {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        webhook_secret_configured: !!WEBHOOK_SECRET,
        clickup_token_configured: !!CLICKUP_TOKEN,
        endpoint: req.url
      };

      dlog('✅ Health check passed:', healthCheck);
      return NextResponse.json(healthCheck);
    }

    const where: any = {}
    if (brandId) where.brandId = brandId
    if (status && Object.values(Status).includes(status as Status)) {
      where.status = status as Status
    }
    if (priority && Object.values(Priority).includes(priority as Priority)) {
      where.priority = priority as Priority
    }

    const tasks = await prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: 'asc' },
      include: {
        tier: true,
        type: true,
        brand: true,
        assignees: { include: { user: true } }
      }
    })

    const totalTasks = await prisma.task.count({ where })

    dlog(`✅ GET request successful: returned ${tasks.length} tasks`);

    return NextResponse.json({
      data: tasks,
      pagination: {
        total: totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit)
      }
    })
  } catch (error) {
    console.error('❌ Error in GET handler:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    // ✅ NUEVO: Log de headers antes de procesar
    logRequestHeaders(req);
    
    // ✅ MEJORADO: Mejor manejo del body
    let body: any = null;
    let rawBody = '';
    
    try {
      rawBody = await req.text();
      dlog(`📦 Raw body length: ${rawBody.length}`);
      dlog(`📦 Raw body preview: ${rawBody.substring(0, 200)}...`);
      
      if (rawBody.trim() === '') {
        dlog('⚠️ Empty body received - likely a test ping');
        return NextResponse.json({ 
          success: true, 
          message: 'Empty body received - test webhook successful',
          timestamp: new Date().toISOString()
        });
      }

      // Verificación de firma HMAC de ClickUp sobre el cuerpo crudo.
      const signature = req.headers.get('x-signature') || '';
      if (WEBHOOK_SECRET) {
        const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
        const matches =
          signature.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!matches) {
          console.error(`❌ Firma de webhook inválida (verify=${VERIFY_SIGNATURE})`);
          if (VERIFY_SIGNATURE) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
          }
        } else {
          dlog('🔐 Firma de webhook verificada correctamente');
        }
      }

      body = JSON.parse(rawBody);
      dlog('✅ JSON parsed successfully');
      
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('❌ Raw body was:', rawBody);
      
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        rawBody: rawBody.substring(0, 100),
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, { status: 400 });
    }
    
    // ✅ MEJORADO: Log de entrada detallado
    logWebhookEntry(req, body);
    
    // ✅ NUEVO: Verificación de webhook
    const signature = req.headers.get('x-signature');
    logWebhookVerification(signature);
    
    // ✅ CORREGIDO: Manejar tests de ClickUp (devolver 200, no 400)
    if (!body.event) {
      dlog('⚠️ No event type found - likely a ClickUp test payload');
      dlog('📦 Test payload received:', JSON.stringify(body, null, 2));
      
      logWebhookResponse('TEST', true, 'Test webhook received successfully');
      
      // Para tests de ClickUp, devolver 200 (éxito) no 400 (error)
      return NextResponse.json({ 
        success: true,
        message: 'Test webhook received successfully',
        note: 'No event type needed for ClickUp test payloads',
        payload_received: body,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }
    
    const event = body as ClickUpWebhookEvent
    
    // ✅ NUEVO: Log detallado del evento real
    dlog('\n📊 === DETAILED EVENT ANALYSIS ===')
    dlog(`🔍 Event Type: ${event.event}`)
    dlog(`📋 Task ID: ${event.task_id || 'NOT_PROVIDED'}`)
    dlog(`📝 Task Name: ${event.task?.name || 'NOT_PROVIDED'}`)
    dlog(`📊 Task Status: ${event.task?.status?.status || 'NOT_PROVIDED'}`)
    dlog(`🔥 Task Priority: ${event.task?.priority?.priority || 'NOT_PROVIDED'}`)
    dlog(`👥 Assignees Count: ${event.task?.assignees?.length || 0}`)

    // Log de history_items si existen
    if (event.history_items && event.history_items.length > 0) {
      dlog(`📜 History Items (${event.history_items.length}):`);
      event.history_items.forEach((item, index) => {
        dlog(`   ${index + 1}. Field: ${item.field}`);
        dlog(`      Before: ${JSON.stringify(item.before)}`);
        dlog(`      After: ${JSON.stringify(item.after)}`);
      });
    } else {
      dlog(`📜 No history items provided`);
    }

    // Log del task completo si existe
    if (event.task) {
      dlog(`📦 Full Task Object:`);
      dlog(JSON.stringify(event.task, null, 2));
    } else {
      dlog(`📦 No task object provided in event`);
    }
    dlog('=====================================\n')
    
    dlog(`🎯 Processing webhook event: ${event.event}`);
    
    let result;
    let success = true;
    let message = '';
    
    switch (event.event) {
      case 'taskUpdated':
        dlog('📝 Handling taskUpdated event...');
        result = await handleTaskUpdate(event);
        break;
        
      case 'taskCreated':
        dlog('➕ Handling taskCreated event...');
        result = await handleTaskCreated(event);
        break;
        
      case 'taskDeleted':
        dlog('🗑️ Handling taskDeleted event...');
        result = await handleTaskDeleted(event);
        break;
        
      case 'taskStatusUpdated':
        dlog('📊 Handling taskStatusUpdated event...');
        result = await handleTaskStatusUpdate(event);
        break;
        
      case 'taskAssigneeUpdated':
        dlog('👥 Handling taskAssigneeUpdated event...');
        result = await handleTaskAssigneeUpdate(event);
        break;
        
      default:
        message = `Event ${event.event} received but not handled`;
        dlog(`⚠️ ${message}`);
        success = false;
        result = NextResponse.json({ 
          success: true,
          message,
          event_type: event.event,
          timestamp: new Date().toISOString()
        });
    }
    
    // Emitir actualización en tiempo real (Pusher) para eventos que modifican tareas.
    if (MUTATING_EVENTS.includes(event.event)) {
      await publishTaskUpdate({
        taskId: event.task_id,
        name: event.task?.name,
        status: event.task?.status?.status,
        event: event.event,
      })
    }

    // ✅ NUEVO: Log de timing
    const processingTime = Date.now() - startTime;
    dlog(`⏱️ Webhook processing completed in ${processingTime}ms`);

    logWebhookResponse(event.event, success, message || 'Processed successfully', event.task_id);

    return result;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ CRITICAL ERROR processing webhook:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available');
    dlog(`⏱️ Failed after ${processingTime}ms`);
    
    logWebhookResponse('ERROR', false, error instanceof Error ? error.message : 'Unknown error');
    
    // ✅ IMPORTANTE: Devolver 200 para que ClickUp no reintente
    return NextResponse.json({
      error: 'Error processing webhook',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 200 })
  }
}

// ✅ MEJORADO: handleTaskUpdate con debugging detallado
async function handleTaskUpdate(event: ClickUpWebhookEvent) {
  dlog('📝 === HANDLING TASK UPDATE ===');
  dlog(`📋 Task ID: ${event.task_id}`);
  dlog(`🔄 Event received at: ${new Date().toISOString()}`);
  
  if (!event.task_id) {
    console.error('❌ No task_id in update event');
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    // ✅ MEJORADO: Log de búsqueda de tarea con más detalles
    dlog(`🔍 Searching for task ${event.task_id} in local database...`);
    dlog(`🔍 Using Prisma query: findUnique({ where: { id: "${event.task_id}" } })`);
    
    const existingTask = await prisma.task.findUnique({
      where: { id: event.task_id },
      include: {
        assignees: {
          include: {
            user: true
          }
        },
        tier: true,
        type: true,
        brand: true
      }
    })

    if (!existingTask) {
      dlog(`❌ Task ${event.task_id} not found in local DB`);
      dlog(`🔍 Possible reasons:`);
      dlog(`   1. Task was created in ClickUp but not synced to local DB yet`);
      dlog(`   2. Task ID format mismatch`);
      dlog(`   3. Task was deleted from local DB`);
      
      // ✅ NUEVO: Intentar listar tareas similares para debugging
      try {
        const similarTasks = await prisma.task.findMany({
          where: {
            OR: [
              { name: { contains: event.task?.name || '' } },
              { id: { contains: event.task_id.slice(-8) } } // Últimos 8 caracteres
            ]
          },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        });
        
        dlog(`🔍 Found ${similarTasks.length} potentially similar tasks:`);
        similarTasks.forEach(task => {
          dlog(`   - ${task.id} | ${task.name} | ${task.status}`);
        });
      } catch (searchError) {
        console.error('❌ Error searching for similar tasks:', searchError);
      }
      
      // Intentar obtener desde ClickUp API
      if (CLICKUP_TOKEN) {
        try {
          dlog('🔍 Fetching task details from ClickUp API...');
          const clickupResponse = await axios.get(
            `https://api.clickup.com/api/v2/task/${event.task_id}`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          )
          dlog('✅ Task found in ClickUp:', {
            id: clickupResponse.data.id,
            name: clickupResponse.data.name,
            status: clickupResponse.data.status?.status,
            list_id: clickupResponse.data.list?.id
          });
        } catch (apiError) {
          console.error('❌ Error fetching from ClickUp API:', apiError);
          if (axios.isAxiosError(apiError)) {
            console.error('❌ API Error details:', {
              status: apiError.response?.status,
              statusText: apiError.response?.statusText,
              data: apiError.response?.data
            });
          }
        }
      } else {
        dlog('⚠️ CLICKUP_TOKEN not configured, cannot fetch from API');
      }
      
      return NextResponse.json({ 
        message: 'Task not found locally',
        taskId: event.task_id,
        suggestion: 'Task may need to be synced first',
        clickUpTaskName: event.task?.name || 'unknown'
      })
    }
    
    dlog(`✅ Found existing task in DB:`);
    dlog(`   📝 Name: "${existingTask.name}"`);
    dlog(`   📊 Status: ${existingTask.status}`);
    dlog(`   🔥 Priority: ${existingTask.priority}`);
    dlog(`   📅 Start Date: ${existingTask.startDate?.toISOString()}`);
    dlog(`   📅 Deadline: ${existingTask.deadline?.toISOString()}`);
    dlog(`   👥 Assignees: ${existingTask.assignees.length}`);
    dlog(`   🔄 Last Sync: ${existingTask.lastSyncAt?.toISOString()}`);
    dlog(`   🔄 Sync Status: ${existingTask.syncStatus}`);

    // ✅ MEJORADO: Preparar datos de actualización con logs más detallados
    const updateData: any = {}
    const taskData = event.task

    if (taskData) {
      dlog('📝 Analyzing task data for changes...');
      
      // Comparar name
      if (taskData.name && taskData.name !== existingTask.name) {
        updateData.name = taskData.name
        dlog(`📝 ✓ Name change detected: "${existingTask.name}" → "${taskData.name}"`)
      } else {
        dlog(`📝 ○ Name unchanged: "${existingTask.name}"`)
      }

      // Comparar description
      if (taskData.description !== undefined && taskData.description !== existingTask.description) {
        updateData.description = taskData.description || null
        dlog(`📝 ✓ Description change detected`)
      } else {
        dlog(`📝 ○ Description unchanged`)
      }

      // Comparar status
      if (taskData.status) {
        const newStatus = mapClickUpStatusToLocal(taskData.status.status)
        if (newStatus !== existingTask.status) {
          updateData.status = newStatus
          dlog(`📊 ✓ Status change detected: ${existingTask.status} → ${newStatus} (from: ${taskData.status.status})`)
        } else {
          dlog(`📊 ○ Status unchanged: ${existingTask.status}`)
        }
      }

      // Comparar priority
      if (taskData.priority) {
        const priorityMap: Record<string, Priority> = {
          'urgent': 'URGENT',
          'high': 'HIGH',
          'normal': 'NORMAL',
          'low': 'LOW'
        }
        const newPriority = priorityMap[taskData.priority.priority.toLowerCase()] || 'NORMAL'
        
        if (newPriority !== existingTask.priority) {
          updateData.priority = newPriority
          dlog(`🔥 ✓ Priority change detected: ${existingTask.priority} → ${newPriority} (from: ${taskData.priority.priority})`)
        } else {
          dlog(`🔥 ○ Priority unchanged: ${existingTask.priority}`)
        }
      }

      // Comparar fechas
      if (taskData.start_date !== undefined) {
        const newStartDate = taskData.start_date ? new Date(parseInt(taskData.start_date)) : null
        const existingStartTime = existingTask.startDate?.getTime()
        const newStartTime = newStartDate?.getTime()
        
        if (newStartTime !== existingStartTime) {
          updateData.startDate = newStartDate
          dlog(`📅 ✓ Start date change detected: ${existingTask.startDate?.toISOString()} → ${newStartDate?.toISOString()}`)
        } else {
          dlog(`📅 ○ Start date unchanged`)
        }
      }

      if (taskData.due_date !== undefined) {
        const newDeadline = taskData.due_date ? new Date(parseInt(taskData.due_date)) : null
        const existingDeadlineTime = existingTask.deadline?.getTime()
        const newDeadlineTime = newDeadline?.getTime()
        
        if (newDeadlineTime !== existingDeadlineTime) {
          updateData.deadline = newDeadline
          dlog(`📅 ✓ Deadline change detected: ${existingTask.deadline?.toISOString()} → ${newDeadline?.toISOString()}`)
        } else {
          dlog(`📅 ○ Deadline unchanged`)
        }
      }

      if (taskData.time_estimate !== undefined) {
        if (taskData.time_estimate !== existingTask.timeEstimate) {
          updateData.timeEstimate = taskData.time_estimate
          dlog(`⏱️ ✓ Time estimate change detected: ${existingTask.timeEstimate} → ${taskData.time_estimate}`)
        } else {
          dlog(`⏱️ ○ Time estimate unchanged`)
        }
      }
    } else {
      dlog('⚠️ No task data provided in webhook event');
    }

    // ✅ MEJORADO: Actualizar con logs detallados
    dlog(`\n🔄 UPDATE SUMMARY:`);
    dlog(`   Changes detected: ${Object.keys(updateData).length}`);
    dlog(`   Fields to update: ${Object.keys(updateData).join(', ') || 'none'}`);

    if (Object.keys(updateData).length > 0) {
      updateData.lastSyncAt = new Date()
      updateData.syncStatus = 'SYNCED'

      dlog(`💾 Executing database update...`);
      dlog(`💾 Update data:`, JSON.stringify(updateData, null, 2));

      const updatedTask = await prisma.task.update({
        where: { id: event.task_id },
        data: updateData,
        include: {
          tier: true,
          type: true,
          brand: true,
          assignees: {
            include: {
              user: true
            }
          }
        }
      })

      dlog(`✅ Task ${event.task_id} updated successfully in database`);
      dlog(`✅ Updated fields: ${Object.keys(updateData).filter(k => k !== 'lastSyncAt' && k !== 'syncStatus').join(', ')}`);
      dlog(`✅ New sync status: ${updatedTask.syncStatus}`);
      dlog(`✅ New sync time: ${updatedTask.lastSyncAt?.toISOString()}`);

      // La emisión en tiempo real (Pusher) se hace de forma centralizada en POST.

      return NextResponse.json({
        success: true, 
        message: 'Task updated successfully',
        taskId: event.task_id,
        taskName: updatedTask.name,
        updatedFields: Object.keys(updateData).filter(k => k !== 'lastSyncAt' && k !== 'syncStatus'),
        syncStatus: updatedTask.syncStatus,
        lastSyncAt: updatedTask.lastSyncAt
      })
    } else {
      dlog('ℹ️ No changes detected - task already synchronized');
      dlog('ℹ️ This could mean:');
      dlog('   1. Task data in webhook matches local DB exactly');
      dlog('   2. Webhook triggered but no actual changes occurred');
      dlog('   3. Changes are in fields not being tracked');
      
      return NextResponse.json({ 
        success: true, 
        message: 'No changes needed - task already synchronized',
        taskId: event.task_id,
        note: 'All tracked fields match between ClickUp and local database'
      })
    }

  } catch (error) {
    console.error('❌ CRITICAL ERROR updating task:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available')
    console.error('❌ Task ID that failed:', event.task_id)
    console.error('❌ Event that caused failure:', JSON.stringify(event, null, 2))
    
    return NextResponse.json({ 
      error: 'Error updating task',
      details: error instanceof Error ? error.message : 'Unknown error',
      taskId: event.task_id
    })
  }
}

async function handleTaskCreated(event: ClickUpWebhookEvent) {
  dlog('➕ === HANDLING TASK CREATION ===');
  dlog(`📋 Task ID: ${event.task_id}`);
  dlog(`📝 Task Name: ${event.task?.name || 'Unknown'}`);
  
  return NextResponse.json({ 
    message: 'Task creation noted',
    taskId: event.task_id,
    note: 'New tasks from ClickUp should be synced manually via sync interface'
  })
}

async function handleTaskDeleted(event: ClickUpWebhookEvent) {
  dlog('🗑️ === HANDLING TASK DELETION ===');
  dlog(`📋 Task ID: ${event.task_id}`);
  
  if (!event.task_id) {
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    dlog(`🔍 Looking for task ${event.task_id} to mark as deleted...`);
    
    const task = await prisma.task.findUnique({
      where: { id: event.task_id }
    });

    if (!task) {
      dlog(`⚠️ Task ${event.task_id} not found in local database`);
      return NextResponse.json({ 
        message: 'Task not found in local database',
        taskId: event.task_id
      });
    }

    // Soft delete o cambiar estado
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: 'COMPLETE',
        syncStatus: 'DELETED',
        lastSyncAt: new Date()
      }
    })

    dlog(`✅ Task ${event.task_id} marked as deleted/completed`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Task marked as deleted',
      taskId: event.task_id
    })
  } catch (error) {
    console.error('❌ Error deleting task:', error)
    return NextResponse.json({ 
      error: 'Error deleting task',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTaskStatusUpdate(event: ClickUpWebhookEvent) {
  dlog('📊 === HANDLING STATUS UPDATE ===');
  dlog(`📋 Task ID: ${event.task_id}`);
  dlog(`📊 New Status: ${event.task?.status?.status || 'Unknown'}`);
  
  if (!event.task_id || !event.task?.status) {
    return NextResponse.json({ error: 'Missing required data for status update' })
  }

  try {
    const newStatus = mapClickUpStatusToLocal(event.task.status.status)
    dlog(`📊 Mapped status: ${event.task.status.status} → ${newStatus}`);
    
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: newStatus,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED'
      }
    })

    dlog(`✅ Task ${event.task_id} status updated to ${newStatus}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Status updated successfully',
      taskId: event.task_id,
      newStatus,
      originalStatus: event.task.status.status
    })
  } catch (error) {
    console.error('❌ Error updating status:', error)
    return NextResponse.json({ 
      error: 'Error updating status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTaskAssigneeUpdate(event: ClickUpWebhookEvent) {
  dlog('👥 === HANDLING ASSIGNEE UPDATE ===');
  dlog(`📋 Task ID: ${event.task_id}`);
  dlog(`👥 Assignees count: ${event.task?.assignees?.length || 0}`);
  
  if (!event.task_id || !event.task?.assignees) {
    return NextResponse.json({ error: 'Missing required data for assignee update' })
  }

  try {
    // Eliminar asignaciones existentes
    dlog('🗑️ Removing existing task assignments...');
    await prisma.taskAssignment.deleteMany({
      where: { taskId: event.task_id }
    })

    // Crear nuevas asignaciones
    const newAssignments = []
    dlog('👥 Processing new assignees...');
    
    for (const assignee of event.task.assignees) {
      dlog(`   🔍 Checking assignee: ${assignee.username} (ID: ${assignee.id})`);
      
      const user = await prisma.user.findUnique({
        where: { id: assignee.id.toString() }
      })

      if (user) {
        newAssignments.push({
          userId: user.id,
          taskId: event.task_id
        })
        dlog(`   ✅ Added assignee: ${assignee.username}`);
      } else {
        dlog(`   ⚠️ User ${assignee.username} (${assignee.id}) not found in local database`);
      }
    }

    if (newAssignments.length > 0) {
      await prisma.taskAssignment.createMany({
        data: newAssignments
      })
    }

    dlog(`✅ Task ${event.task_id} assignees updated (${newAssignments.length} assignees)`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Assignees updated successfully',
      taskId: event.task_id,
      assigneeCount: newAssignments.length,
      processedAssignees: event.task.assignees.length
    })
  } catch (error) {
    console.error('❌ Error updating assignees:', error)
    return NextResponse.json({ 
      error: 'Error updating assignees',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
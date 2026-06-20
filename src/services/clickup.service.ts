// src/services/clickup.service.ts - VERSIÓN CORREGIDA CON CAMPOS DE TIEMPO

/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import { db } from '@/db'
import { user as userTable, brand as brandTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSyncLog } from '@/utils/sync-log-utils'
import {
  ClickUpTaskCreationParams,
  ClickUpTaskResponse,
  AssigneeDebugInfo,
  Task
} from '@/interfaces'
import { clickupPriorityMap, getClickUpStatusName } from '@/utils/clickup-task-mapping-utils'
import { API_CONFIG } from '@/config'
import { publishTaskUpdate } from '@/lib/pusher'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

// ✅ CONFIGURACIÓN: Cambiar a true cuando tengas plan Unlimited
const USE_CUSTOM_FIELDS = false // Cambiar a true cuando upgrades el plan
const USE_TABLE_COMMENTS = true // Usar tablas en comentarios como alternativa

/**
 * ✅ NUEVA FUNCIÓN: Crea texto plano estructurado para mostrar Type y Category
 * ClickUp mostrará esto como texto simple pero bien formateado
 */
function createMetadataTable(typeName: string, categoryName: string): string {
  // Crear texto plano bien estructurado que se ve profesional
  const metadata = `
  Type: ${typeName}
  Category: ${categoryName}`
  
  return metadata
}

/**
 * ✅ NUEVA FUNCIÓN: Crea un comentario con tabla de metadata en ClickUp
 */
async function createMetadataComment(
  taskId: string,
  typeName: string,
  categoryName: string,
  token: string
): Promise<void> {
  try {
    const markdownTable = createMetadataTable(typeName, categoryName)

    await axios.post(
      `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}/comment`,
      {
        comment_text: markdownTable,
        notify_all: false // No notificar a todos los miembros
      },
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error: any) {
    console.error('Failed to create metadata comment:', error.response?.data || error.message)
    // No lanzar error, ya que es información adicional
  }
}

// ✅ INTERFACES PARA CUSTOM FIELDS (para cuando upgrades)
interface ClickUpCustomField {
  id: string
  name: string
  type: string
  type_config?: {
    default?: number
    placeholder?: string
    options?: Array<{
      id: string
      name: string
      color?: string
    }>
  }
}

interface ClickUpCustomFieldValue {
  id: string
  value: string | number | boolean
}

interface CustomFieldsCache {
  [teamId: string]: {
    typeField?: ClickUpCustomField
    categoryField?: ClickUpCustomField
    timestamp: number
  }
}

const customFieldsCache: CustomFieldsCache = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * ✅ FUNCIÓN HÍBRIDA: Usa custom fields, tabla en comentarios, o tags según la configuración
 */
async function prepareTaskMetadata(
  teamId: string | undefined,
  typeName: string,
  categoryName: string
): Promise<{
  customFields?: ClickUpCustomFieldValue[]
  tags?: string[]
  useTableComment?: boolean
}> {
  if (USE_CUSTOM_FIELDS && teamId) {
    try {
      const customFields = await prepareCustomFields(teamId, typeName, categoryName)
      return { customFields }
    } catch (error) {
      console.error('Custom fields failed, falling back to table comment:', error)
    }
  }

  if (USE_TABLE_COMMENTS) {
    return { useTableComment: true }
  }

  // Fallback final a tags
  const tags = [`type:${typeName}`, `category:${categoryName}`]
  return { tags }
}

/**
 * ✅ CUSTOM FIELDS FUNCTIONS (para cuando tengas plan Unlimited)
 */
async function getCustomFields(teamId: string): Promise<{
  typeField?: ClickUpCustomField
  categoryField?: ClickUpCustomField
}> {
  const cached = customFieldsCache[teamId]
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return {
      typeField: cached.typeField,
      categoryField: cached.categoryField
    }
  }

  try {
    const response = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team/${teamId}/customfields`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const customFields: ClickUpCustomField[] = response.data.fields || []
    
    const typeField = customFields.find(field => 
      field.name.toLowerCase() === 'type' && field.type === 'drop_down'
    )
    
    const categoryField = customFields.find(field => 
      field.name.toLowerCase() === 'category' && field.type === 'label'
    )

    customFieldsCache[teamId] = {
      typeField,
      categoryField,
      timestamp: Date.now()
    }

    return { typeField, categoryField }

  } catch (error: any) {
    console.error('Failed to fetch ClickUp custom fields:', error.response?.data || error.message)
    return {}
  }
}

async function findOrCreateDropdownOption(
  teamId: string,
  fieldId: string,
  optionName: string,
  field: ClickUpCustomField
): Promise<string | null> {
  try {
    const existingOption = field.type_config?.options?.find(
      option => option.name.toLowerCase() === optionName.toLowerCase()
    )

    if (existingOption) {
      return existingOption.id
    }

    const createResponse = await axios.post(
      `${API_CONFIG.CLICKUP_API_BASE}/team/${teamId}/customfields/${fieldId}/options`,
      {
        name: optionName,
        color: null
      },
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    const newOptionId = createResponse.data.id

    if (!field.type_config) field.type_config = {}
    if (!field.type_config.options) field.type_config.options = []
    field.type_config.options.push({
      id: newOptionId,
      name: optionName
    })

    return newOptionId

  } catch (error: any) {
    console.error(`Failed to create custom field option "${optionName}":`, error.response?.data || error.message)
    return null
  }
}

function processLabelField(categoryName: string): string {
  return categoryName
}

async function prepareCustomFields(
  teamId: string,
  typeName: string,
  categoryName: string
): Promise<ClickUpCustomFieldValue[]> {
  const customFieldsValues: ClickUpCustomFieldValue[] = []
  
  const { typeField, categoryField } = await getCustomFields(teamId)

  if (typeField) {
    const typeOptionId = await findOrCreateDropdownOption(teamId, typeField.id, typeName, typeField)
    if (typeOptionId) {
      customFieldsValues.push({
        id: typeField.id,
        value: typeOptionId
      })
    }
  }

  if (categoryField) {
    const labelValue = processLabelField(categoryName)
    customFieldsValues.push({
      id: categoryField.id,
      value: labelValue
    })
  }

  return customFieldsValues
}

export async function createTaskInClickUp(
  params: ClickUpTaskCreationParams & { customDurationDays?: number },
  token?: string
): Promise<ClickUpTaskResponse> {
  const { name, description, priority, deadline, startDate, usersToAssign, tier, brand } = params
  // [SaaS] Crea en el ClickUp del inquilino (su token); fallback al global.
  const authToken = token ?? CLICKUP_TOKEN

  const clickupAssignees: number[] = []
  const assigneeDebugInfo: AssigneeDebugInfo[] = []

  for (const userId of usersToAssign) {
    const user = await db.query.user.findFirst({ where: eq(userTable.id, userId) })
    const debugInfo: AssigneeDebugInfo = {
      userId,
      userName: user?.name,
      clickupId: user?.id,
      willBeAssigned: false,
      reason: ''
    }

    if (!user) {
      debugInfo.reason = 'Usuario no encontrado en DB local.'
    } else if (!user.id) {
      debugInfo.reason = 'Usuario no tiene ClickUp ID.'
    } else {
      const clickupIdNum = parseInt(user.id)
      if (isNaN(clickupIdNum)) {
        debugInfo.reason = `ClickUp ID no es un número válido: "${user.id}"`
      } else {
        clickupAssignees.push(clickupIdNum)
        debugInfo.willBeAssigned = true
        debugInfo.reason = `Asignado: ${clickupIdNum}`
      }
    }
    assigneeDebugInfo.push(debugInfo)
  }

  // ✅ PREPARAR METADATA (Custom Fields, Table Comment, o Tags)
  const metadata = await prepareTaskMetadata(
    brand.teamId ?? undefined,
    String(tier.name),
    String(tier.name)
  )

  // ✅ TIMESTAMPS para ClickUp
  const startTimestamp = startDate.getTime()
  const deadlineTimestamp = deadline.getTime()

  const clickUpPayload: any = {
    name: name,
    description: description || '',
    priority: clickupPriorityMap[priority] || 3,
    due_date: deadlineTimestamp,
    due_date_time: true,
    start_date: startTimestamp,  
    start_date_time: true,
    assignees: clickupAssignees,
    status: getClickUpStatusName(brand.defaultStatus),
  }

  // Agregar custom fields o tags según configuración
  if (metadata.customFields) {
    clickUpPayload.custom_fields = metadata.customFields
  } else if (metadata.tags) {
    clickUpPayload.tags = metadata.tags
  }

  try {
    const response = await axios.post(
      `${ API_CONFIG.CLICKUP_API_BASE }/list/${brand.id}/task`,
      clickUpPayload,
      {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
        },
      }
    )

    await createSyncLog('Task', null, response.data.id, 'CREATE', 'SUCCESS', undefined, response.data)

    // ✅ CREAR COMENTARIO CON TABLA SI ESTÁ HABILITADO
    if (metadata.useTableComment && authToken) {
      await createMetadataComment(
        response.data.id,
        String(tier.name),
        String(tier.name),
        authToken
      )
    }

    return {
      clickupTaskId: response.data.id,
      clickupTaskUrl: response.data.url
    }

  } catch (error: unknown) {
    const axiosError = error as any
    const errorMessage = `Error al crear tarea en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`

    console.error('ClickUp API error while creating task:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      errorData: axiosError.response?.data,
      sentPayload: clickUpPayload,
      url: axiosError.config?.url,
      message: axiosError.message,
    })

    await createSyncLog('Task', null, 'temp-id-failed-create', 'CREATE', 'ERROR', errorMessage, axiosError.response?.data)
    throw error
  }
}

/**
 * Reprograma SOLO las fechas (start/due) de una tarea en ClickUp. A diferencia de
 * `updateTaskInClickUp`, NO toca status, asignados ni comentarios, y es token-aware
 * (multi-tenant). La usa el empuje en cascada de Low: cuando entra una tarea de mayor
 * prioridad, mueve las Low del diseñador a la siguiente fecha. Lanza si falla (el que
 * llama decide si corta la cascada).
 */
export async function rescheduleClickUpTaskDates(
  taskId: string,
  dates: { startDate: Date; dueDate: Date },
  token?: string
): Promise<void> {
  const authToken = token ?? CLICKUP_TOKEN
  if (!authToken) {
    throw new Error('CLICKUP token no configurado; no se puede reprogramar la tarea.')
  }

  const payload = {
    start_date: dates.startDate.getTime(),
    start_date_time: true,
    due_date: dates.dueDate.getTime(),
    due_date_time: true,
  }

  try {
    const response = await axios.put(`${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`, payload, {
      headers: { Authorization: authToken, 'Content-Type': 'application/json' },
    })
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'SUCCESS', undefined, response.data)
  } catch (error: unknown) {
    const axiosError = error as any
    const errorMessage = `Error al reprogramar fechas de la tarea ${taskId}: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`
    console.error('ClickUp API error while rescheduling task dates:', {
      status: axiosError.response?.status,
      errorData: axiosError.response?.data,
      taskId,
    })
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'ERROR', errorMessage, axiosError.response?.data)
    throw error
  }
}

// También agregar debug en updateTaskInClickUp

export async function updateTaskInClickUp(taskId: string, updatedTaskData: Task): Promise<void> {
  if (!CLICKUP_TOKEN) {
    console.error('CLICKUP_API_TOKEN is not configured; cannot update task in ClickUp.')
    throw new Error('CLICKUP_API_TOKEN no configurado.')
  }

  const brand = await db.query.brand.findFirst({ where: eq(brandTable.id, updatedTaskData.brandId) });
  if (!brand) {
    console.warn(`Brand not found for task ${taskId}; cannot update status in ClickUp.`);
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'WARNING', 'Brand no encontrado para mapeo de estado.');
    return;
  }

  const clickupAssignees: number[] = [];
  if (updatedTaskData.assignees && updatedTaskData.assignees.length > 0) {
    for (const assignee of updatedTaskData.assignees) {
      const clickupIdNum = parseInt(assignee.userId);
      if (!isNaN(clickupIdNum)) {
        clickupAssignees.push(clickupIdNum);
      }
    }
  }

  // ✅ PREPARAR METADATA PARA ACTUALIZACIÓN
  const metadata = await prepareTaskMetadata(
    brand.teamId ?? undefined,
    updatedTaskData.type.name,
    String(updatedTaskData.tier.name)
  )

  // ✅ SOLUCIÓN: Agregar campos de tiempo para actualizaciones también
  const clickUpPayload: any = {
    name: updatedTaskData.name,
    description: updatedTaskData.description || '',
    priority: clickupPriorityMap[updatedTaskData.priority] || 3,
    due_date: updatedTaskData.deadline.getTime(),
    due_date_time: true,          // ✅ NUEVO: Incluir tiempo en due_date
    start_date: updatedTaskData.startDate.getTime(),
    start_date_time: true,        // ✅ NUEVO: Incluir tiempo en start_date
    assignees: clickupAssignees,
    status: getClickUpStatusName(updatedTaskData.status)
  };

  // Agregar custom fields o tags según configuración
  if (metadata.customFields) {
    clickUpPayload.custom_fields = metadata.customFields
  } else if (metadata.tags) {
    clickUpPayload.tags = metadata.tags
  }

  try {
    const response = await axios.put(
      `${ API_CONFIG.CLICKUP_API_BASE }/task/${taskId}`,
      clickUpPayload,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    // ✅ ACTUALIZAR COMENTARIO CON TABLA SI ESTÁ HABILITADO
    if (metadata.useTableComment) {
      // Nota: Para actualizaciones, podrías crear un nuevo comentario o implementar lógica
      // para buscar y actualizar el comentario existente con metadata
      await createMetadataComment(
        taskId,
        updatedTaskData.type.name,
        String(updatedTaskData.tier.name),
        CLICKUP_TOKEN as string
      )
    }

    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'SUCCESS', undefined, response.data);
  } catch (error: unknown) {
    const axiosError = error as any;
    const errorMessage = `Error al actualizar tarea ${taskId} en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`;
    console.error('ClickUp API error while updating task:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      errorData: axiosError.response?.data,
      sentPayload: axiosError.config?.data,
      url: axiosError.config?.url,
      message: axiosError.message,
    });
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'ERROR', errorMessage, axiosError.response?.data);
    throw error;
  }
}

export async function emitTaskUpdateEvent(taskData: unknown): Promise<void> {
  const t = (taskData ?? {}) as { id?: string; name?: string; status?: string }
  await publishTaskUpdate({ taskId: t.id, name: t.name, status: t.status, event: 'taskUpdated' })
}

/**
 * ✅ FUNCIÓN PARA CAMBIAR ENTRE MODOS
 */
export function enableCustomFields(): void {
  // En producción, esto debería ser una variable de entorno
  // USE_CUSTOM_FIELDS = true
  // USE_TABLE_COMMENTS = false
}

export function invalidateCustomFieldsCache(teamId: string): void {
  delete customFieldsCache[teamId]
}

/**
 * ✅ NUEVA FUNCIÓN: Preview de cómo se ve la tabla
 */
export function previewMetadataTable(typeName: string, categoryName: string): string {
  return createMetadataTable(typeName, categoryName)
}
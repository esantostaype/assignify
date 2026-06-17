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
  categoryName: string
): Promise<void> {
  try {
    const markdownTable = createMetadataTable(typeName, categoryName)
    
    console.log(`📝 Creando comentario con tabla de metadata para tarea ${taskId}`)
    
    await axios.post(
      `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}/comment`,
      {
        comment_text: markdownTable,
        notify_all: false // No notificar a todos los miembros
      },
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )
    
    console.log(`✅ Comentario con tabla de metadata creado exitosamente`)
    
  } catch (error: any) {
    console.error('❌ Error creando comentario con metadata:', error.response?.data || error.message)
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
      console.log(`✅ Usando Custom Fields para Type y Category`)
      return { customFields }
    } catch (error) {
      console.error('❌ Error con Custom Fields, fallback a tabla en comentarios:', error)
    }
  }
  
  if (USE_TABLE_COMMENTS) {
    console.log(`📊 Usando tabla en comentarios para Type y Category`)
    return { useTableComment: true }
  }
  
  // Fallback final a tags
  const tags = [`type:${typeName}`, `category:${categoryName}`]
  console.log(`🏷️ Usando Tags para Type y Category: ${tags.join(', ')}`)
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
    console.log(`📋 Custom fields obtenidos del cache para team ${teamId}`)
    return {
      typeField: cached.typeField,
      categoryField: cached.categoryField
    }
  }

  try {
    console.log(`🔍 Obteniendo custom fields de ClickUp para team ${teamId}`)
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

    console.log(`✅ Custom fields encontrados:`)
    console.log(`   - Type Field (dropdown): ${typeField ? `✓ ID: ${typeField.id}` : '✗ No encontrado'}`)
    console.log(`   - Category Field (label): ${categoryField ? `✓ ID: ${categoryField.id}` : '✗ No encontrado'}`)

    return { typeField, categoryField }

  } catch (error: any) {
    console.error('❌ Error obteniendo custom fields:', error.response?.data || error.message)
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
      console.log(`✅ Opción existente encontrada: "${optionName}" -> ID: ${existingOption.id}`)
      return existingOption.id
    }

    console.log(`🔄 Creando nueva opción "${optionName}" en custom field ${field.name}`)
    
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
    console.log(`✅ Nueva opción creada: "${optionName}" -> ID: ${newOptionId}`)

    if (!field.type_config) field.type_config = {}
    if (!field.type_config.options) field.type_config.options = []
    field.type_config.options.push({
      id: newOptionId,
      name: optionName
    })

    return newOptionId

  } catch (error: any) {
    console.error(`❌ Error creando opción "${optionName}":`, error.response?.data || error.message)
    return null
  }
}

function processLabelField(categoryName: string): string {
  console.log(`🏷️ Configurando label field con valor: "${categoryName}"`)
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
      console.log(`📋 Type custom field configurado: ${typeName} (Option ID: ${typeOptionId})`)
    }
  } else {
    console.warn(`⚠️ Custom field "Type" (dropdown) no encontrado en ClickUp para team ${teamId}`)
  }

  if (categoryField) {
    const labelValue = processLabelField(categoryName)
    customFieldsValues.push({
      id: categoryField.id,
      value: labelValue
    })
    console.log(`🏷️ Category custom field configurado: ${categoryName} (Label: ${labelValue})`)
  } else {
    console.warn(`⚠️ Custom field "Category" (label) no encontrado en ClickUp para team ${teamId}`)
  }

  return customFieldsValues
}

export async function createTaskInClickUp(params: ClickUpTaskCreationParams & { customDurationDays?: number }): Promise<ClickUpTaskResponse> {
  const { name, description, priority, deadline, startDate, usersToAssign, tier, brand } = params

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
    console.log(`📡 Enviando request a ClickUp: ${API_CONFIG.CLICKUP_API_BASE}/list/${brand.id}/task`)
    
    const response = await axios.post(
      `${ API_CONFIG.CLICKUP_API_BASE }/list/${brand.id}/task`,
      clickUpPayload,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('✅ Respuesta de ClickUp:')
    console.log(`   Task ID: ${response.data.id}`)
    console.log(`   Task URL: ${response.data.url}`)
    
    // 🧪 DEBUG: Verificar qué devolvió ClickUp
    if (response.data.start_date) {
      const returnedStart = new Date(parseInt(response.data.start_date))
      console.log(`   Start date returned: ${returnedStart.toISOString()} (${returnedStart.toLocaleString('es-PE', { timeZone: 'America/Lima' })})`)
    }
    if (response.data.due_date) {
      const returnedDue = new Date(parseInt(response.data.due_date))
      console.log(`   Due date returned: ${returnedDue.toISOString()} (${returnedDue.toLocaleString('es-PE', { timeZone: 'America/Lima' })})`)
    }

    await createSyncLog('Task', null, response.data.id, 'CREATE', 'SUCCESS', undefined, response.data)

    // ✅ CREAR COMENTARIO CON TABLA SI ESTÁ HABILITADO
    if (metadata.useTableComment) {
      await createMetadataComment(
        response.data.id,
        String(tier.name),
        String(tier.name)
      )
    }

    console.log(`🎉 === TAREA "${name}" CREADA EN CLICKUP EXITOSAMENTE ===\n`)

    return {
      clickupTaskId: response.data.id,
      clickupTaskUrl: response.data.url
    }

  } catch (error: unknown) {
    const axiosError = error as any
    const errorMessage = `Error al crear tarea en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`

    console.error('❌ Error de ClickUp API:', {
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

// También agregar debug en updateTaskInClickUp

export async function updateTaskInClickUp(taskId: string, updatedTaskData: Task): Promise<void> {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado para actualizar tarea en ClickUp.')
    throw new Error('CLICKUP_API_TOKEN no configurado.')
  }

  const brand = await db.query.brand.findFirst({ where: eq(brandTable.id, updatedTaskData.brandId) });
  if (!brand) {
    console.warn(`Brand no encontrado para la tarea ${taskId}. No se puede actualizar el estado en ClickUp.`);
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

  console.log(`📤 Enviando actualización a ClickUp API para tarea ${taskId}:`);
  console.log('   URL:', `${ API_CONFIG.CLICKUP_API_BASE }/task/${taskId}`);
  console.log('   Use Custom Fields:', USE_CUSTOM_FIELDS);
  console.log('   Use Table Comments:', USE_TABLE_COMMENTS);
  console.log('   Start DateTime:', new Date(updatedTaskData.startDate).toISOString());
  console.log('   Due DateTime:', new Date(updatedTaskData.deadline).toISOString());

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
        String(updatedTaskData.tier.name)
      )
    }

    console.log(`✅ Tarea ${taskId} actualizada en ClickUp.`);
    await createSyncLog('Task', null, taskId, 'UPDATE_CLICKUP', 'SUCCESS', undefined, response.data);
  } catch (error: unknown) {
    const axiosError = error as any;
    const errorMessage = `Error al actualizar tarea ${taskId} en ClickUp: ${axiosError.response?.data?.err || axiosError.message || axiosError.toString()}`;
    console.error('❌ Error de ClickUp API al actualizar tarea:', {
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
  console.log('🔄 Habilitando Custom Fields para futuras tareas...')
  // En producción, esto debería ser una variable de entorno
  // USE_CUSTOM_FIELDS = true
  // USE_TABLE_COMMENTS = false
}

export function invalidateCustomFieldsCache(teamId: string): void {
  delete customFieldsCache[teamId]
  console.log(`🗑️ Cache de custom fields invalidado para team ${teamId}`)
}

/**
 * ✅ NUEVA FUNCIÓN: Preview de cómo se ve la tabla
 */
export function previewMetadataTable(typeName: string, categoryName: string): string {
  return createMetadataTable(typeName, categoryName)
}
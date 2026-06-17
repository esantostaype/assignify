/* eslint-disable @typescript-eslint/no-unused-vars */
// src/utils/clickup-task-mapping-utils.ts - VERSIÓN ACTUALIZADA PARA DONE

/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/db';
import { taskType as taskTypeTable, tierList } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Priority, Status, Tier } from '@/db/enums';

/**
 * ✅ MAPA DE PRIORIDADES: Mapea prioridades locales a valores de ClickUp
 */
export const clickupPriorityMap: Record<Priority, number> = {
  'URGENT': 1,
  'HIGH': 2,
  'NORMAL': 3,
  'LOW': 4
};

/**
 * ✅ ACTUALIZADO: Mapea estados de ClickUp a estados locales INCLUYENDO COMPLETE
 */
export function mapClickUpStatusToLocal(clickupStatus: string): Status {
  // Normalizar el estado (minúsculas y trim)
  const normalizedStatus = clickupStatus.toLowerCase().trim();
  
  // ✅ ACTUALIZADO: Mapeo exhaustivo incluyendo más variaciones de COMPLETE
  const statusMap: Record<string, Status> = {
    // TO_DO variations
    'to do': Status.TO_DO,
    'todo': Status.TO_DO,
    'open': Status.TO_DO,
    'backlog': Status.TO_DO,
    'new': Status.TO_DO,
    'pending': Status.TO_DO,
    'ready': Status.TO_DO,
    'not started': Status.TO_DO,
    'created': Status.TO_DO,
    
    // IN_PROGRESS variations  
    'in progress': Status.IN_PROGRESS,
    'inprogress': Status.IN_PROGRESS,
    'in-progress': Status.IN_PROGRESS,
    'working': Status.IN_PROGRESS,
    'active': Status.IN_PROGRESS,
    'doing': Status.IN_PROGRESS,
    'wip': Status.IN_PROGRESS,
    'started': Status.IN_PROGRESS,
    'in development': Status.IN_PROGRESS,
    'development': Status.IN_PROGRESS,
    
    // ON_APPROVAL variations
    'on approval': Status.ON_APPROVAL,
    'onapproval': Status.ON_APPROVAL,
    'on-approval': Status.ON_APPROVAL,
    'approval': Status.ON_APPROVAL,
    'review': Status.ON_APPROVAL,
    'reviewing': Status.ON_APPROVAL,
    'pending review': Status.ON_APPROVAL,
    'pending approval': Status.ON_APPROVAL,
    'waiting for approval': Status.ON_APPROVAL,
    'for review': Status.ON_APPROVAL,
    'ready for review': Status.ON_APPROVAL,
    'under review': Status.ON_APPROVAL,
    'needs review': Status.ON_APPROVAL,
    'in review': Status.ON_APPROVAL,
    'client review': Status.ON_APPROVAL,
    
    // ✅ ACTUALIZADO: COMPLETE variations más exhaustivas
    'complete': Status.COMPLETE,
    'completed': Status.COMPLETE,
    'done': Status.COMPLETE,
    'finished': Status.COMPLETE,
    'closed': Status.COMPLETE,
    'resolved': Status.COMPLETE,
    'delivered': Status.COMPLETE,
    'approved': Status.COMPLETE,
    'accepted': Status.COMPLETE,
    'verified': Status.COMPLETE,
    'deployed': Status.COMPLETE,
    'live': Status.COMPLETE,
    'published': Status.COMPLETE,
    'shipped': Status.COMPLETE,
    'merged': Status.COMPLETE,
    'released': Status.COMPLETE,
    'production': Status.COMPLETE,
    'validated': Status.COMPLETE,
    'confirmed': Status.COMPLETE,
    'final': Status.COMPLETE,
    'success': Status.COMPLETE,
    'completed successfully': Status.COMPLETE,
    'task complete': Status.COMPLETE,
    'work done': Status.COMPLETE,
    // Variaciones en otros idiomas comunes
    'terminado': Status.COMPLETE,
    'completado': Status.COMPLETE,
    'finalizado': Status.COMPLETE,
    'listo': Status.COMPLETE,
  };
  
  const mappedStatus = statusMap[normalizedStatus];

  if (mappedStatus) {
    return mappedStatus;
  }

  return Status.TO_DO; // Default fallback
}

/**
 * ✅ ACTUALIZADO: Mapea estados locales a nombres de ClickUp
 */
export const getClickUpStatusName = (localStatus: Status): string => {
  const statusMap: Record<Status, string> = {
    [Status.TO_DO]: 'to do',
    [Status.IN_PROGRESS]: 'in progress',
    [Status.ON_APPROVAL]: 'review',
    [Status.COMPLETE]: 'complete' // ✅ ACTUALIZADO: Mapear COMPLETE a 'complete'
  };

  return statusMap[localStatus] || 'to do';
};

/**
 * ✅ NUEVO: Función para verificar si un estado indica tarea completada
 */
export function isCompletedStatus(status: string): boolean {
  const completedStatuses = [
    'complete', 'completed', 'done', 'finished', 'closed', 'resolved',
    'delivered', 'approved', 'accepted', 'verified', 'deployed', 'live',
    'published', 'shipped', 'merged', 'released', 'production', 'validated',
    'confirmed', 'final', 'success', 'terminado', 'completado', 'finalizado'
  ];
  
  return completedStatuses.includes(status.toLowerCase().trim());
}

/**
 * ✅ NUEVO: Función para obtener color del estado
 */
export function getStatusColor(status: Status): string {
  const colorMap: Record<Status, string> = {
    [Status.TO_DO]: '#6B7280',      // Gray
    [Status.IN_PROGRESS]: '#3B82F6', // Blue
    [Status.ON_APPROVAL]: '#F59E0B', // Yellow
    [Status.COMPLETE]: '#10B981'     // Green
  };
  
  return colorMap[status] || '#6B7280';
}

/**
 * ✅ NUEVO: Función para obtener icono del estado
 */
export function getStatusIcon(status: Status): string {
  const iconMap: Record<Status, string> = {
    [Status.TO_DO]: '📋',
    [Status.IN_PROGRESS]: '⚡',
    [Status.ON_APPROVAL]: '👀',
    [Status.COMPLETE]: '✅'
  };
  
  return iconMap[status] || '📋';
}

/**
 * ✅ ACTUALIZADO: Inferir tipo y tier (ya no existe TaskCategory; Task -> tier directo)
 * Devuelve typeId y tierId. El tier se infiere por palabras clave; si no se resuelve, usa el tier 'D' por defecto.
 */
export async function inferTaskTypeAndTier(taskName: string, clickupTags: string[]): Promise<{ typeId: number; tierId: number }> {
  let inferredTypeName: string | null = null;
  let inferredCategoryName: string | null = null;
  let inferredDuration: number = 2; // Default days (used if category needs to be created)
  let inferredTier: Tier = Tier.C; // Default tier (used if category needs to be created)

  const tagsLower = clickupTags.map(tag => tag.toLowerCase());

  // 1. Priorizar la extracción de Type y Category de los tags
  for (const tag of tagsLower) {
    if (tag.startsWith('type:')) {
      inferredTypeName = tag.substring('type:'.length).trim();
    }
    if (tag.startsWith('category:')) {
      inferredCategoryName = tag.substring('category:'.length).trim();
    }
  }

  // Si no se encontró el tipo o categoría en los tags, usar la lógica de palabras clave (fallback)
  if (!inferredTypeName || !inferredCategoryName) {
    const nameLower = taskName.toLowerCase();

    // Lógica de inferencia por palabras clave (similar a la anterior)
    if (['ux', 'ui', 'user experience', 'user interface'].some(keyword => nameLower.includes(keyword) || tagsLower.includes(keyword))) {
      if (!inferredTypeName) inferredTypeName = 'UX/UI Design';
      if (!inferredCategoryName) {
        if (nameLower.includes('research') || tagsLower.includes('research')) {
          inferredCategoryName = 'UX Research'; inferredDuration = 5; inferredTier = Tier.A;
        } else if (nameLower.includes('wireframe') || tagsLower.includes('wireframe')) {
          inferredCategoryName = 'Wireframing'; inferredDuration = 3; inferredTier = Tier.B;
        } else {
          inferredCategoryName = 'UI Design'; inferredDuration = 4; inferredTier = Tier.B;
        }
      }
    } else if (['graphic', 'branding', 'logo', 'print'].some(keyword => nameLower.includes(keyword) || tagsLower.includes(keyword))) {
      if (!inferredTypeName) inferredTypeName = 'Graphic Design';
      if (!inferredCategoryName) {
        if (nameLower.includes('logo') || tagsLower.includes('logo')) {
          inferredCategoryName = 'Logo Design'; inferredDuration = 7; inferredTier = Tier.S;
        } else if (nameLower.includes('banner') || tagsLower.includes('banner')) {
          inferredCategoryName = 'Banner Design'; inferredDuration = 1; inferredTier = Tier.D;
        } else {
          inferredCategoryName = 'General Graphic'; inferredDuration = 2; inferredTier = Tier.C;
        }
      }
    }
  }

  // Si después de todo, sigue sin haber un tipo/categoría, usar defaults genéricos
  if (!inferredTypeName) inferredTypeName = 'General Design';
  if (!inferredCategoryName) inferredCategoryName = 'Miscellaneous';

  // Busca o crea el TaskType
  let taskType = await db.query.taskType.findFirst({ where: eq(taskTypeTable.name, inferredTypeName) });
  if (!taskType) {
    [taskType] = await db.insert(taskTypeTable).values({ name: inferredTypeName }).returning();
  }

  // ✅ Resolver el tier inferido. Si no existe, usar el tier por defecto 'D'.
  let tierRecord = await db.query.tierList.findFirst({
    where: eq(tierList.name, inferredTier)
  });

  if (!tierRecord) {
    tierRecord = await db.query.tierList.findFirst({ where: eq(tierList.name, Tier.D) });
  }

  if (!tierRecord) {
    throw new Error(`Default tier 'D' not found in database`);
  }

  return {
    typeId: taskType.id,
    tierId: tierRecord.id
  };
}
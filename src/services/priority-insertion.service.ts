// PASO 1: CREAR ARCHIVO
// src/services/priority-insertion.service.ts

import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';

interface TaskForInsertion {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
  priority: Priority;
  customDuration?: number | null;
  tier: {
    duration: number;
  };
}

interface InsertionResult {
  startDate: Date;
  deadline: Date;
  affectedTasks: TaskForInsertion[];
  insertionReason: string;
}

/**
 * 🔴 URGENT: Inserción inmediata
 */
async function handleUrgentPriority(
  userTasks: TaskForInsertion[], 
  durationDays: number
): Promise<InsertionResult> {
  console.log('🔴 URGENT: Inserción inmediata');
  
  const newStartDate = await getNextAvailableStart(new Date());
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  // Todas las tareas se empujan
  const affectedTasks = userTasks;
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    affectedTasks: affectedTasks,
    insertionReason: 'URGENT: Inserción inmediata, empuja todas las tareas'
  };
}

/**
 * 🟡 HIGH: Después de primera tarea
 */
async function handleHighPriority(
  userTasks: TaskForInsertion[], 
  durationDays: number
): Promise<InsertionResult> {
  console.log('🟡 HIGH: Después de primera tarea');
  
  if (userTasks.length === 0) {
    return handleUrgentPriority([], durationDays);
  }
  
  const firstTask = userTasks[0];
  const newStartDate = await getNextAvailableStart(firstTask.deadline);
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  const affectedTasks = userTasks.slice(1);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    affectedTasks: affectedTasks,
    insertionReason: `HIGH: Después de "${firstTask.name}"`
  };
}

/**
 * 🔵 NORMAL: Intercalado con LOW
 */
async function handleNormalPriority(
  userTasks: TaskForInsertion[], 
  durationDays: number
): Promise<InsertionResult> {
  console.log('🔵 NORMAL: Intercalado con LOW');
  
  if (userTasks.length === 0) {
    const newStartDate = await getNextAvailableStart(new Date());
    const taskHours = durationDays * 8;
    const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
    
    return {
      startDate: newStartDate,
      deadline: newDeadline,
      affectedTasks: [],
      insertionReason: 'NORMAL: Primera tarea del usuario'
    };
  }
  
  let insertAfterIndex = -1;
  let insertionReason = '';
  
  // Buscar punto de intercalado
  for (let i = userTasks.length - 1; i >= 0; i--) {
    const task = userTasks[i];
    
    if (task.priority === 'LOW') {
      const normalsBefore = userTasks.slice(0, i)
        .filter(t => t.priority === 'NORMAL').length;
      
      if (normalsBefore < 5) {
        insertAfterIndex = i - 1;
        insertionReason = `NORMAL: Intercalado antes de LOW "${task.name}" (${normalsBefore}/5)`;
        break;
      }
    }
  }
  
  if (insertAfterIndex === -1) {
    insertAfterIndex = userTasks.length - 1;
    insertionReason = 'NORMAL: Al final';
  }
  
  const insertAfterDate = insertAfterIndex >= 0 ? 
    userTasks[insertAfterIndex].deadline : new Date();
  
  const newStartDate = await getNextAvailableStart(insertAfterDate);
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  const affectedTasks = userTasks.slice(insertAfterIndex + 1);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    affectedTasks: affectedTasks,
    insertionReason: insertionReason
  };
}

/**
 * 🟢 LOW: Al final con límites
 */
async function handleLowPriority(
  userTasks: TaskForInsertion[], 
  durationDays: number
): Promise<InsertionResult> {
  console.log('🟢 LOW: Al final con límites');
  
  // Contar LOW consecutivas al final
  let consecutiveLow = 0;
  for (let i = userTasks.length - 1; i >= 0; i--) {
    if (userTasks[i].priority === 'LOW') {
      consecutiveLow++;
    } else {
      break;
    }
  }
  
  let newStartDate: Date;
  let affectedTasks: TaskForInsertion[] = [];
  let insertionReason: string;
  
  if (consecutiveLow < 4) {
    // Al final
    const lastTask = userTasks[userTasks.length - 1];
    const insertAfterDate = lastTask ? lastTask.deadline : new Date();
    newStartDate = await getNextAvailableStart(insertAfterDate);
    insertionReason = `LOW: Al final (${consecutiveLow}/4 LOW)`;
  } else {
    // Antes del grupo de LOW
    const insertBefore = userTasks.length - consecutiveLow;
    const insertAfterDate = insertBefore > 0 ? 
      userTasks[insertBefore - 1].deadline : new Date();
    newStartDate = await getNextAvailableStart(insertAfterDate);
    affectedTasks = userTasks.slice(insertBefore);
    insertionReason = 'LOW: Antes del grupo (límite 4 LOW alcanzado)';
  }
  
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    affectedTasks: affectedTasks,
    insertionReason: insertionReason
  };
}

/**
 * 🎯 FUNCIÓN PRINCIPAL
 */
export async function calculatePriorityInsertion(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<InsertionResult> {
  console.log(`\n🎯 Calculando inserción: Usuario ${userId}, Prioridad ${priority}, ${durationDays} días`);
  
  // Obtener timeline actual
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    include: {
      tier: true
    }
  }) as unknown as TaskForInsertion[];
  
  console.log(`📊 Tareas existentes: ${userTasks.length}`);
  
  // Calcular inserción según prioridad
  let result: InsertionResult;
  
  switch (priority) {
    case 'URGENT':
      result = await handleUrgentPriority(userTasks, durationDays);
      break;
    case 'HIGH':
      result = await handleHighPriority(userTasks, durationDays);
      break;
    case 'NORMAL':
      result = await handleNormalPriority(userTasks, durationDays);
      break;
    case 'LOW':
      result = await handleLowPriority(userTasks, durationDays);
      break;
    default:
      throw new Error(`Prioridad desconocida: ${priority}`);
  }
  
  console.log(`✅ Resultado: ${result.startDate.toISOString()} → ${result.deadline.toISOString()}`);
  console.log(`💭 Razón: ${result.insertionReason}`);
  
  return result;
}

/**
 * 🔄 Recalcular tareas afectadas
 */
export async function shiftTasksAfterInsertion(
  affectedTasks: TaskForInsertion[],
  newTaskDeadline: Date
): Promise<void> {
  if (affectedTasks.length === 0) return;
  
  console.log(`🔄 Recalculando ${affectedTasks.length} tareas afectadas`);
  
  let currentDate = newTaskDeadline;
  
  for (const task of affectedTasks) {
    const taskDuration = task.customDuration ?? task.tier.duration;
    const taskHours = taskDuration * 8;
    
    const newStartDate = await getNextAvailableStart(currentDate);
    const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
    
    await prisma.task.update({
      where: { id: task.id },
      data: {
        startDate: newStartDate,
        deadline: newDeadline
      }
    });
    
    currentDate = newDeadline;
  }
  
  console.log('✅ Recálculo completado');
}
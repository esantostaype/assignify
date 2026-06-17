/* eslint-disable @typescript-eslint/no-unused-vars */
// src/services/parallel-priority-insertion.service.ts - CORREGIDO
// 🎯 NUEVA LÓGICA: Prioridades en paralelo sin empujar fechas + VACACIONES + SOLO TAREAS FUTURAS

import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';
import { UserVacation } from '@/interfaces';

interface TaskForParallelInsertion {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
  priority: Priority;
  customDuration?: number | null;
  createdAt: Date;
  tier: {
    duration: number;
  };
}

interface ParallelInsertionResult {
  startDate: Date;
  deadline: Date;
  insertionReason: string;
  parallelWith?: {
    taskId: string;
    taskName: string;
    originalStartDate: Date;
  };
  noTasksAffected: boolean;
  vacationAdjustment?: {
    originalDate: Date;
    adjustedDate: Date;
    conflictingVacations: string[];
  };
  tasksToMove?: { taskId: string; newStartDate: Date; newDeadline: Date }[];
}

/**
 * 🏖️ FUNCIÓN: Obtener próxima fecha disponible después de vacaciones
 */
async function getNextAvailableStartAfterVacations(
  baseDate: Date,
  vacations: UserVacation[],
  taskDurationDays: number = 0
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);

  const sortedVacations = vacations.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let adjusted = true;
  const maxIterations = 10;
  let iterations = 0;

  console.log(`🏖️ Verificando ${sortedVacations.length} vacaciones para fecha base: ${baseDate.toISOString()}`);

  while (adjusted && iterations < maxIterations) {
    adjusted = false;
    iterations++;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = taskDurationDays > 0
      ? await calculateWorkingDeadline(availableDate, taskHours)
      : availableDate;

    console.log(`   🔍 Iteración ${iterations}: Verificando ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      const hasConflict = availableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        console.log(`   ❌ CONFLICTO DETECTADO:`);
        console.log(`      Tarea: ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);
        console.log(`      Vacación: ${vacStart.toISOString()} → ${vacEnd.toISOString()}`);
        
        const dayAfterVacation = new Date(vacEnd);
        dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
        const newAvailableDate = await getNextAvailableStart(dayAfterVacation);

        console.log(`   🔄 Moviendo tarea a: ${newAvailableDate.toISOString()}`);
        
        availableDate = newAvailableDate;
        adjusted = true;
        break;
      }
    }
  }

  console.log(`   ✅ Fecha final después de vacaciones: ${availableDate.toISOString()}`);
  return availableDate;
}

/**
 * 🏖️ FUNCIÓN: Aplicar lógica de vacaciones a resultado de inserción
 */
async function applyVacationLogic(
  userId: string,
  insertionResult: ParallelInsertionResult,
  taskDurationDays: number
): Promise<ParallelInsertionResult> {
  console.log(`🏖️ Aplicando lógica de vacaciones para usuario ${userId}`);
  
  // Obtener vacaciones del usuario
  const userWithVacations = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: {
        where: { endDate: { gte: new Date() } }
      }
    }
  });

  const upcomingVacations: UserVacation[] = userWithVacations?.vacations?.map(v => ({
    id: v.id,
    userId: v.userId,
    startDate: new Date(v.startDate),
    endDate: new Date(v.endDate)
  })) || [];

  console.log(`🏖️ Vacaciones próximas: ${upcomingVacations.length}`);
  upcomingVacations.forEach(vacation => {
    const days = Math.ceil((vacation.endDate.getTime() - vacation.startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   📅 ${vacation.startDate.toISOString().split('T')[0]} → ${vacation.endDate.toISOString().split('T')[0]} (${days} días)`);
  });

  // Si no hay vacaciones, devolver resultado original
  if (upcomingVacations.length === 0) {
    console.log(`✅ Sin vacaciones, usando fechas originales`);
    return insertionResult;
  }

  // Verificar si hay conflictos con vacaciones
  const originalStartDate = insertionResult.startDate;
  const originalDeadline = insertionResult.deadline;
  
  let hasConflict = false;
  const conflictingVacations: string[] = [];

  for (const vacation of upcomingVacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);

    if (originalStartDate <= vacEnd && originalDeadline >= vacStart) {
      hasConflict = true;
      conflictingVacations.push(
        `${vacStart.toISOString().split('T')[0]} → ${vacEnd.toISOString().split('T')[0]}`
      );
    }
  }

  // Si no hay conflictos, devolver resultado original
  if (!hasConflict) {
    console.log(`✅ Sin conflictos de vacaciones, usando fechas originales`);
    return insertionResult;
  }

  // Ajustar fechas por conflictos de vacaciones
  console.log(`🏖️ === AJUSTANDO POR CONFLICTOS DE VACACIONES ===`);
  console.log(`📅 Fecha original: ${originalStartDate.toISOString()}`);
  console.log(`🏖️ Conflictos con: ${conflictingVacations.join(', ')}`);

  const adjustedStartDate = await getNextAvailableStartAfterVacations(
    originalStartDate,
    upcomingVacations,
    taskDurationDays
  );

  const taskHours = taskDurationDays * 8;
  const adjustedDeadline = await calculateWorkingDeadline(adjustedStartDate, taskHours);

  console.log(`📅 Fecha ajustada: ${adjustedStartDate.toISOString()}`);
  console.log(`📅 Deadline ajustado: ${adjustedDeadline.toISOString()}`);

  return {
    ...insertionResult,
    startDate: adjustedStartDate,
    deadline: adjustedDeadline,
    insertionReason: `${insertionResult.insertionReason} (ajustado por vacaciones)`,
    vacationAdjustment: {
      originalDate: originalStartDate,
      adjustedDate: adjustedStartDate,
      conflictingVacations
    }
  };
}

/**
 * 🔴 URGENT: Inserción en paralelo con todas las tareas ACTUALES/FUTURAS
 */
async function handleUrgentParallel(
  currentAndFutureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔴 URGENT: Inserción en paralelo (no empuja tareas) - SOLO TAREAS ACTUALES/FUTURAS');
  
  // Siempre empieza lo más pronto posible
  const newStartDate = await getNextAvailableStart(new Date());
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  // ✅ INFORMACIÓN ADICIONAL: Mostrar con qué tarea va en paralelo
  let parallelWith: { taskId: string; taskName: string; originalStartDate: Date } | undefined;
  
  if (currentAndFutureTasks.length > 0) {
    // Buscar la primera tarea actual/futura (la que debería ser la #1 en cola)
    const firstCurrentTask = currentAndFutureTasks[0];
    parallelWith = {
      taskId: firstCurrentTask.id,
      taskName: firstCurrentTask.name,
      originalStartDate: firstCurrentTask.startDate
    };
    console.log(`   🔗 Va en paralelo con primera tarea actual/futura: "${firstCurrentTask.name}"`);
  } else {
    console.log(`   ℹ️ No hay tareas actuales/futuras, será la primera tarea`);
  }
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason: 'URGENT: Paralelo inmediato con primera tarea actual/futura, no afecta tareas existentes',
    parallelWith,
    noTasksAffected: true
  };
}

/**
 * 🟡 HIGH: Inserción en paralelo con segunda tarea actual/futura (evitando NORMAL con URGENT)
 */
async function handleHighParallel(
  currentAndFutureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟡 HIGH: Inserción en paralelo con segunda tarea actual/futura');
  
  if (currentAndFutureTasks.length === 0) {
    console.log('   ℹ️ No hay tareas actuales/futuras, comportándose como URGENT');
    return handleUrgentParallel([], durationDays);
  }
  
  // ✅ FILTRAR SOLO TAREAS ACTUALES/FUTURAS POR PRIORIDAD
  const currentFutureNormalTasks = currentAndFutureTasks.filter(task => task.priority === 'NORMAL');
  const currentFutureHighTasks = currentAndFutureTasks.filter(task => task.priority === 'HIGH');
  const currentFutureUrgentTasks = currentAndFutureTasks.filter(task => task.priority === 'URGENT');
  
  console.log(`   📊 Tareas actuales/futuras por prioridad:`);
  console.log(`     - NORMAL actuales/futuras: ${currentFutureNormalTasks.length}`);
  console.log(`     - HIGH actuales/futuras: ${currentFutureHighTasks.length}`);
  console.log(`     - URGENT actuales/futuras: ${currentFutureUrgentTasks.length}`);
  
  // ✅ LÓGICA CORREGIDA: Identificar qué NORMAL actuales/futuras ya tienen URGENT en paralelo
  const normalWithUrgent = new Set<string>();
  
  // Buscar URGENT que están en paralelo con NORMAL (solo actuales/futuras)
  currentFutureUrgentTasks.forEach(urgentTask => {
    currentFutureNormalTasks.forEach(normalTask => {
      // Verificar si tienen fechas de inicio muy similares (en paralelo)
      const timeDifference = Math.abs(
        urgentTask.startDate.getTime() - normalTask.startDate.getTime()
      );
      const isParallel = timeDifference < 24 * 60 * 60 * 1000; // Menos de 1 día de diferencia
      
      if (isParallel) {
        normalWithUrgent.add(normalTask.id);
        console.log(`   🔴 NORMAL actual/futura "${normalTask.name}" ya tiene URGENT "${urgentTask.name}" en paralelo`);
      }
    });
  });
  
  // ✅ BUSCAR SEGUNDA NORMAL LIBRE (sin URGENT en paralelo) ENTRE LAS ACTUALES/FUTURAS
  let targetNormalIndex = -1;
  let targetNormal: TaskForParallelInsertion | null = null;
  let normalLibresCount = 0;
  
  for (let i = 0; i < currentFutureNormalTasks.length; i++) {
    const normalTask = currentFutureNormalTasks[i];
    
    if (!normalWithUrgent.has(normalTask.id)) {
      // Esta NORMAL está libre, verificar si no tiene HIGH ya
      const hasHighAlready = currentFutureHighTasks.some(highTask => {
        const timeDifference = Math.abs(
          highTask.startDate.getTime() - normalTask.startDate.getTime()
        );
        return timeDifference < 24 * 60 * 60 * 1000; // En paralelo
      });
      
      if (!hasHighAlready) {
        normalLibresCount++;
        
        // ✅ BUSCAR LA SEGUNDA NORMAL LIBRE (no la primera)
        if (normalLibresCount === 2) {
          targetNormalIndex = i;
          targetNormal = normalTask;
          console.log(`   ✅ Segunda NORMAL actual/futura libre encontrada: "${normalTask.name}" (posición global ${i})`);
          break;
        } else {
          console.log(`   ⚠️ Primera NORMAL actual/futura libre: "${normalTask.name}" - saltando para buscar la segunda`);
        }
      } else {
        console.log(`   ⚠️ NORMAL actual/futura "${normalTask.name}" libre de URGENT pero ya tiene HIGH`);
      }
    }
  }
  
  let newStartDate: Date;
  let insertionReason = '';
  let parallelWithTask: TaskForParallelInsertion | null = null;
  
  if (targetNormal) {
    // Encontramos la segunda NORMAL libre entre las actuales/futuras
    parallelWithTask = targetNormal;
    insertionReason = `HIGH: Paralelo con "${targetNormal.name}" (segunda NORMAL actual/futura libre, posición ${targetNormalIndex})`;
    
    // ✅ Usar la MISMA fecha de inicio para verdadero paralelismo
    newStartDate = new Date(targetNormal.startDate);
    console.log(`   🔗 Verdadero paralelo: usando exactamente la misma fecha de inicio que "${targetNormal.name}"`);
    
  } else {
    // No hay segunda NORMAL libre entre las actuales/futuras, usar la primera disponible o ir al final
    if (normalLibresCount === 1) {
      // Solo hay una NORMAL libre, usar esa
      const firstFreeNormal = currentFutureNormalTasks.find(task => 
        !normalWithUrgent.has(task.id) && 
        !currentFutureHighTasks.some(highTask => {
          const timeDifference = Math.abs(
            highTask.startDate.getTime() - task.startDate.getTime()
          );
          return timeDifference < 24 * 60 * 60 * 1000;
        })
      );
      
      if (firstFreeNormal) {
        parallelWithTask = firstFreeNormal;
        insertionReason = `HIGH: Paralelo con "${firstFreeNormal.name}" (única NORMAL actual/futura libre)`;
        newStartDate = new Date(firstFreeNormal.startDate);
        console.log(`   🔗 Solo una NORMAL libre, usando: "${firstFreeNormal.name}"`);
      } else {
        // Ir al final
        const lastCurrentFutureTask = currentAndFutureTasks[currentAndFutureTasks.length - 1];
        parallelWithTask = lastCurrentFutureTask;
        insertionReason = `HIGH: Después de última tarea actual/futura "${lastCurrentFutureTask.name}"`;
        newStartDate = await getNextAvailableStart(lastCurrentFutureTask.deadline);
        console.log(`   📅 No hay NORMAL libres, yendo al final de tareas actuales/futuras`);
      }
    } else {
      // No hay NORMAL libres o ir después de la última tarea actual/futura
      if (currentAndFutureTasks.length > 0) {
        const lastCurrentFutureTask = currentAndFutureTasks[currentAndFutureTasks.length - 1];
        parallelWithTask = lastCurrentFutureTask;
        insertionReason = `HIGH: Después de última tarea actual/futura "${lastCurrentFutureTask.name}" (todas las NORMAL ocupadas)`;
        newStartDate = await getNextAvailableStart(lastCurrentFutureTask.deadline);
        console.log(`   📅 Todas las NORMAL actuales/futuras ocupadas, yendo al final`);
      } else {
        // No debería llegar aquí, pero por seguridad
        newStartDate = await getNextAvailableStart(new Date());
        insertionReason = `HIGH: Primera tarea (sin tareas actuales/futuras)`;
      }
    }
  }
  
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    parallelWith: parallelWithTask ? {
      taskId: parallelWithTask.id,
      taskName: parallelWithTask.name,
      originalStartDate: parallelWithTask.startDate
    } : undefined,
    noTasksAffected: true
  };
}

/**
 * 🔵 NORMAL: Mantiene comportamiento actual pero solo considera tareas actuales/futuras para LOW del mismo día
 */
async function handleNormalParallel(
  allUserTasks: TaskForParallelInsertion[], 
  currentAndFutureTasks: TaskForParallelInsertion[],
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔵 NORMAL: Comportamiento actual + mover LOW del mismo día (solo tareas actuales/futuras)');
  
  if (allUserTasks.length === 0) {
    const newStartDate = await getNextAvailableStart(new Date());
    const taskHours = durationDays * 8;
    const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
    
    return {
      startDate: newStartDate,
      deadline: newDeadline,
      insertionReason: 'NORMAL: Primera tarea del usuario',
      noTasksAffected: true
    };
  }
  
  // ✅ NUEVA LÓGICA: Identificar tareas LOW creadas HOY que deben ser movidas (solo entre actuales/futuras)
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  const currentFutureLowTasksToday = currentAndFutureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt >= todayStart && taskCreatedAt < todayEnd;
  });
  
  console.log(`   📊 Tareas LOW actuales/futuras de hoy que pueden ser movidas: ${currentFutureLowTasksToday.length}`);
  
  // ✅ CALCULAR POSICIÓN SIN LAS LOW DEL DÍA (temporalmente las excluimos, solo actuales/futuras)
  const currentFutureTasksWithoutTodaysLow = currentAndFutureTasks.filter(task => {
    if (task.priority !== 'LOW') return true;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt < todayStart; // Solo LOW de días anteriores
  });
  
  console.log(`   📊 Tareas actuales/futuras sin LOW de hoy: ${currentFutureTasksWithoutTodaysLow.length}`);
  
  // ✅ LÓGICA DE INTERCALADO EXISTENTE (sin las LOW de hoy, solo actuales/futuras)
  let insertAfterIndex = -1;
  let insertionReason = '';
  
  for (let i = currentFutureTasksWithoutTodaysLow.length - 1; i >= 0; i--) {
    const task = currentFutureTasksWithoutTodaysLow[i];
    
    if (task.priority === 'LOW') {
      const normalsBefore = currentFutureTasksWithoutTodaysLow.slice(0, i)
        .filter(t => t.priority === 'NORMAL').length;
      
      if (normalsBefore < 5) {
        insertAfterIndex = i - 1;
        insertionReason = `NORMAL: Intercalado antes de LOW actual/futura "${task.name}" (${normalsBefore}/5)`;
        break;
      }
    }
  }
  
  if (insertAfterIndex === -1) {
    insertAfterIndex = currentFutureTasksWithoutTodaysLow.length - 1;
    insertionReason = 'NORMAL: Al final de las tareas actuales/futuras (sin LOW de hoy)';
  }
  
  // ✅ CALCULAR FECHA DE LA NUEVA TAREA NORMAL
  const insertAfterDate = insertAfterIndex >= 0 ? 
    currentFutureTasksWithoutTodaysLow[insertAfterIndex].deadline : new Date();
  
  const newStartDate = await getNextAvailableStart(insertAfterDate);
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  // ✅ PREPARAR MOVIMIENTO DE TAREAS LOW DEL MISMO DÍA (solo actuales/futuras)
  const tasksToMove: { taskId: string; newStartDate: Date; newDeadline: Date }[] = [];
  
  if (currentFutureLowTasksToday.length > 0) {
    console.log(`   🔄 Preparando movimiento de ${currentFutureLowTasksToday.length} tareas LOW actuales/futuras al final`);
    
    let currentDate = newDeadline; // Empezar después de la nueva NORMAL
    
    for (const lowTask of currentFutureLowTasksToday) {
      const lowDuration = lowTask.customDuration ?? lowTask.tier.duration;
      const lowHours = lowDuration * 8;
      
      const lowStartDate = await getNextAvailableStart(currentDate);
      const lowDeadline = await calculateWorkingDeadline(lowStartDate, lowHours);
      
      tasksToMove.push({
        taskId: lowTask.id,
        newStartDate: lowStartDate,
        newDeadline: lowDeadline
      });
      
      console.log(`     📋 LOW actual/futura "${lowTask.name}" será movida a: ${lowStartDate.toISOString()} → ${lowDeadline.toISOString()}`);
      
      currentDate = lowDeadline;
    }
    
    insertionReason += ` (${currentFutureLowTasksToday.length} LOW actuales/futuras del día movidas al final)`;
  }
  
  console.log(`   📅 Fecha calculada para NORMAL: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ Tareas LOW actuales/futuras del día serán reposicionadas: ${tasksToMove.length}`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    noTasksAffected: tasksToMove.length === 0,
    tasksToMove: tasksToMove.length > 0 ? tasksToMove : undefined
  };
}

/**
 * 🟢 LOW: SIEMPRE va al final del día (muy simple)
 */
async function handleLowParallel(
  currentAndFutureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟢 LOW: SIEMPRE va al final del día (será movida por NORMAL si es necesario) - SOLO TAREAS ACTUALES/FUTURAS');
  
  const now = new Date();
  const currentHour = now.getHours();
  const isEndOfDay = currentHour >= 17; // 5:00 PM
  
  if (isEndOfDay) {
    console.log('   🕐 Fin del día: LOW se comporta como NORMAL (fecha fija)');
    // Después de las 5 PM, se comporta como NORMAL
    const result = await handleNormalParallel(currentAndFutureTasks, currentAndFutureTasks, durationDays);
    result.insertionReason = `LOW (post-5PM): ${result.insertionReason}`;
    return result;
  }
  
  console.log('   🕐 Durante el día: LOW va al final de tareas actuales/futuras (puede ser movida por NORMAL actuales/futuras)');
  
  // ✅ SIMPLIFICADO: LOW siempre al final de las tareas actuales/futuras
  let newStartDate: Date;
  let insertionReason: string;
  
  if (currentAndFutureTasks.length > 0) {
    const lastCurrentFutureTask = currentAndFutureTasks[currentAndFutureTasks.length - 1];
    newStartDate = await getNextAvailableStart(lastCurrentFutureTask.deadline);
    insertionReason = `LOW: Al final después de última tarea actual/futura "${lastCurrentFutureTask.name}" (puede ser movida por NORMAL del mismo día)`;
  } else {
    newStartDate = await getNextAvailableStart(new Date());
    insertionReason = 'LOW: Primera tarea actual/futura (puede ser movida por NORMAL del mismo día)';
  }
  
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ⚠️ Puede ser movida si llegan NORMAL el mismo día hasta 5PM`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    noTasksAffected: true
  };
}

/**
 * 🎯 FUNCIÓN PRINCIPAL: Calcular inserción en paralelo CON VACACIONES + SOLO TAREAS FUTURAS
 */
export async function calculateParallelPriorityInsertion(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log(`\n🎯 === CÁLCULO DE INSERCIÓN EN PARALELO + VACACIONES + SOLO TAREAS ACTUALES/FUTURAS ===`);
  console.log(`👤 Usuario: ${userId}`);
  console.log(`🔥 Prioridad: ${priority}`);
  console.log(`⏱️ Duración: ${durationDays} días`);
  console.log(`✅ NO se afectarán tareas existentes (excepto LOW del mismo día para NORMAL)`);
  console.log(`🏖️ SE considerarán vacaciones del usuario`);
  console.log(`📅 NUEVA LÓGICA: Solo considera tareas con deadline >= fecha actual`);
  console.log(`🔒 Tareas ya terminadas (deadline pasado) se ignoran completamente`);
  
  // ✅ OBTENER TODAS LAS TAREAS CON FECHA DE CREACIÓN
  const allUserTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      deadline: true,
      priority: true,
      customDuration: true,
      createdAt: true,
      tier: {
        select: {
          duration: true
        }
      }
    }
  }) as unknown as (TaskForParallelInsertion & { createdAt: Date })[];
  
  // ✅ FILTRAR TAREAS ACTUALES/FUTURAS (basado en deadline, no startDate)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const currentAndFutureTasks = allUserTasks.filter(task => {
    const taskDeadline = new Date(task.deadline);
    return taskDeadline >= todayStart; // Incluye tareas en progreso y futuras
  });
  
  console.log(`📊 Análisis de tareas (filtro por deadline):`);
  console.log(`   📋 Tareas totales del usuario: ${allUserTasks.length}`);
  console.log(`   🔮 Tareas actuales/futuras (deadline >= hoy): ${currentAndFutureTasks.length}`);
  console.log(`   🕒 Tareas ya terminadas (deadline < hoy): ${allUserTasks.length - currentAndFutureTasks.length}`);
  
  if (allUserTasks.length - currentAndFutureTasks.length > 0) {
    console.log(`   ⚠️ Se ignoraron ${allUserTasks.length - currentAndFutureTasks.length} tareas terminadas para cálculo de paralelos`);
  }
  
  // Mostrar ejemplos de tareas incluidas
  if (currentAndFutureTasks.length > 0) {
    console.log(`   📝 Ejemplos de tareas consideradas:`);
    currentAndFutureTasks.slice(0, 3).forEach(task => {
      const startDate = new Date(task.startDate).toISOString().split('T')[0];
      const deadline = new Date(task.deadline).toISOString().split('T')[0];
      const isInProgress = new Date(task.startDate) <= now && new Date(task.deadline) >= now;
      const status = isInProgress ? 'EN PROGRESO' : 'FUTURA';
      console.log(`     - "${task.name}": ${startDate} → ${deadline} (${status})`);
    });
  }
  
  // ✅ MOSTRAR ANÁLISIS DE TAREAS LOW POR FECHA (solo actuales/futuras)
  const today = new Date();
  const todayStartForLow = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStartForLow.getTime() + 24 * 60 * 60 * 1000);
  
  const currentFutureLowTasksToday = currentAndFutureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt >= todayStartForLow && taskCreatedAt < todayEnd;
  });
  
  const currentFutureLowTasksPrevious = currentAndFutureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt < todayStartForLow;
  });
  
  console.log(`📋 Análisis de tareas LOW actuales/futuras:`);
  console.log(`   🟢 LOW actuales/futuras de hoy (intercalables): ${currentFutureLowTasksToday.length}`);
  console.log(`   🔒 LOW actuales/futuras de días anteriores (fijas): ${currentFutureLowTasksPrevious.length}`);
  
  if (currentFutureLowTasksToday.length > 0) {
    console.log(`   📅 LOW actuales/futuras del día actual:`);
    currentFutureLowTasksToday.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  if (currentFutureLowTasksPrevious.length > 0) {
    console.log(`   🔒 LOW actuales/futuras de días anteriores (NO intercalables):`);
    currentFutureLowTasksPrevious.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  // Calcular inserción según prioridad (SIN vacaciones primero, solo con tareas actuales/futuras)
  let result: ParallelInsertionResult;
  
  switch (priority) {
    case 'URGENT':
      result = await handleUrgentParallel(currentAndFutureTasks, durationDays);
      break;
    case 'HIGH':
      result = await handleHighParallel(currentAndFutureTasks, durationDays);
      break;
    case 'NORMAL':
      result = await handleNormalParallel(allUserTasks, currentAndFutureTasks, durationDays); // ✅ CORREGIDO: currentAndFutureTasks en lugar de futureTasks
      break;
    case 'LOW':
      result = await handleLowParallel(currentAndFutureTasks, durationDays);
      break;
    default:
      throw new Error(`Prioridad desconocida: ${priority}`);
  }
  
  console.log(`\n📅 === FECHAS ANTES DE VACACIONES (SOLO TAREAS ACTUALES/FUTURAS) ===`);
  console.log(`📅 Inicio: ${result.startDate.toISOString()}`);
  console.log(`📅 Fin: ${result.deadline.toISOString()}`);
  console.log(`💭 Razón: ${result.insertionReason}`);
  
  // ✅ MOSTRAR TAREAS QUE SERÁN MOVIDAS
  if (result.tasksToMove && result.tasksToMove.length > 0) {
    console.log(`\n🔄 === TAREAS LOW ACTUALES/FUTURAS QUE SERÁN MOVIDAS ===`);
    result.tasksToMove.forEach(task => {
      console.log(`   📋 ${task.taskId}: ${task.newStartDate.toISOString()} → ${task.newDeadline.toISOString()}`);
    });
  }
  
  // ✅ APLICAR LÓGICA DE VACACIONES
  const finalResult = await applyVacationLogic(userId, result, durationDays);
  
  console.log(`\n✅ === RESULTADO FINAL CON VACACIONES (SOLO TAREAS ACTUALES/FUTURAS) ===`);
  console.log(`📅 Inicio: ${finalResult.startDate.toISOString()}`);
  console.log(`📅 Fin: ${finalResult.deadline.toISOString()}`);
  console.log(`💭 Razón: ${finalResult.insertionReason}`);
  console.log(`✅ Tareas afectadas: ${finalResult.tasksToMove?.length || 0} LOW actuales/futuras del mismo día`);
  console.log(`🏖️ Vacaciones consideradas: SÍ`);
  console.log(`🔮 Solo tareas actuales/futuras consideradas: SÍ (deadline >= hoy)`);
  
  if (finalResult.vacationAdjustment) {
    console.log(`\n🏖️ === AJUSTES POR VACACIONES ===`);
    console.log(`📅 Fecha original: ${finalResult.vacationAdjustment.originalDate.toISOString()}`);
    console.log(`📅 Fecha ajustada: ${finalResult.vacationAdjustment.adjustedDate.toISOString()}`);
    console.log(`🏖️ Conflictos: ${finalResult.vacationAdjustment.conflictingVacations.join(', ')}`);
  }
  
  if (finalResult.parallelWith) {
    console.log(`🔗 Paralelo con tarea actual/futura: "${finalResult.parallelWith.taskName}"`);
    console.log(`📅 Fecha original de referencia: ${finalResult.parallelWith.originalStartDate.toISOString()}`);
  }
  
  return finalResult;
}

/**
 * 🎯 FUNCIÓN AUXILIAR: Obtener información de paralelismo (solo tareas actuales/futuras)
 */
export async function getParallelismInfo(
  userId: string,
  priority: Priority
): Promise<{
  currentUrgentCount: number;
  currentHighCount: number;
  currentNormalCount: number;
  currentLowCount: number;
  nextInsertionWillBeParallel: boolean;
  estimatedParallelWith?: string;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // ✅ SOLO CONSIDERAR TAREAS ACTUALES/FUTURAS (filtro por deadline)
  const currentAndFutureTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] },
      deadline: { gte: todayStart } // ✅ SOLO TAREAS CON DEADLINE >= HOY
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      priority: true,
      startDate: true
    }
  });
  
  const priorityCounts = {
    currentUrgentCount: currentAndFutureTasks.filter(t => t.priority === 'URGENT').length,
    currentHighCount: currentAndFutureTasks.filter(t => t.priority === 'HIGH').length,
    currentNormalCount: currentAndFutureTasks.filter(t => t.priority === 'NORMAL').length,
    currentLowCount: currentAndFutureTasks.filter(t => t.priority === 'LOW').length,
    nextInsertionWillBeParallel: ['URGENT', 'HIGH'].includes(priority),
    estimatedParallelWith: undefined as string | undefined
  };
  
  // Calcular con qué tarea actual/futura será paralelo
  if (priority === 'URGENT') {
    const firstCurrentFutureTask = currentAndFutureTasks[0];
    priorityCounts.estimatedParallelWith = firstCurrentFutureTask ? 
      `Primera tarea actual/futura: ${firstCurrentFutureTask.name}` : 
      'Será la primera tarea';
  } else if (priority === 'HIGH') {
    const currentFutureNormalTasks = currentAndFutureTasks.filter(t => t.priority === 'NORMAL');
    const currentFutureHighTasks = currentAndFutureTasks.filter(t => t.priority === 'HIGH');
    
    if (currentFutureNormalTasks.length >= 2) {
      priorityCounts.estimatedParallelWith = `Segunda NORMAL actual/futura: ${currentFutureNormalTasks[1].name}`;
    } else if (currentFutureNormalTasks.length === 1) {
      priorityCounts.estimatedParallelWith = `Única NORMAL actual/futura: ${currentFutureNormalTasks[0].name}`;
    } else {
      priorityCounts.estimatedParallelWith = 'Después de última tarea actual/futura';
    }
  }
  
  return priorityCounts;
}
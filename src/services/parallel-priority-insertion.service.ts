/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/parallel-priority-insertion.service.ts
// MODELO DE CARRILES POR PRIORIDAD:
//   Una tarea nueva se ENCOLA después de la última tarea de prioridad IGUAL o
//   MAYOR del diseñador, y corre EN PARALELO con las de menor prioridad (no las
//   empuja). Luego se ajusta la fecha si choca con vacaciones del usuario.
//
//   URGENT  → en cola tras la última URGENT (en paralelo con HIGH/NORMAL/LOW).
//   HIGH    → en cola tras la última URGENT/HIGH (en paralelo con NORMAL/LOW).
//   NORMAL  → en cola tras la última URGENT/HIGH/NORMAL (en paralelo con LOW).
//   LOW     → al final (en cola tras todas).
import { db } from '@/db';
import { user as userTable, userVacation } from '@/db/schema';
import { eq, gte } from 'drizzle-orm';
import { Priority } from '@/db/enums';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';
import { UserVacation } from '@/interfaces';
import { getActiveClickUpTasksByUser } from '@/services/clickup-tasks.service';
import { mapClickUpPriority } from '@/utils/clickup-status-mapping-utils';

// Rango de prioridad: mayor número = más prioritaria.
const PRIORITY_RANK: Record<Priority, number> = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 };

export interface ParallelInsertionResult {
  startDate: Date;
  deadline: Date;
  insertionReason: string;
  parallelWith?: { taskId: string; taskName: string; originalStartDate: Date };
  noTasksAffected: boolean;
  vacationAdjustment?: {
    originalDate: Date;
    adjustedDate: Date;
    conflictingVacations: string[];
  };
  // Se mantiene por compatibilidad con el endpoint; este modelo NO mueve tareas.
  tasksToMove?: { taskId: string; newStartDate: Date; newDeadline: Date }[];
}

interface TaskRow {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
  priority: Priority;
}

/**
 * Avanza la fecha de inicio para SALTAR vacaciones del usuario. Si la tarea,
 * empezando en `baseDate`, choca con una vacación, se mueve el inicio a después
 * de esa vacación (y se reintenta por si hay varias).
 */
async function getNextAvailableStartAfterVacations(
  baseDate: Date,
  vacations: UserVacation[],
  taskDurationDays: number = 0
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);

  const sortedVacations = [...vacations].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let adjusted = true;
  let iterations = 0;
  while (adjusted && iterations < 10) {
    adjusted = false;
    iterations++;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd =
      taskDurationDays > 0 ? await calculateWorkingDeadline(availableDate, taskHours) : availableDate;

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);
      if (availableDate <= vacEnd && potentialTaskEnd >= vacStart) {
        const dayAfter = new Date(vacEnd);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        availableDate = await getNextAvailableStart(dayAfter);
        adjusted = true;
        break;
      }
    }
  }

  return availableDate;
}

/** Ajusta el resultado de inserción si choca con vacaciones del usuario. */
async function applyVacationLogic(
  userId: string,
  result: ParallelInsertionResult,
  taskDurationDays: number
): Promise<ParallelInsertionResult> {
  const userWithVacations = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    with: { vacations: { where: gte(userVacation.endDate, new Date()) } },
  });

  const upcomingVacations: UserVacation[] = (userWithVacations?.vacations ?? []).map((v) => ({
    id: v.id,
    userId: v.userId,
    startDate: new Date(v.startDate),
    endDate: new Date(v.endDate),
  }));

  if (upcomingVacations.length === 0) return result;

  const conflicting: string[] = [];
  for (const vacation of upcomingVacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);
    if (result.startDate <= vacEnd && result.deadline >= vacStart) {
      conflicting.push(`${vacStart.toISOString().split('T')[0]} → ${vacEnd.toISOString().split('T')[0]}`);
    }
  }

  if (conflicting.length === 0) return result;

  const adjustedStartDate = await getNextAvailableStartAfterVacations(
    result.startDate,
    upcomingVacations,
    taskDurationDays
  );
  const adjustedDeadline = await calculateWorkingDeadline(adjustedStartDate, taskDurationDays * 8);

  return {
    ...result,
    startDate: adjustedStartDate,
    deadline: adjustedDeadline,
    insertionReason: `${result.insertionReason} (ajustado por vacaciones)`,
    vacationAdjustment: {
      originalDate: result.startDate,
      adjustedDate: adjustedStartDate,
      conflictingVacations: conflicting,
    },
  };
}

/**
 * Calcula las fechas de una tarea nueva según su prioridad (modelo de carriles)
 * y las vacaciones del usuario. NO modifica las tareas existentes.
 */
export async function calculateParallelPriorityInsertion(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<ParallelInsertionResult> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Tareas activas del usuario leídas EN VIVO de ClickUp (no de la DB).
  // fetchActiveClickUpTasks ya excluye completadas; conservamos solo las que aún
  // cuentan (deadline >= hoy) para el cálculo de carriles por prioridad.
  const clickUpTasks = await getActiveClickUpTasksByUser(userId);
  const tasks: TaskRow[] = clickUpTasks
    .map((t) => ({
      id: t.clickupId,
      name: t.name,
      startDate: new Date(t.startDate),
      deadline: new Date(t.dueDate),
      priority: mapClickUpPriority(t.priority),
    }))
    .filter((t) => t.deadline >= todayStart);

  const rank = PRIORITY_RANK[priority];
  // El "carril": tareas de prioridad IGUAL o MAYOR — la nueva se encola tras ellas.
  const queueAhead = tasks.filter((t) => PRIORITY_RANK[t.priority] >= rank);

  let startDate: Date;
  let insertionReason: string;
  let parallelWith: ParallelInsertionResult['parallelWith'];

  if (queueAhead.length > 0) {
    // Tras la de deadline más lejano dentro del carril (la "última" en la cola).
    const last = queueAhead.reduce((a, b) =>
      new Date(a.deadline).getTime() >= new Date(b.deadline).getTime() ? a : b
    );
    startDate = await getNextAvailableStart(new Date(last.deadline));
    insertionReason = `${priority}: en cola tras "${last.name}" (última de prioridad ≥ ${priority})`;
    parallelWith = {
      taskId: last.id,
      taskName: last.name,
      originalStartDate: new Date(last.startDate),
    };
  } else {
    // No hay nada de prioridad igual o mayor: empieza lo antes posible (en paralelo
    // con las de menor prioridad, sin empujarlas).
    startDate = await getNextAvailableStart(now);
    insertionReason = `${priority}: empieza de inmediato (sin tareas de prioridad ≥ ${priority})`;
  }

  const deadline = await calculateWorkingDeadline(startDate, durationDays * 8);

  const result: ParallelInsertionResult = {
    startDate,
    deadline,
    insertionReason,
    parallelWith,
    noTasksAffected: true,
  };

  return applyVacationLogic(userId, result, durationDays);
}

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
import { user as userTable, userVacation, taskMeta } from '@/db/schema';
import { eq, gte, inArray } from 'drizzle-orm';
import { Priority } from '@/db/enums';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';
import { UserVacation } from '@/interfaces';
import { getActiveClickUpTasksByUser, type ClickUpFetchOptions } from '@/services/clickup-tasks.service';
import { mapClickUpPriority } from '@/utils/clickup-status-mapping-utils';
import { getAppSettings } from '@/services/app-settings.service';
import { rescheduleClickUpTaskDates } from '@/services/clickup.service';
import { isMovableLow, computeLowCascade, type MovableLow, type CascadeMove } from '@/services/low-cascade';

// Rango de prioridad: mayor número = más prioritaria.
const PRIORITY_RANK: Record<Priority, number> = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 };

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
  taskDurationDays: number = 0,
  workspaceId?: string | null
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate, workspaceId);

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
      taskDurationDays > 0 ? await calculateWorkingDeadline(availableDate, taskHours, workspaceId) : availableDate;

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);
      if (availableDate <= vacEnd && potentialTaskEnd >= vacStart) {
        const dayAfter = new Date(vacEnd);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        availableDate = await getNextAvailableStart(dayAfter, workspaceId);
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
  taskDurationDays: number,
  workspaceId?: string | null
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
    taskDurationDays,
    workspaceId
  );
  const adjustedDeadline = await calculateWorkingDeadline(adjustedStartDate, taskDurationDays * 8, workspaceId);

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
  durationDays: number,
  clickupOpts: ClickUpFetchOptions = {}
): Promise<ParallelInsertionResult> {
  // El workspace activo llega vía clickupOpts.teamId → settings del motor por inquilino.
  const workspaceId = clickupOpts.teamId ?? null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Tareas activas del usuario leídas EN VIVO de ClickUp (no de la DB).
  // fetchActiveClickUpTasks ya excluye completadas; conservamos solo las que aún
  // cuentan (deadline >= hoy) para el cálculo de carriles por prioridad.
  const clickUpTasks = await getActiveClickUpTasksByUser(userId, clickupOpts);
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
    startDate = await getNextAvailableStart(new Date(last.deadline), workspaceId);
    insertionReason = `${priority}: en cola tras "${last.name}" (última de prioridad ≥ ${priority})`;
    parallelWith = {
      taskId: last.id,
      taskName: last.name,
      originalStartDate: new Date(last.startDate),
    };
  } else {
    // No hay nada de prioridad igual o mayor: empieza lo antes posible (en paralelo
    // con las de menor prioridad, sin empujarlas).
    startDate = await getNextAvailableStart(now, workspaceId);
    insertionReason = `${priority}: empieza de inmediato (sin tareas de prioridad ≥ ${priority})`;
  }

  const deadline = await calculateWorkingDeadline(startDate, durationDays * 8, workspaceId);

  const result: ParallelInsertionResult = {
    startDate,
    deadline,
    insertionReason,
    parallelWith,
    noTasksAffected: true,
  };

  return applyVacationLogic(userId, result, durationDays, workspaceId);
}

/**
 * Resuelve el primer hueco laboral válido para `ownerUserId` desde `fromDate`, saltando
 * horario/festivos y las VACACIONES del dueño. Reusa la misma lógica que la inserción
 * normal (`getNextAvailableStartAfterVacations` + `calculateWorkingDeadline`).
 */
async function resolveOwnerSlot(
  ownerUserId: string,
  fromDate: Date,
  durationDays: number,
  workspaceId?: string | null
): Promise<{ start: Date; due: Date }> {
  const userWithVacations = await db.query.user.findFirst({
    where: eq(userTable.id, ownerUserId),
    with: { vacations: { where: gte(userVacation.endDate, new Date()) } },
  });
  const vacations: UserVacation[] = (userWithVacations?.vacations ?? []).map((v) => ({
    id: v.id,
    userId: v.userId,
    startDate: new Date(v.startDate),
    endDate: new Date(v.endDate),
  }));
  const start = await getNextAvailableStartAfterVacations(fromDate, vacations, durationDays, workspaceId);
  const due = await calculateWorkingDeadline(start, durationDays * 8, workspaceId);
  return { start, due };
}

/**
 * EMPUJE EN CASCADA DE LOW. Cuando se crea una tarea de prioridad MAYOR que LOW, las Low
 * "movibles" de `userId` (TO_DO, creadas hoy, antes de la última hora del día laboral)
 * se recolocan DESPUÉS de la tarea nueva, en cascada, reprogramando sus fechas EN ClickUp
 * (`rescheduleClickUpTaskDates`). Devuelve los movimientos aplicados (para el realtime).
 *
 * NO debe llamarse para tareas Low (el que invoca filtra `priority !== 'LOW'`). Best-effort:
 * al primer fallo de un PUT corta la cascada (no descuadra el orden) y devuelve lo aplicado.
 */
export async function cascadeLowTasksForUser(
  userId: string,
  newTaskDeadline: Date,
  clickupOpts: ClickUpFetchOptions = {}
): Promise<CascadeMove[]> {
  const workspaceId = clickupOpts.teamId ?? null;

  // 1. Low TO_DO del usuario (en vivo de ClickUp).
  const userTasks = await getActiveClickUpTasksByUser(userId, clickupOpts);
  const lowToDo = userTasks.filter(
    (t) => mapClickUpPriority(t.priority) === Priority.LOW && t.status === 'TO_DO'
  );
  if (lowToDo.length === 0) return [];

  // 2. Cruzar con task_meta (createdAt + duración real) por id de ClickUp.
  const ids = lowToDo.map((t) => t.clickupId);
  const metas = await db
    .select({
      clickupTaskId: taskMeta.clickupTaskId,
      createdAt: taskMeta.createdAt,
      durationDays: taskMeta.durationDays,
    })
    .from(taskMeta)
    .where(inArray(taskMeta.clickupTaskId, ids));
  const metaById = new Map(metas.map((m) => [m.clickupTaskId, m]));

  // 3. Settings del workspace (cierre del día + huso) para decidir la movilidad.
  const settings = await getAppSettings(workspaceId);
  const nowMs = Date.now();

  // 4. Quedarnos con las MOVIBLES (creadas hoy, antes de la última hora) y armarlas.
  const movables: MovableLow[] = [];
  for (const t of lowToDo) {
    const meta = metaById.get(t.clickupId);
    const createdAtMs = meta?.createdAt ? new Date(meta.createdAt).getTime() : null;
    if (
      !isMovableLow({
        status: t.status,
        createdAtMs,
        nowMs,
        workHoursEndUtc: settings.workHours.END,
        utcOffsetHours: settings.utcOffsetHours,
      })
    ) {
      continue;
    }
    const start = new Date(t.startDate);
    const due = new Date(t.dueDate);
    const durationDays =
      meta?.durationDays ?? t.durationDays ?? Math.max(1, Math.round((due.getTime() - start.getTime()) / MS_PER_DAY));
    movables.push({ taskId: t.clickupId, ownerUserId: userId, currentStart: start, currentDue: due, durationDays });
  }
  if (movables.length === 0) return [];

  // 5. Cascada (núcleo puro) con resolvedor que respeta huecos + vacaciones del owner.
  const moves = await computeLowCascade(movables, newTaskDeadline, (from, owner, dur) =>
    resolveOwnerSlot(owner, from, dur, workspaceId)
  );

  // 6. Aplicar en ClickUp SECUENCIAL; al primer fallo cortar (no descuadrar el orden).
  const applied: CascadeMove[] = [];
  for (const move of moves) {
    try {
      await rescheduleClickUpTaskDates(
        move.taskId,
        { startDate: move.newStart, dueDate: move.newDue },
        clickupOpts.token
      );
      applied.push(move);
    } catch (err) {
      console.error(
        `[low-cascade] No se pudo reprogramar ${move.taskId}; corto la cascada:`,
        err instanceof Error ? err.message : err
      );
      break;
    }
  }
  return applied;
}

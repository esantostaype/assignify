/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/task-assignment.service.ts - SIN queuePosition
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { db } from '@/db';
import { user as userTable, userRole, userVacation } from '@/db/schema';
import { eq, and, or, isNull, gte } from 'drizzle-orm';
import { Priority, Status, Level } from '@/db/enums';
import { UserSlot, UserWithRoles, Task, TaskTimingResult, UserVacation, VacationAwareUserSlot, RankedCandidate, DesignerStatus } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline, OCCUPYING_STATUSES } from '@/utils/task-calculation-utils';
import { CACHE_KEYS } from '@/config';
import { getAppSettings } from '@/services/app-settings.service';
import { getFromCache, setInCache } from '@/utils/cache';
import { fetchActiveClickUpTasks, type ActiveClickUpTask } from '@/services/clickup-tasks.service';
import { mapClickUpPriority } from '@/utils/clickup-status-mapping-utils';
import { pickBestAcrossAffinity, PRIORITY_RANK } from '@/services/assignment-ranking';
import usHolidays from '@/data/usHolidays.json'

// Duración a asumir para una tarea pendiente cuyo `durationDays` no conocemos
// (creada fuera de Assignify, sin fila en task_meta). 1 día = el viejo "1 por tarea".
const FALLBACK_TASK_DURATION_DAYS = 1;

// Carga pendiente (en "días"; 1 por tarea) a partir de la cual un diseñador se
// considera SATURADO para los badges del selector. No cambia a quién se elige
// (eso lo decide la fecha de liberación + congestión de prioridad).
const OVERLOAD_THRESHOLD_DAYS = 10;

// Estados de ClickUp que cuentan como trabajo pendiente (ocupan al diseñador).
// ON_APPROVAL ya está entregado: no cuenta ni para carga ni para disponibilidad.
const PENDING_CLICKUP_STATUSES: ActiveClickUpTask['status'][] = ['TO_DO', 'IN_PROGRESS'];

function getUSHolidays(startDate: Date, endDate: Date): Date[] {
  const holidays: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  usHolidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date + 'T00:00:00Z');
    if (holidayDate >= start && holidayDate <= end) {
      holidays.push(holidayDate);
    }
  });

  return holidays;
}

function calculateWorkingDaysBetween(startDate: Date, endDate: Date, excludeVacations: UserVacation[] = []): number {
  if (startDate >= endDate) return 0;

  let workingDays = 0;
  const current = new Date(startDate);
  const holidays = getUSHolidays(startDate, endDate);

  while (current < endDate) {
    const dayOfWeek = current.getUTCDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const isHoliday = holidays.some(holiday =>
        holiday.toISOString().split('T')[0] === current.toISOString().split('T')[0]
      );

      const isOnVacation = excludeVacations.some(vacation => {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        return current >= vacStart && current <= vacEnd;
      });

      if (!isHoliday && !isOnVacation) {
        workingDays++;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

// Duración (días) de una tarea pendiente para la métrica de carga:
//   1) la REAL de task_meta si la creó Assignify (la más fiable, refleja el tier);
//   2) si no, la derivamos de sus fechas REALES start→due (días hábiles) — así TODAS
//      las tareas no completadas pesan algo realista sin depender de task_meta;
//   3) piso de FALLBACK por si las fechas no dan un span > 0.
function estimateTaskDurationDays(task: ActiveClickUpTask): number {
  if (task.durationDays !== undefined) return task.durationDays;
  const fromDates = calculateWorkingDaysBetween(new Date(task.startDate), new Date(task.dueDate));
  return fromDates > 0 ? fromDates : FALLBACK_TASK_DURATION_DAYS;
}

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
  let maxIterations = 10;
  let iterations = 0;

  while (adjusted && iterations < maxIterations) {
    adjusted = false;
    iterations++;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = taskDurationDays > 0
      ? await calculateWorkingDeadline(availableDate, taskHours)
      : availableDate;

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      const hasConflict = availableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        const dayAfterVacation = new Date(vacEnd);
        dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
        const newAvailableDate = await getNextAvailableStart(dayAfterVacation);

        availableDate = newAvailableDate;
        adjusted = true;
        break;
      }
    }
  }

  return availableDate;
}

async function getVacationAwareUserSlots(
  typeId: number,
  brandId: string,
  taskDurationDays: number,
  reqPriority: Priority,
  workspaceId: string | null,
  clickupToken: string | undefined
): Promise<VacationAwareUserSlot[]> {
  const allUsersWithRoles = await db.query.user.findMany({
    // [SaaS] Solo los miembros del workspace activo (aislamiento multi-inquilino).
    where: and(eq(userTable.active, true), eq(userTable.workspaceId, workspaceId ?? '__none__')),
    with: {
      roles: {
        where: or(eq(userRole.brandId, brandId), isNull(userRole.brandId)),
      },
      vacations: {
        where: gte(userVacation.endDate, new Date()),
      },
    },
  });

  // Afinidad de CARGO respecto al tipo pedido (análogo al escalado por nivel):
  //   1 = tiene un rol para este tipo con isPrimary=true  → cargo PRIMARIO
  //   2 = tiene un rol para este tipo con isPrimary=false → cargo SECUNDARIO
  //   3 = NO tiene rol para este tipo                     → otro cargo (FALLBACK)
  // Antes se filtraba a solo los compatibles; ahora se incluye a TODOS los activos
  // y la afinidad ordena la preferencia (primarios → secundarios → otros).
  // El match por brand ya viene aplicado en la query de `roles` (brandId = brand o NULL).
  const roleAffinityOf = (u: (typeof allUsersWithRoles)[number]): 1 | 2 | 3 => {
    const rolesForType = u.roles.filter(role => role.typeId === typeId);
    if (rolesForType.length === 0) return 3;
    return rolesForType.some(role => role.isPrimary) ? 1 : 2;
  };

  const candidateUsers = allUsersWithRoles.map(user => ({
    user,
    roleAffinity: roleAffinityOf(user),
  }));

  const userIds = candidateUsers.map(c => c.user.id);

  // Las tareas se leen EN VIVO de ClickUp (misma fuente que el tablero), no de la DB.
  // La disponibilidad y la carga de un diseñador dependen de TODAS sus tareas
  // pendientes (TO_DO/IN_PROGRESS) sin importar el tipo de la tarea nueva.
  // ON_APPROVAL se excluye: ya está entregado y no ocupa al diseñador.
  // [SaaS] Lee SOLO las tareas del workspace activo, con el token de ese inquilino.
  const allClickUpTasks = await fetchActiveClickUpTasks({ token: clickupToken, teamId: workspaceId });

  const tasksByUser: Record<string, ActiveClickUpTask[]> = {};
  for (const task of allClickUpTasks) {
    if (!PENDING_CLICKUP_STATUSES.includes(task.status)) continue;
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.id)) {
        if (!tasksByUser[assignee.id]) {
          tasksByUser[assignee.id] = [];
        }
        tasksByUser[assignee.id].push(task);
      }
    }
  }

  // Ordenar tareas por fecha de inicio.
  for (const userId in tasksByUser) {
    tasksByUser[userId].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  const eligibleSlots: VacationAwareUserSlot[] = [];

  for (const { user, roleAffinity } of candidateUsers) {
    const userTasks = tasksByUser[user.id] || [];
    const upcomingVacations: UserVacation[] = user.vacations.map(v => ({
      id: v.id,
      userId: v.userId,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate)
    }));

    // CARRIL DE PRIORIDAD (mismo modelo que el motor de fechas): la tarea nueva se
    // encola tras las de prioridad IGUAL o MAYOR y corre EN PARALELO con las de
    // menor. Por eso la disponibilidad se mide sobre ESE carril, no sobre toda la
    // cola — así QUIÉN y CUÁNDO concuerdan (un URGENT puede empezar antes que la
    // última deadline absoluta del diseñador si lo que tiene por delante es de menor
    // prioridad).
    const reqRank = PRIORITY_RANK[reqPriority];
    const laneTasks = userTasks.filter(
      (t) => PRIORITY_RANK[mapClickUpPriority(t.priority)] >= reqRank
    );

    let baseAvailableDate: Date;
    let lastDeadline: Date | undefined;
    if (laneTasks.length > 0) {
      // Se libera tras la última entrega del CARRIL (la deadline más lejana en él).
      lastDeadline = new Date(Math.max(...laneTasks.map((t) => new Date(t.dueDate).getTime())));
      baseAvailableDate = await getNextAvailableStart(lastDeadline);
    } else {
      baseAvailableDate = await getNextAvailableStart(new Date());
    }

    // Carga total = suma de duraciones de TODAS sus tareas pendientes: la REAL de
    // task_meta cuando existe, o la derivada de las fechas start→due si no (cubre
    // las tareas creadas fuera de Assignify sin depender de la tabla).
    const totalAssignedDurationDays = userTasks.reduce(
      (sum, t) => sum + estimateTaskDurationDays(t),
      0
    );
    // Congestión del carril: cuántas de prioridad ≥ la pedida ya tiene (para no
    // apilar urgentes en quien ya carga muchas cuando se liberan en fechas parecidas).
    const samePriorityOrHigherLoad = laneTasks.length;

    // Ajustar la fecha de inicio para SALTAR las vacaciones (en lugar de excluir al usuario).
    // Si la tarea —empezando cuando el usuario se libera de su cola— choca con una vacación,
    // se mueve el inicio a después de la vacación. Si para entonces ya volvió, se asigna normal.
    const availableDate = upcomingVacations.length > 0
      ? await getNextAvailableStartAfterVacations(baseAvailableDate, upcomingVacations, taskDurationDays)
      : baseAvailableDate;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = await calculateWorkingDeadline(availableDate, taskHours);

    const workingDaysUntilAvailable = calculateWorkingDaysBetween(
      new Date(),
      availableDate,
      upcomingVacations
    );

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    // Estado para los badges del selector (no decide a quién se elige):
    //   on_vacation → ahora mismo de vacaciones, o la tarea se corrió por una vacación.
    //   overloaded  → más de OVERLOAD_THRESHOLD_DAYS de trabajo pendiente.
    const now = new Date();
    const onVacationNow = upcomingVacations.some(
      (v) => v.startDate <= now && v.endDate >= now
    );
    const shiftedByVacation = availableDate.getTime() !== baseAvailableDate.getTime();
    const hasVacationConflict = onVacationNow || shiftedByVacation;
    const status: DesignerStatus = hasVacationConflict
      ? 'on_vacation'
      : totalAssignedDurationDays > OVERLOAD_THRESHOLD_DAYS
        ? 'overloaded'
        : 'available';

    eligibleSlots.push({
      userId: user.id,
      userName: user.name,
      availableDate,
      // El detalle de tareas no se usa para la decisión (que se basa en
      // availableDate + totalAssignedDurationDays). Se deja vacío para mantener el tipo.
      tasks: [],
      cargaTotal: userTasks.length,
      isSpecialist,
      lastTaskDeadline: lastDeadline,
      // Nivel del diseñador (Junior/Mid/Senior) leído de Turso, para el escalado.
      level: user.level,
      upcomingVacations,
      potentialTaskStart: availableDate,
      potentialTaskEnd,
      hasVacationConflict,
      workingDaysUntilAvailable,
      vacationConflictDetails: undefined,
      totalAssignedDurationDays,
      // Afinidad de cargo (1 primario / 2 secundario / 3 otro): eje superior al de nivel.
      roleAffinity,
      samePriorityOrHigherLoad,
      status,
    });
  }

  return eligibleSlots;
}

/**
 * Selección del mejor diseñador (doble escalado CARGO sobre NIVEL + carril/congestión
 * de prioridad). Capa fina de IO: solo lee los umbrales de Settings y delega TODA la
 * decisión en el núcleo PURO `pickBestAcrossAffinity` (testeado aparte en
 * assignment-ranking). El override MANUAL no pasa por aquí.
 */
async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[],
  reqLevel: Level
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) return null;

  const settings = await getAppSettings();
  return pickBestAcrossAffinity(
    userSlots,
    reqLevel,
    settings.levelEscalationDays,
    settings.thresholds.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST
  );
}

export async function getBestUserWithCache(
  typeId: number,
  brandId: string,
  priority: Priority,
  durationDays?: number,
  reqLevel: Level = Level.MID,
  workspaceId: string | null = null,
  clickupToken?: string
): Promise<UserSlot | null> {
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${workspaceId ?? 'default'}-${typeId}-${brandId}-${priority}-vacation-${durationDays || 'no-duration'}-lvl-${reqLevel}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    return bestSlot;
  }

  const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0, priority, workspaceId, clickupToken);
  const bestVacationSlot = await selectBestUserWithVacationLogic(vacationAwareSlots, reqLevel);

  if (!bestVacationSlot) {
    setInCache(cacheKey, null);
    return null;
  }

  const compatibleSlot: UserSlot = {
    userId: bestVacationSlot.userId,
    userName: bestVacationSlot.userName,
    availableDate: bestVacationSlot.availableDate,
    tasks: bestVacationSlot.tasks,
    cargaTotal: bestVacationSlot.cargaTotal,
    isSpecialist: bestVacationSlot.isSpecialist,
    lastTaskDeadline: bestVacationSlot.lastTaskDeadline,
    totalAssignedDurationDays: bestVacationSlot.totalAssignedDurationDays,
    level: bestVacationSlot.level,
  };

  setInCache(cacheKey, compatibleSlot);
  return compatibleSlot;
}

// Orden de los badges al ordenar la lista del selector: disponibles primero.
const STATUS_DISPLAY_RANK: Record<DesignerStatus, number> = {
  available: 0,
  overloaded: 1,
  on_vacation: 2,
};

const ROLE_AFFINITY_REASON: Record<1 | 2 | 3, string> = {
  1: 'primary role',
  2: 'secondary role',
  3: 'other role (fallback)',
};

// Explicación legible de por qué el motor posiciona a un candidato así. Es lo que
// el selector muestra para que el humano confíe (o decida overridear con criterio).
function buildReason(slot: VacationAwareUserSlot, priority: Priority): string {
  const parts: string[] = [];
  const availableFrom = slot.availableDate.toISOString().split('T')[0];
  parts.push(`frees up ${availableFrom}`);

  const congestion = slot.samePriorityOrHigherLoad ?? 0;
  parts.push(
    congestion === 0
      ? `no ${priority}+ tasks queued`
      : `${congestion} ${priority}+ task${congestion === 1 ? '' : 's'} queued`
  );

  parts.push(ROLE_AFFINITY_REASON[slot.roleAffinity ?? 3]);

  if (slot.status === 'on_vacation') parts.push('on vacation');
  else if (slot.status === 'overloaded') parts.push('heavy workload');

  // Capitaliza la primera letra.
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * FUENTE ÚNICA para la UI de asignación: devuelve el diseñador sugerido por el
 * motor (mismo criterio que `getBestUserWithCache`) JUNTO con la lista completa
 * de candidatos y su estado, para que el selector pinte opciones y badges sin un
 * segundo endpoint/criterio distinto.
 *
 * Orden de la lista: sugerido primero, luego disponibles, después por afinidad de
 * cargo y, por último, quien se libera antes.
 */
export async function getRankedCandidates(
  typeId: number,
  brandId: string,
  priority: Priority,
  durationDays: number,
  reqLevel: Level = Level.MID,
  workspaceId: string | null = null,
  clickupToken?: string
): Promise<{ suggestedUserId: string | null; candidates: RankedCandidate[] }> {
  type Ranked = { suggestedUserId: string | null; candidates: RankedCandidate[] };
  // Cacheado igual que getBestUserWithCache: evita re-leer ClickUp en cada
  // recálculo de sugerencia (menos bloqueos en el formulario).
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}ranked-${workspaceId ?? 'default'}-${typeId}-${brandId}-${priority}-${durationDays || 'no-duration'}-lvl-${reqLevel}`;
  const cached = getFromCache<Ranked>(cacheKey);
  if (cached !== undefined) return cached;

  const slots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0, priority, workspaceId, clickupToken);
  const best = await selectBestUserWithVacationLogic(slots, reqLevel);
  const suggestedUserId = best?.userId ?? null;

  const candidates: RankedCandidate[] = slots
    .map((s) => ({
      userId: s.userId,
      userName: s.userName,
      status: s.status ?? 'available',
      availableFrom: s.availableDate.toISOString().split('T')[0],
      isSuggested: s.userId === suggestedUserId,
      roleAffinity: s.roleAffinity ?? 3,
      reason: buildReason(s, priority),
      // Campos privados para ordenar (no salen en el tipo público).
      _availableMs: s.availableDate.getTime(),
    }))
    .sort((a, b) => {
      if (a.isSuggested !== b.isSuggested) return a.isSuggested ? -1 : 1;
      const statusDiff = STATUS_DISPLAY_RANK[a.status] - STATUS_DISPLAY_RANK[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (a.roleAffinity !== b.roleAffinity) return a.roleAffinity - b.roleAffinity;
      return a._availableMs - b._availableMs;
    })
    .map(({ _availableMs, ...c }) => c);

  const result: Ranked = { suggestedUserId, candidates };
  setInCache(cacheKey, result);
  return result;
}


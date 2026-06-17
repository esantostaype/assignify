/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/task-assignment.service.ts - SIN queuePosition
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { db } from '@/db';
import { user as userTable, userRole, userVacation } from '@/db/schema';
import { eq, or, isNull, gte } from 'drizzle-orm';
import { Priority, Status, Level } from '@/db/enums';
import { UserSlot, UserWithRoles, Task, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline, OCCUPYING_STATUSES } from '@/utils/task-calculation-utils';
import { CACHE_KEYS } from '@/config';
import { getAppSettings } from '@/services/app-settings.service';
import { getFromCache, setInCache } from '@/utils/cache';
import { fetchActiveClickUpTasks, type ActiveClickUpTask } from '@/services/clickup-tasks.service';
import usHolidays from '@/data/usHolidays.json'

// Rango numérico de cada nivel para el escalado de asignación.
// JUNIOR < MID < SENIOR. Una tarea solo se asigna en automático a niveles >= al pedido.
const LEVEL_RANK: Record<Level, number> = {
  JUNIOR: 1,
  MID: 2,
  SENIOR: 3,
};

// Orden de escalado, de menor a mayor.
const LEVELS_ASCENDING: Level[] = [Level.JUNIOR, Level.MID, Level.SENIOR];

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
  taskDurationDays: number
): Promise<VacationAwareUserSlot[]> {
  console.log(`🏖️ === VACATION FILTERING FOR ${taskDurationDays}-DAY TASK ===`);
  console.log(`📋 Will EXCLUDE users with vacation conflicts instead of adjusting dates`);

  const allUsersWithRoles = await db.query.user.findMany({
    where: eq(userTable.active, true),
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

  const primaryCount = candidateUsers.filter(c => c.roleAffinity === 1).length;
  const secondaryCount = candidateUsers.filter(c => c.roleAffinity === 2).length;
  const fallbackCount = candidateUsers.filter(c => c.roleAffinity === 3).length;
  console.log(
    `👥 Candidatos para tipo ${typeId}: ${primaryCount} primarios, ${secondaryCount} secundarios, ${fallbackCount} otros cargos (fallback)`
  );

  const userIds = candidateUsers.map(c => c.user.id);

  // Las tareas se leen EN VIVO de ClickUp (misma fuente que el tablero), no de la DB.
  // La disponibilidad y la carga de un diseñador dependen de TODAS sus tareas
  // pendientes (TO_DO/IN_PROGRESS) sin importar el tipo de la tarea nueva.
  // ON_APPROVAL se excluye: ya está entregado y no ocupa al diseñador.
  const allClickUpTasks = await fetchActiveClickUpTasks();

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
  const excludedUsers: Array<{ name: string, reason: string, vacations: string[] }> = [];

  for (const { user, roleAffinity } of candidateUsers) {
    console.log(`\n👤 Evaluating ${user.name} (${user.id}) — afinidad de cargo ${roleAffinity}`);

    const userTasks = tasksByUser[user.id] || [];
    const upcomingVacations: UserVacation[] = user.vacations.map(v => ({
      id: v.id,
      userId: v.userId,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate)
    }));

    console.log(`   🏖️ Upcoming vacations: ${upcomingVacations.length}`);
    upcomingVacations.forEach(vacation => {
      const days = Math.ceil((vacation.endDate.getTime() - vacation.startDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`     - ${vacation.startDate.toISOString().split('T')[0]} to ${vacation.endDate.toISOString().split('T')[0]} (${days} days)`);
    });

    // Calculate when user would be available
    let baseAvailableDate: Date;
    let totalAssignedDurationDays = 0;
    let lastDeadline: Date | undefined;

    if (userTasks.length > 0) {
      // Se libera tras su última entrega pendiente (la deadline MÁS lejana de su cola).
      lastDeadline = new Date(Math.max(...userTasks.map((t) => new Date(t.dueDate).getTime())));
      baseAvailableDate = await getNextAvailableStart(lastDeadline);

      // ClickUp no trae tier: 1 día por tarea pendiente es suficiente para el desempate.
      totalAssignedDurationDays = userTasks.length;

      console.log(`   📊 Current workload: ${userTasks.length} tasks, ${totalAssignedDurationDays} days total`);
      console.log(`   📅 Available after current tasks: ${baseAvailableDate.toISOString().split('T')[0]}`);
    } else {
      baseAvailableDate = await getNextAvailableStart(new Date());
      console.log(`   ✅ User is currently free, available from: ${baseAvailableDate.toISOString().split('T')[0]}`);
    }

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
      hasVacationConflict: false,
      workingDaysUntilAvailable,
      vacationConflictDetails: undefined,
      totalAssignedDurationDays,
      // Afinidad de cargo (1 primario / 2 secundario / 3 otro): eje superior al de nivel.
      roleAffinity,
    });

    const affinityLabel = roleAffinity === 1 ? 'primario' : roleAffinity === 2 ? 'secundario' : 'otro cargo';
    console.log(`   ✅ ${user.name}: cargo ${affinityLabel}, nivel ${user.level}, disponible ${availableDate.toISOString().split('T')[0]}, carga ${totalAssignedDurationDays}d, ${isSpecialist ? 'especialista' : 'generalista'}`);
  }

  console.log(`\n🚫 === USERS EXCLUDED DUE TO VACATIONS ===`);
  if (excludedUsers.length === 0) {
    console.log(`✅ No users excluded - all users available`);
  } else {
    excludedUsers.forEach(excluded => {
      console.log(`❌ ${excluded.name}: ${excluded.reason}`);
      excluded.vacations.forEach(vacation => {
        console.log(`   📅 Conflicting vacation: ${vacation}`);
      });
    });
  }

  console.log(`\n✅ === ELIGIBLE USERS (${eligibleSlots.length}) ===`);
  eligibleSlots.forEach(slot => {
    console.log(`✅ ${slot.userName}: ${slot.isSpecialist ? 'Specialist' : 'Generalist'}, available ${slot.availableDate.toISOString().split('T')[0]}, load: ${slot.totalAssignedDurationDays} days`);
  });

  return eligibleSlots;
}

// Disponible antes primero (fecha ya ajustada por cola + vacaciones + festivos);
// a igualdad de fecha, el de menor carga acumulada.
function sortByAvailability(users: VacationAwareUserSlot[]): VacationAwareUserSlot[] {
  return [...users].sort((a, b) => {
    const dateDiff = a.availableDate.getTime() - b.availableDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
  });
}

/**
 * Mejor candidato DENTRO de un mismo nivel. La regla de niveles manda; la de
 * especialista/generalista queda como DESEMPATE dentro del nivel: si el mejor
 * especialista se libera mucho más tarde que el mejor generalista
 * (umbral DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST), se prefiere el generalista.
 * En caso normal gana simplemente el de antes-disponible / menos-carga.
 */
function pickBestInLevel(
  slots: VacationAwareUserSlot[],
  forceGeneralistThresholdDays: number
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const sorted = sortByAvailability(slots);
  const bestOverall = sorted[0];

  const bestSpecialist = sorted.find((s) => s.isSpecialist) ?? null;
  const bestGeneralist = sorted.find((s) => !s.isSpecialist) ?? null;

  // Desempate especialista/generalista solo si el mejor del nivel es especialista
  // y existe un generalista que se libera bastante antes.
  if (bestSpecialist && bestGeneralist && bestOverall.isSpecialist) {
    const daysLater =
      (bestSpecialist.availableDate.getTime() - bestGeneralist.availableDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysLater > forceGeneralistThresholdDays) {
      console.log(
        `   🔧 [${bestSpecialist.level}] especialista ${bestSpecialist.userName} libre ${daysLater.toFixed(1)}d más tarde → generalista ${bestGeneralist.userName}`
      );
      return bestGeneralist;
    }
  }

  return bestOverall;
}

/**
 * Mejor candidato de un conjunto de slots aplicando el ESCALADO POR NIVEL.
 * (Antes era el cuerpo de `selectBestUserWithVacationLogic`; se extrajo para poder
 *  reutilizarlo dentro de cada grupo de afinidad de cargo.)
 * - Solo se consideran candidatos de nivel >= reqLevel (nunca uno inferior en automático).
 * - Se toma el mejor candidato de cada nivel (antes-disponible / menos-carga, con el
 *   desempate especialista/generalista interno).
 * - Se empieza por reqLevel y se compara contra el nivel inmediatamente superior:
 *   si el mejor del nivel actual se libera MÁS de `levelEscalationDays` días DESPUÉS
 *   que el mejor del nivel superior, se escala al superior. Se repite hacia SENIOR.
 */
function pickBestByLevelEscalation(
  slots: VacationAwareUserSlot[],
  reqLevel: Level,
  levelEscalationDays: number,
  forceGeneralistThreshold: number
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const reqRank = LEVEL_RANK[reqLevel];

  // Solo niveles >= al pedido, de menor a mayor.
  const candidateLevels = LEVELS_ASCENDING.filter((lvl) => LEVEL_RANK[lvl] >= reqRank);

  // Mejor candidato por nivel (los niveles sin candidatos quedan en null).
  const bestByLevel: Partial<Record<Level, VacationAwareUserSlot>> = {};
  for (const lvl of candidateLevels) {
    const slotsOfLevel = slots.filter((s) => s.level === lvl);
    const best = pickBestInLevel(slotsOfLevel, forceGeneralistThreshold);
    if (best) {
      bestByLevel[lvl] = best;
      console.log(
        `      • Nivel ${lvl}: mejor = ${best.userName} (libre ${best.availableDate.toISOString().split('T')[0]}, carga ${best.totalAssignedDurationDays}d)`
      );
    } else {
      console.log(`      • Nivel ${lvl}: sin candidatos`);
    }
  }

  // Escalado: arrancamos en el primer nivel con candidato (>= reqLevel) y subimos.
  let chosen: VacationAwareUserSlot | null = null;

  for (const lvl of candidateLevels) {
    const current = bestByLevel[lvl];
    if (!current) continue; // este nivel no tiene a nadie; el bucle sigue al superior

    if (!chosen) {
      chosen = current;
      continue;
    }

    // `chosen` es el mejor del/los niveles anteriores; `current` es el del nivel superior.
    const daysLater =
      (chosen.availableDate.getTime() - current.availableDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysLater > levelEscalationDays) {
      console.log(
        `      ⬆️ ${chosen.userName} (${chosen.level}) libre ${daysLater.toFixed(1)}d más tarde que ${current.userName} (${lvl}) → escala a ${lvl}`
      );
      chosen = current;
    } else {
      console.log(
        `      ⏹️ ${chosen.userName} (${chosen.level}) NO supera el umbral (${daysLater.toFixed(1)}d <= ${levelEscalationDays}d) vs ${lvl}: se mantiene`
      );
    }
  }

  return chosen;
}

// Grupos de afinidad de cargo, de mayor preferencia a menor: 1 primario → 2 secundario → 3 otro.
const ROLE_AFFINITY_ASCENDING: Array<1 | 2 | 3> = [1, 2, 3];
const AFFINITY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'primario',
  2: 'secundario',
  3: 'otro cargo',
};

/**
 * Selección con DOBLE ESCALADO: CARGO por encima de NIVEL.
 *
 * Eje de CARGO (nuevo, análogo al de nivel):
 * - Los slots se agrupan por `roleAffinity` (1 primario → 2 secundario → 3 otro cargo).
 * - Se arranca en el grupo de MENOR affinity con candidatos (1, normalmente los primarios)
 *   y se elige su mejor candidato con la lógica de nivel ya existente.
 * - ESCALADO entre cargos: si el mejor del grupo actual se libera MÁS de
 *   `DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST` días DESPUÉS que el mejor del siguiente grupo
 *   (affinity superior), se considera también ese grupo (1→2→3). Es el MISMO umbral que
 *   separa especialista de generalista: "ve a otros cargos cuando los preferidos están saturados".
 *
 * Eje de NIVEL (sin cambios): dentro de cada grupo se aplica `pickBestByLevelEscalation`
 * (nivel >= reqLevel, quien se libera antes / menos carga, desempate especialista/generalista).
 *
 * El override MANUAL (asignar a mano) sigue ignorando cargo y nivel: no pasa por aquí.
 */
async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[],
  reqLevel: Level
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) {
    console.log(`❌ No users available - all users excluded due to vacation conflicts`);
    return null;
  }

  console.log(`\n🏆 === SELECTING BEST USER (escalado por cargo + nivel, pedido: ${reqLevel}) ===`);

  const settings = await getAppSettings();
  const forceGeneralistThreshold = settings.thresholds.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST;
  const levelEscalationDays = settings.levelEscalationDays;

  // Mejor candidato por grupo de afinidad de cargo (resolviendo el nivel internamente).
  // Los slots sin `roleAffinity` (datos antiguos) se tratan como afinidad 3 (fallback).
  const bestByAffinity: Partial<Record<1 | 2 | 3, VacationAwareUserSlot>> = {};
  for (const affinity of ROLE_AFFINITY_ASCENDING) {
    const slotsOfAffinity = userSlots.filter((s) => (s.roleAffinity ?? 3) === affinity);
    if (slotsOfAffinity.length === 0) {
      console.log(`   • Cargo ${AFFINITY_LABEL[affinity]} (${affinity}): sin candidatos`);
      continue;
    }
    console.log(`   • Cargo ${AFFINITY_LABEL[affinity]} (${affinity}): ${slotsOfAffinity.length} candidato(s)`);
    const best = pickBestByLevelEscalation(
      slotsOfAffinity,
      reqLevel,
      levelEscalationDays,
      forceGeneralistThreshold
    );
    if (best) {
      bestByAffinity[affinity] = best;
      console.log(
        `     ↳ mejor de cargo ${AFFINITY_LABEL[affinity]}: ${best.userName} (nivel ${best.level}, libre ${best.availableDate.toISOString().split('T')[0]})`
      );
    } else {
      console.log(`     ↳ cargo ${AFFINITY_LABEL[affinity]}: nadie cumple nivel >= ${reqLevel}`);
    }
  }

  // Escalado entre cargos: arrancamos en el primer grupo con candidato y subimos de affinity.
  let chosen: VacationAwareUserSlot | null = null;

  for (const affinity of ROLE_AFFINITY_ASCENDING) {
    const current = bestByAffinity[affinity];
    if (!current) continue; // este cargo no tiene a nadie (con nivel suficiente); seguimos

    if (!chosen) {
      chosen = current;
      continue;
    }

    // `chosen` es el mejor de cargos preferidos; `current` es el del cargo de menor preferencia.
    const daysLater =
      (chosen.availableDate.getTime() - current.availableDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysLater > forceGeneralistThreshold) {
      console.log(
        `   ⬆️ Cargo: ${chosen.userName} (${AFFINITY_LABEL[chosen.roleAffinity ?? 3]}) libre ${daysLater.toFixed(1)}d más tarde que ${current.userName} (${AFFINITY_LABEL[affinity]}) → escala a ${AFFINITY_LABEL[affinity]}`
      );
      chosen = current;
    } else {
      console.log(
        `   ⏹️ Cargo: ${chosen.userName} (${AFFINITY_LABEL[chosen.roleAffinity ?? 3]}) NO supera el umbral (${daysLater.toFixed(1)}d <= ${forceGeneralistThreshold}d) vs ${AFFINITY_LABEL[affinity]}: se mantiene`
      );
    }
  }

  if (chosen) {
    console.log(
      `🏆 Seleccionado: ${chosen.userName} (cargo ${AFFINITY_LABEL[chosen.roleAffinity ?? 3]}, nivel ${chosen.level}, disponible ${chosen.availableDate.toISOString().split('T')[0]})`
    );
  } else {
    console.log(`❌ No hay candidatos de nivel >= ${reqLevel} disponibles`);
  }

  return chosen;
}

export async function getBestUserWithCache(
  typeId: number,
  brandId: string,
  priority: Priority,
  durationDays?: number,
  reqLevel: Level = Level.MID
): Promise<UserSlot | null> {

  console.log(`\n🎯 === GET BEST USER WITH VACATION CACHE ===`);
  console.log(`📋 Params: typeId=${typeId}, brandId=${brandId}, priority=${priority}, duration=${durationDays}, level=${reqLevel}`);

  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}-vacation-${durationDays || 'no-duration'}-lvl-${reqLevel}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    console.log(`💾 Using cached result for user: ${bestSlot?.userName || 'null'}`);
    return bestSlot;
  }

  console.log(`🏖️ Calculating vacation-aware user slots...`);
  const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0);
  const bestVacationSlot = await selectBestUserWithVacationLogic(vacationAwareSlots, reqLevel);

  if (!bestVacationSlot) {
    console.log(`❌ No eligible users found after vacation filtering`);
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

  console.log(`✅ Selected vacation-aware user: ${compatibleSlot.userName}`);
  console.log(`   📅 Available from: ${compatibleSlot.availableDate.toISOString().split('T')[0]}`);
  console.log(`   🎯 Is specialist: ${compatibleSlot.isSpecialist}`);

  setInCache(cacheKey, compatibleSlot);
  return compatibleSlot;
}


/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/task-assignment.service.ts - SIN queuePosition
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { db } from '@/db';
import { user as userTable, userRole, userVacation } from '@/db/schema';
import { eq, or, isNull, gte } from 'drizzle-orm';
import { Priority, Status } from '@/db/enums';
import { UserSlot, UserWithRoles, Task, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline, OCCUPYING_STATUSES } from '@/utils/task-calculation-utils';
import { CACHE_KEYS } from '@/config';
import { getAppSettings } from '@/services/app-settings.service';
import { getFromCache, setInCache } from '@/utils/cache';
import { fetchActiveClickUpTasks, type ActiveClickUpTask } from '@/services/clickup-tasks.service';
import usHolidays from '@/data/usHolidays.json'

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

  const compatibleUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  );

  console.log(`👥 Found ${compatibleUsers.length} compatible users for type ${typeId}`);

  const userIds = compatibleUsers.map(user => user.id);

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

  for (const user of compatibleUsers) {
    console.log(`\n👤 Evaluating ${user.name} (${user.id})`);

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
      upcomingVacations,
      potentialTaskStart: availableDate,
      potentialTaskEnd,
      hasVacationConflict: false,
      workingDaysUntilAvailable,
      vacationConflictDetails: undefined,
      totalAssignedDurationDays,
    });

    console.log(`   ✅ ${user.name}: disponible ${availableDate.toISOString().split('T')[0]}, carga ${totalAssignedDurationDays}d, ${isSpecialist ? 'especialista' : 'generalista'}`);
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

async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[]
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) {
    console.log(`❌ No users available - all users excluded due to vacation conflicts`);
    return null;
  }

  console.log(`\n🏆 === SELECTING BEST USER FROM ${userSlots.length} ELIGIBLE USERS ===`);

  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  console.log(`   🎯 Specialists available: ${specialists.length}`);
  console.log(`   🔧 Generalists available: ${generalists.length}`);

  // Disponible antes primero (fecha ya ajustada por cola + vacaciones + festivos);
  // a igualdad de fecha, el de menor carga acumulada.
  const sortUsers = (users: VacationAwareUserSlot[]) => {
    return [...users].sort((a, b) => {
      const dateDiff = a.availableDate.getTime() - b.availableDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
    });
  };

  const sortedSpecialists = sortUsers(specialists);
  const sortedGeneralists = sortUsers(generalists);

  const bestSpecialist = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null;
  const bestGeneralist = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null;

  if (bestSpecialist && bestGeneralist) {
    // Si el especialista estaría disponible bastante más tarde que el generalista, usar el generalista.
    const daysLater =
      (bestSpecialist.availableDate.getTime() - bestGeneralist.availableDate.getTime()) / (1000 * 60 * 60 * 24);

    const { DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST } = (await getAppSettings()).thresholds;
    if (daysLater > DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
      console.log(`🔧 Especialista disponible ${daysLater.toFixed(1)}d más tarde → generalista ${bestGeneralist.userName}`);
      return bestGeneralist;
    }
    console.log(`🎯 Especialista ${bestSpecialist.userName} (disponible ${bestSpecialist.availableDate.toISOString().split('T')[0]})`);
    return bestSpecialist;
  }

  if (bestSpecialist) {
    console.log(`🎯 Selecting only available specialist: ${bestSpecialist.userName}`);
    return bestSpecialist;
  }

  if (bestGeneralist) {
    console.log(`🔧 Selecting only available generalist: ${bestGeneralist.userName}`);
    return bestGeneralist;
  }

  console.log(`❌ No users available for assignment`);
  return null;
}

export async function getBestUserWithCache(
  typeId: number,
  brandId: string,
  priority: Priority,
  durationDays?: number
): Promise<UserSlot | null> {

  console.log(`\n🎯 === GET BEST USER WITH VACATION CACHE ===`);
  console.log(`📋 Params: typeId=${typeId}, brandId=${brandId}, priority=${priority}, duration=${durationDays}`);

  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}-vacation-${durationDays || 'no-duration'}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    console.log(`💾 Using cached result for user: ${bestSlot?.userName || 'null'}`);
    return bestSlot;
  }

  console.log(`🏖️ Calculating vacation-aware user slots...`);
  const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0);
  const bestVacationSlot = await selectBestUserWithVacationLogic(vacationAwareSlots);

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
    totalAssignedDurationDays: bestVacationSlot.totalAssignedDurationDays
  };

  console.log(`✅ Selected vacation-aware user: ${compatibleSlot.userName}`);
  console.log(`   📅 Available from: ${compatibleSlot.availableDate.toISOString().split('T')[0]}`);
  console.log(`   🎯 Is specialist: ${compatibleSlot.isSpecialist}`);

  setInCache(cacheKey, compatibleSlot);
  return compatibleSlot;
}


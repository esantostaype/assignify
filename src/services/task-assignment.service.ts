/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/task-assignment.service.ts - SIN queuePosition
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { prisma } from '@/utils/prisma';
import { Priority, Status } from '@prisma/client';
import { UserSlot, UserWithRoles, Task, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';
import { TASK_ASSIGNMENT_THRESHOLDS, CACHE_KEYS } from '@/config';
import { getFromCache, setInCache } from '@/utils/cache';
import usHolidays from '@/data/usHolidays.json'

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

function checkVacationConflict(
  taskStart: Date,
  taskEnd: Date,
  vacations: UserVacation[]
): { hasConflict: boolean; conflictingVacation?: UserVacation } {
  for (const vacation of vacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);

    if (taskStart <= vacEnd && taskEnd >= vacStart) {
      console.log(`❌ VACATION CONFLICT DETECTED:`, {
        taskPeriod: `${taskStart.toISOString().split('T')[0]} to ${taskEnd.toISOString().split('T')[0]}`,
        vacationPeriod: `${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`,
        conflict: 'OVERLAP'
      });
      return { hasConflict: true, conflictingVacation: vacation };
    }
  }

  return { hasConflict: false };
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

export async function findCompatibleUsers(typeId: number, brandId: string): Promise<UserWithRoles[]> {
  const cacheKey = `${CACHE_KEYS.COMPATIBLE_USERS_PREFIX}${typeId}-${brandId}`;
  const compatibleUsers = getFromCache<UserWithRoles[]>(cacheKey);

  if (compatibleUsers) {
    return compatibleUsers;
  }

  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        }
      },
    },
  });

  const filteredUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  ) as UserWithRoles[];

  setInCache(cacheKey, filteredUsers);
  return filteredUsers;
}

async function getActualAvailableStartDate(
  userId: string, 
  typeId?: number,
  brandId?: string
): Promise<Date> {
  console.log(`🔍 Calculando fecha de inicio REAL para usuario ${userId}`);
  console.log(`   - Type ID: ${typeId || 'ALL TYPES'}`);
  console.log(`   - Brand ID: ${brandId || 'ALL BRANDS'}`);
  
  // ✅ BUSCAR TODAS LAS TAREAS DEL USUARIO (sin filtrar por tipo o brand)
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: [Status.COMPLETE] }
      // ✅ NO FILTRAR POR typeId NI brandId para encontrar el deadline MÁS LEJANO
    },
    orderBy: { deadline: 'desc' }, // ✅ ORDENAR POR DEADLINE DESCENDENTE
    include: {
      tier: true,
      brand: true
    }
  });

  console.log(`   📊 Tareas encontradas TOTALES para usuario: ${userTasks.length}`);
  
  if (userTasks.length === 0) {
    const startFromNow = await getNextAvailableStart(new Date());
    console.log(`   ✅ No hay tareas, empezando desde: ${startFromNow.toISOString()}`);
    return startFromNow;
  }

  // ✅ ENCONTRAR LA TAREA CON EL DEADLINE MÁS LEJANO
  const lastTask = userTasks[0]; // Ya está ordenado por deadline descendente
  console.log(`   📅 Última tarea encontrada: "${lastTask.name}"`);
  console.log(`     - Brand: ${lastTask.brand.name}`);
  console.log(`     - Start Date: ${lastTask.startDate.toISOString()}`);
  console.log(`     - Deadline: ${lastTask.deadline.toISOString()}`);
  
  // ✅ CALCULAR SIGUIENTE FECHA DISPONIBLE DESPUÉS DEL DEADLINE MÁS LEJANO
  const nextAvailableStart = await getNextAvailableStart(lastTask.deadline);
  console.log(`   ✅ Siguiente fecha disponible: ${nextAvailableStart.toISOString()}`);
  
  return nextAvailableStart;
}

export async function calculateUserSlots(
  users: UserWithRoles[],
  typeId: number,
  taskDurationDays?: number,
  brandId?: string
): Promise<UserSlot[]> {
  const userIdsSorted = users.map(u => u.id).sort().join('-');
  const cacheKey = `${CACHE_KEYS.USER_SLOTS_PREFIX}${typeId}-${brandId || 'all'}-${userIdsSorted}-${taskDurationDays || 0}`;
  
  console.log(`\n🔍 === CALCULATING USER SLOTS SIN queuePosition ===`);
  console.log(`📋 Parámetros:`);
  console.log(`   - Duration: ${taskDurationDays || 0} days`);
  console.log(`   - Type ID: ${typeId}`);
  console.log(`   - Brand ID: ${brandId || 'all brands'}`);

  const userIds = users.map(user => user.id);

  // ✅ OBTENER TAREAS ORDENADAS POR FECHA, NO POR queuePosition
  const whereClause: any = {
    typeId: typeId,
    status: { notIn: [Status.COMPLETE] },
    assignees: { some: { userId: { in: userIds } } }
  };

  if (brandId) {
    whereClause.brandId = brandId;
  }

  const allRelevantTasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { startDate: 'asc' }, // ✅ ORDENAR POR FECHA, NO POR queuePosition
    include: {
      tier: true,
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  console.log(`📊 Tareas relevantes para este tipo/brand: ${allRelevantTasks.length}`);

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  const resultSlots = await Promise.all(users.map(async (user) => {
    console.log(`\n👤 Processing slot for ${user.name}:`);

    const userTasks = tasksByUser[user.id] || [];
    const cargaTotal = userTasks.length;

    // ✅ CALCULAR FECHA DISPONIBLE REAL BASADA EN TODAS LAS TAREAS DEL USUARIO
    const availableDate = await getActualAvailableStartDate(user.id);
    
    // ✅ CALCULAR ESTADÍSTICAS PARA ESTE TIPO/BRAND ESPECÍFICO
    let totalAssignedDurationDays = 0;
    let lastTaskDeadline: Date | undefined;

    if (userTasks.length > 0) {
      const deadlines = userTasks.map(task => new Date(task.deadline));
      lastTaskDeadline = new Date(Math.max(...deadlines.map(d => d.getTime())));
      
      totalAssignedDurationDays = userTasks.reduce((sum, task) => {
        return sum + (task.customDuration !== null ? task.customDuration : task.tier.duration);
      }, 0);

      console.log(`   📊 Tiene ${userTasks.length} tareas para este tipo/brand`);
      console.log(`   📅 Deadline más lejano (tipo/brand): ${lastTaskDeadline.toISOString()}`);
    }
    
    console.log(`   ✅ Disponible desde (TODAS las tareas): ${availableDate.toISOString()}`);

    // ✅ APLICAR LÓGICA DE VACACIONES SI SE PROPORCIONA DURACIÓN
    let finalAvailableDate = availableDate;
    if (taskDurationDays && taskDurationDays > 0) {
      const userWithVacations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          vacations: {
            where: { endDate: { gte: new Date() } }
          }
        }
      });

      if (userWithVacations?.vacations && userWithVacations.vacations.length > 0) {
        console.log(`   🏖️ Verificando ${userWithVacations.vacations.length} vacaciones próximas...`);

        const upcomingVacations: UserVacation[] = userWithVacations.vacations.map(v => ({
          id: v.id,
          userId: v.userId,
          startDate: new Date(v.startDate),
          endDate: new Date(v.endDate)
        }));

        const taskHours = taskDurationDays * 8;
        const potentialTaskEnd = await calculateWorkingDeadline(availableDate, taskHours);

        let hasConflict = false;
        for (const vacation of upcomingVacations) {
          const vacStart = new Date(vacation.startDate);
          const vacEnd = new Date(vacation.endDate);

          if (availableDate <= vacEnd && potentialTaskEnd >= vacStart) {
            console.log(`   ❌ Conflicto de vacaciones detectado`);
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          console.log(`   🔄 Ajustando fecha por conflictos de vacaciones...`);
          finalAvailableDate = await getNextAvailableStartAfterVacations(
            availableDate,
            upcomingVacations,
            taskDurationDays
          );
          console.log(`   ✅ Fecha ajustada por vacaciones: ${finalAvailableDate.toISOString()}`);
        }
      }
    }

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    return {
      userId: user.id,
      userName: user.name,
      availableDate: finalAvailableDate,
      tasks: userTasks,
      cargaTotal,
      isSpecialist,
      lastTaskDeadline,
      totalAssignedDurationDays,
    };
  }));

  setInCache(cacheKey, resultSlots);
  return resultSlots;
}

async function getVacationAwareUserSlots(
  typeId: number,
  brandId: string,
  taskDurationDays: number
): Promise<VacationAwareUserSlot[]> {
  console.log(`🏖️ === VACATION FILTERING FOR ${taskDurationDays}-DAY TASK ===`);
  console.log(`📋 Will EXCLUDE users with vacation conflicts instead of adjusting dates`);

  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        }
      },
      vacations: {
        where: {
          endDate: {
            gte: new Date()
          }
        }
      }
    },
  });

  const compatibleUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  );

  console.log(`👥 Found ${compatibleUsers.length} compatible users for type ${typeId}`);

  const userIds = compatibleUsers.map(user => user.id);
  
  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId,
      status: { notIn: [Status.COMPLETE] },
      assignees: { some: { userId: { in: userIds } } }
    },
    orderBy: { startDate: 'asc' }, // ✅ ORDENAR POR FECHA, NO POR queuePosition
    include: {
      tier: true,
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  // ✅ ORDENAR TAREAS POR FECHA, NO POR queuePosition
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

    if (userTasks.length > 0) {
      const lastTask = userTasks[userTasks.length - 1];
      baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      
      totalAssignedDurationDays = userTasks.reduce((sum, task) => {
        if (!task.tier) {
          console.warn(`⚠️ Task ${task.id} missing tier, using default duration`);
          return sum + (task.customDuration !== null ? task.customDuration : 1);
        }
        return sum + (task.customDuration !== null ? task.customDuration : task.tier.duration);
      }, 0);
      
      console.log(`   📊 Current workload: ${userTasks.length} tasks, ${totalAssignedDurationDays} days total`);
      console.log(`   📅 Available after current tasks: ${baseAvailableDate.toISOString().split('T')[0]}`);
    } else {
      baseAvailableDate = await getNextAvailableStart(new Date());
      console.log(`   ✅ User is currently free, available from: ${baseAvailableDate.toISOString().split('T')[0]}`);
    }

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = await calculateWorkingDeadline(baseAvailableDate, taskHours);

    console.log(`   🎯 Potential task timeline (before vacation check):`);
    console.log(`     Start: ${baseAvailableDate.toISOString().split('T')[0]}`);
    console.log(`     End: ${potentialTaskEnd.toISOString().split('T')[0]}`);
    console.log(`     Duration: ${taskDurationDays} days`);

    let hasAnyVacationConflict = false;
    let conflictDetails: string[] = [];

    for (const vacation of upcomingVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      const hasConflict = baseAvailableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        hasAnyVacationConflict = true;
        conflictDetails.push(`${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`);
        console.log(`   ❌ VACATION CONFLICT: Task (${baseAvailableDate.toISOString().split('T')[0]} to ${potentialTaskEnd.toISOString().split('T')[0]}) overlaps with vacation (${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]})`);
      }
    }

    if (hasAnyVacationConflict) {
      const matchingRoles = user.roles.filter(role => role.typeId === typeId);
      const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

      excludedUsers.push({
        name: user.name,
        reason: `Vacation conflict - ${isSpecialist ? 'Specialist' : 'Generalist'}`,
        vacations: conflictDetails
      });

      console.log(`   🚫 EXCLUDED: ${user.name} due to vacation conflicts`);
      continue;
    }

    console.log(`   ✅ ELIGIBLE: ${user.name} - no vacation conflicts detected`);

    const workingDaysUntilAvailable = calculateWorkingDaysBetween(
      new Date(),
      baseAvailableDate,
      upcomingVacations
    );

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    const vacationAwareSlot: VacationAwareUserSlot = {
      userId: user.id,
      userName: user.name,
      availableDate: baseAvailableDate,
      tasks: userTasks,
      cargaTotal: userTasks.length,
      isSpecialist,
      lastTaskDeadline: userTasks.length > 0 ? new Date(userTasks[userTasks.length - 1].deadline) : undefined,
      upcomingVacations,
      potentialTaskStart: baseAvailableDate,
      potentialTaskEnd: potentialTaskEnd,
      hasVacationConflict: false,
      workingDaysUntilAvailable,
      vacationConflictDetails: undefined,
      totalAssignedDurationDays,
    };

    console.log(`   📊 Final assessment for ${user.name}:`);
    console.log(`     🎯 Specialist: ${isSpecialist ? 'YES' : 'NO'}`);
    console.log(`     ⚖️ Duration load: ${totalAssignedDurationDays} days`);
    console.log(`     📅 Available: ${baseAvailableDate.toISOString().split('T')[0]}`);

    eligibleSlots.push(vacationAwareSlot);
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

  const sortUsers = (users: VacationAwareUserSlot[]) => {
    return users.sort((a, b) => {
      if (a.totalAssignedDurationDays !== b.totalAssignedDurationDays) {
        return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
      }
      return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
    });
  };

  const sortedSpecialists = sortUsers(specialists);
  const sortedGeneralists = sortUsers(generalists);

  const bestSpecialist = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null;
  const bestGeneralist = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null;

  if (bestSpecialist && bestGeneralist) {
    const durationDifference = bestSpecialist.totalAssignedDurationDays - bestGeneralist.totalAssignedDurationDays;

    if (durationDifference > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
      console.log(`🔧 Selecting generalist due to specialist overload (${durationDifference} days difference)`);
      console.log(`   Selected: ${bestGeneralist.userName} (${bestGeneralist.totalAssignedDurationDays} days load)`);
      return bestGeneralist;
    } else {
      console.log(`🎯 Selecting specialist with manageable load`);
      console.log(`   Selected: ${bestSpecialist.userName} (${bestSpecialist.totalAssignedDurationDays} days load)`);
      return bestSpecialist;
    }
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

export function selectBestUser(userSlots: UserSlot[]): UserSlot | null {
  const specialists = userSlots.filter(slot => slot.isSpecialist)
  const generalists = userSlots.filter(slot => !slot.isSpecialist)

  const sortUsers = (users: UserSlot[]) => {
    return users.sort((a, b) => {
      if (a.totalAssignedDurationDays !== b.totalAssignedDurationDays) return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
      return a.availableDate.getTime() - b.availableDate.getTime();
    })
  }

  const sortedSpecialists = sortUsers(specialists)
  const sortedGeneralists = sortUsers(generalists)

  const bestSpecialist: UserSlot | null = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null
  const bestGeneralist: UserSlot | null = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null

  if (!bestSpecialist) {
    return bestGeneralist;
  }
  if (!bestGeneralist) {
    return bestSpecialist;
  }

  let effectiveSpecialistDeadline: Date;
  if (bestSpecialist.tasks.length > 0 && bestSpecialist.lastTaskDeadline) {
    effectiveSpecialistDeadline = bestSpecialist.lastTaskDeadline;
  } else {
    effectiveSpecialistDeadline = bestSpecialist.availableDate;
  }

  let effectiveGeneralistDeadline: Date;
  if (bestGeneralist.tasks.length > 0 && bestGeneralist.lastTaskDeadline) {
    effectiveGeneralistDeadline = bestGeneralist.lastTaskDeadline;
  } else {
    effectiveGeneralistDeadline = bestGeneralist.availableDate;
  }

  const deadlineDifferenceDays = (effectiveSpecialistDeadline.getTime() - effectiveGeneralistDeadline.getTime()) / (1000 * 60 * 60 * 24);

  if (deadlineDifferenceDays > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
    return bestGeneralist;
  }

  return bestSpecialist;
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

// ✅ SIMPLIFICAR: Solo calcular fechas, sin position
export async function processUserAssignments(
  usersToAssign: string[],
  userSlots: UserSlot[],
  priority: Priority,
  durationDays: number,
  brandId?: string
): Promise<TaskTimingResult> {
  console.log(`\n🎯 === PROCESSING USER ASSIGNMENTS SIN queuePosition ===`);
  console.log(`📋 Usuarios a asignar: ${usersToAssign.join(', ')}`);
  console.log(`⏰ Duración de tarea: ${durationDays} días`);
  console.log(`🔥 Prioridad: ${priority}`);
  console.log(`🏢 Brand ID: ${brandId || 'all brands'}`);

  const numberOfAssignees = usersToAssign.length;
  const effectiveDuration = durationDays / numberOfAssignees;
  const newTaskHours = effectiveDuration * 8;

  let earliestStartDate = new Date();
  let latestDeadline = new Date();

  for (const userId of usersToAssign) {
    const userSlot = userSlots.find(slot => slot.userId === userId);

    if (!userSlot) {
      console.warn(`⚠️ User slot not found for ${userId}, usando fecha manual`);
      
      const manualStartDate = await getActualAvailableStartDate(userId, 1, brandId || '');
      const manualDeadline = await calculateWorkingDeadline(manualStartDate, newTaskHours);
      
      if (userId === usersToAssign[0]) {
        earliestStartDate = manualStartDate;
        latestDeadline = manualDeadline;
      }
      continue;
    }

    console.log(`\n👤 Procesando asignación para ${userSlot.userName}:`);
    console.log(`   📊 Carga actual: ${userSlot.cargaTotal} tareas`);
    console.log(`   📈 Carga de duración: ${userSlot.totalAssignedDurationDays} días`);

    // ✅ SIMPLIFICADO: Solo usar availableDate directamente
    const userStartDate = await getNextAvailableStart(userSlot.availableDate);
    const userDeadline = await calculateWorkingDeadline(userStartDate, newTaskHours);

    console.log(`   🎯 Timeline final:`);
    console.log(`     Inicio: ${userStartDate.toISOString()}`);
    console.log(`     Fin: ${userDeadline.toISOString()}`);

    if (userId === usersToAssign[0]) {
      earliestStartDate = userStartDate;
      latestDeadline = userDeadline;
      console.log(`   🥇 Usuario principal - estableciendo fechas globales`);
    } else {
      if (userStartDate > earliestStartDate) {
        earliestStartDate = userStartDate;
        console.log(`   ⬆️ Fecha de inicio más tardía encontrada, actualizando global`);
      }
      if (userDeadline > latestDeadline) {
        latestDeadline = userDeadline;
        console.log(`   ➡️ Deadline más tardío encontrado, actualizando global`);
      }
    }
  }

  console.log(`\n✅ === TIMING FINAL SIN queuePosition ===`);
  console.log(`   🚀 Inicio: ${earliestStartDate.toISOString()}`);
  console.log(`   🏁 Deadline: ${latestDeadline.toISOString()}`);
  console.log(`   🔥 Prioridad: ${priority}`);

  return {
    startDate: earliestStartDate,
    deadline: latestDeadline,
    insertAt: 1 // ✅ Ya no usamos este valor
  };
}

export async function getTaskHours(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      tier: true,
      type: true,
      assignees: {
        include: {
          user: true
        }
      }
    },
  });

  if (!task) throw new Error('Tarea no encontrada');
  if (!task.assignees.length) throw new Error('Tarea sin asignaciones');

  return task.customDuration !== null ? task.customDuration * 8 : task.tier.duration * 8;
}
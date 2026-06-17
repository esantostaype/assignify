/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/task-assignment-simplified.service.ts
// 🎯 NUEVA LÓGICA: Solo fechas, sin queuePosition

import { prisma } from '@/utils/prisma';
import { UserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';

/**
 * 🎯 FUNCIÓN PRINCIPAL: Obtener fecha de disponibilidad real del usuario
 * Considera TODAS las tareas del usuario, independiente de brand/tipo
 */
async function getUserRealAvailableDate(userId: string): Promise<Date> {
  console.log(`📅 Calculando disponibilidad REAL para usuario ${userId}`);
  
  // ✅ BUSCAR TODAS las tareas del usuario (sin filtros de brand/tipo)
  const allUserTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { deadline: 'desc' }, // Ordenar por deadline descendente
    select: {
      id: true,
      name: true,
      deadline: true,
      startDate: true,
      brandId: true,
      typeId: true
    },
    take: 1 // Solo necesitamos la última tarea
  });

  if (allUserTasks.length === 0) {
    const availableNow = await getNextAvailableStart(new Date());
    console.log(`   ✅ Usuario libre, disponible desde: ${availableNow.toISOString()}`);
    return availableNow;
  }

  const lastTask = allUserTasks[0];
  const nextAvailable = await getNextAvailableStart(lastTask.deadline);
  
  console.log(`   📊 Última tarea: "${lastTask.name}" termina ${lastTask.deadline.toISOString()}`);
  console.log(`   ✅ Próxima disponibilidad: ${nextAvailable.toISOString()}`);
  
  return nextAvailable;
}

/**
 * 🎯 FUNCIÓN SIMPLIFICADA: Calcular timing para nueva tarea
 * Sin queuePosition, solo fechas consecutivas
 */
export async function calculateSimpleTaskTiming(
  userIds: string[], 
  durationDays: number
): Promise<{ startDate: Date; deadline: Date }> {
  console.log(`\n🚀 === CÁLCULO SIMPLIFICADO DE FECHAS ===`);
  console.log(`👥 Usuarios: ${userIds.join(', ')}`);
  console.log(`⏱️ Duración: ${durationDays} días`);

  // Para múltiples usuarios, encontrar el que esté disponible más tarde
  let latestAvailableDate = new Date();

  for (const userId of userIds) {
    const userAvailableDate = await getUserRealAvailableDate(userId);
    
    if (userAvailableDate > latestAvailableDate) {
      latestAvailableDate = userAvailableDate;
      console.log(`   ⬆️ Usuario ${userId} disponible más tarde: ${userAvailableDate.toISOString()}`);
    }
  }

  // Calcular horas efectivas (dividir entre número de asignados)
  const effectiveDurationDays = durationDays / userIds.length;
  const taskHours = effectiveDurationDays * 8;

  // Calcular deadline
  const finalStartDate = latestAvailableDate;
  const finalDeadline = await calculateWorkingDeadline(finalStartDate, taskHours);

  console.log(`\n✅ === FECHAS CALCULADAS ===`);
  console.log(`🚀 Inicio: ${finalStartDate.toISOString()}`);
  console.log(`🏁 Fin: ${finalDeadline.toISOString()}`);
  console.log(`⏱️ Duración efectiva: ${effectiveDurationDays} días por persona`);

  return {
    startDate: finalStartDate,
    deadline: finalDeadline
  };
}

/**
 * 🎯 FUNCIÓN SIMPLIFICADA: Obtener usuarios compatibles con carga real
 */
export async function getCompatibleUsersWithRealLoad(
  typeId: number, 
  brandId: string
): Promise<UserSlot[]> {
  console.log(`\n👥 === OBTENIENDO USUARIOS COMPATIBLES ===`);
  console.log(`🔧 Tipo: ${typeId}, Brand: ${brandId}`);

  const compatibleUsers = await prisma.user.findMany({
    where: { 
      active: true,
      roles: {
        some: {
          typeId: typeId,
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        }
      }
    },
    include: {
      roles: {
        where: {
          typeId: typeId,
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        }
      }
    }
  });

  console.log(`   👤 Usuarios encontrados: ${compatibleUsers.length}`);

  // Calcular load real para cada usuario
  const userSlots: UserSlot[] = [];

  for (const user of compatibleUsers) {
    // Obtener TODAS las tareas pendientes del usuario
    const userTasks = await prisma.task.findMany({
      where: {
        assignees: { some: { userId: user.id } },
        status: { notIn: ['COMPLETE'] }
      },
      orderBy: { deadline: 'asc' },
      include: {
        tier: true,
        brand: true
      }
    });

    // Calcular carga total en días
    const totalDurationDays = userTasks.reduce((sum, task) => {
      return sum + (task.customDuration ?? task.tier.duration);
    }, 0);

    // Determinar si es especialista
    const isSpecialist = user.roles.length === 1 && user.roles[0].typeId === typeId;

    // Calcular disponibilidad real
    const availableDate = await getUserRealAvailableDate(user.id);

    const userSlot: UserSlot = {
      userId: user.id,
      userName: user.name,
      availableDate: availableDate,
      tasks: userTasks as any[], // Cast necesario por diferencias de tipos
      cargaTotal: userTasks.length,
      isSpecialist: isSpecialist,
      lastTaskDeadline: userTasks.length > 0 ? userTasks[userTasks.length - 1].deadline : undefined,
      totalAssignedDurationDays: totalDurationDays
    };

    console.log(`   👤 ${user.name}:`);
    console.log(`      📊 Tareas: ${userTasks.length}, Días: ${totalDurationDays}`);
    console.log(`      🎯 Especialista: ${isSpecialist ? 'Sí' : 'No'}`);
    console.log(`      📅 Disponible: ${availableDate.toISOString()}`);

    userSlots.push(userSlot);
  }

  return userSlots;
}

/**
 * 🎯 FUNCIÓN SIMPLIFICADA: Seleccionar mejor usuario basado en carga real
 */
export function selectBestUserSimple(userSlots: UserSlot[]): UserSlot | null {
  if (userSlots.length === 0) return null;

  console.log(`\n🏆 === SELECCIÓN DE MEJOR USUARIO ===`);

  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  console.log(`   🎯 Especialistas: ${specialists.length}`);
  console.log(`   🔧 Generalistas: ${generalists.length}`);

  // Ordenar por carga de duración (no por cantidad de tareas)
  const sortUsers = (users: UserSlot[]) => {
    return users.sort((a, b) => {
      // Prioridad 1: Menor carga de duración
      if (a.totalAssignedDurationDays !== b.totalAssignedDurationDays) {
        return a.totalAssignedDurationDays - b.totalAssignedDurationDays;
      }
      // Prioridad 2: Disponible más pronto
      return a.availableDate.getTime() - b.availableDate.getTime();
    });
  };

  const sortedSpecialists = sortUsers(specialists);
  const sortedGeneralists = sortUsers(generalists);

  // Preferir especialistas a menos que tengan sobrecarga significativa
  const bestSpecialist = sortedSpecialists[0];
  const bestGeneralist = sortedGeneralists[0];

  if (bestSpecialist && bestGeneralist) {
    const durationDifference = bestSpecialist.totalAssignedDurationDays - bestGeneralist.totalAssignedDurationDays;
    
    if (durationDifference > 7) { // 7 días de diferencia = preferir generalista
      console.log(`   🔧 Seleccionando generalista por menor carga (${durationDifference} días diferencia)`);
      return bestGeneralist;
    } else {
      console.log(`   🎯 Seleccionando especialista con carga manejable`);
      return bestSpecialist;
    }
  }

  const selected = bestSpecialist || bestGeneralist;
  console.log(`   ✅ Seleccionado: ${selected?.userName} (${selected?.isSpecialist ? 'Especialista' : 'Generalista'})`);
  
  return selected;
}

/**
 * 🎯 FUNCIÓN PRINCIPAL: API simplificada para obtener sugerencia
 */
export async function getSimpleTaskSuggestion(
  typeId: number,
  brandId: string,
  durationDays: number
): Promise<{
  suggestedUserId: string;
  estimatedStartDate: Date;
  estimatedDeadline: Date;
  userInfo: {
    name: string;
    isSpecialist: boolean;
    currentLoad: number;
    currentDurationLoad: number;
    availableFrom: Date;
  };
} | null> {
  
  console.log(`\n🎯 === SUGERENCIA SIMPLE ===`);
  console.log(`🔧 Tipo: ${typeId}, Brand: ${brandId}, Duración: ${durationDays} días`);

  // Obtener usuarios con carga real
  const userSlots = await getCompatibleUsersWithRealLoad(typeId, brandId);
  
  if (userSlots.length === 0) {
    console.log(`❌ No hay usuarios compatibles`);
    return null;
  }

  // Seleccionar mejor usuario
  const bestUser = selectBestUserSimple(userSlots);
  
  if (!bestUser) {
    console.log(`❌ No se pudo seleccionar usuario`);
    return null;
  }

  // Calcular fechas para este usuario específico
  const timing = await calculateSimpleTaskTiming([bestUser.userId], durationDays);

  console.log(`\n✅ === SUGERENCIA FINAL ===`);
  console.log(`👤 Usuario: ${bestUser.userName}`);
  console.log(`📅 Inicio: ${timing.startDate.toISOString()}`);
  console.log(`🏁 Fin: ${timing.deadline.toISOString()}`);

  return {
    suggestedUserId: bestUser.userId,
    estimatedStartDate: timing.startDate,
    estimatedDeadline: timing.deadline,
    userInfo: {
      name: bestUser.userName,
      isSpecialist: bestUser.isSpecialist,
      currentLoad: bestUser.cargaTotal,
      currentDurationLoad: bestUser.totalAssignedDurationDays,
      availableFrom: bestUser.availableDate
    }
  };
}
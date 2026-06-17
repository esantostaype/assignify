/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Status } from '@/db/enums';
import { getAppSettings } from '@/services/app-settings.service';
import usHolidays from '@/data/usHolidays.json';

/**
 * Estados que "ocupan" realmente a un diseñador (carga y disponibilidad).
 * - TO_DO / IN_PROGRESS → trabajo pendiente: ocupa su tiempo.
 * - ON_APPROVAL → ya entregado, esperando revisión del cliente/manager: el
 *   diseñador YA puede tomar trabajo nuevo, así que NO cuenta como carga ni
 *   empuja su fecha de disponibilidad.
 * - COMPLETE → terminado.
 * Usar este set evita que tareas "en aprobación" con deadlines lejanos
 * (p. ej. una que lleva meses esperando aprobación) bloqueen asignaciones.
 */
export const OCCUPYING_STATUSES: Status[] = [Status.TO_DO, Status.IN_PROGRESS];

// Set de festivos (YYYY-MM-DD en UTC) para lookup O(1).
const HOLIDAY_SET = new Set((usHolidays as Array<{ date: string }>).map((h) => h.date));

/** ¿La fecha (en UTC) cae en un día festivo? */
function isHoliday(date: Date): boolean {
  return HOLIDAY_SET.has(date.toISOString().split('T')[0]);
}

/** ¿La fecha (en UTC) es fin de semana o festivo (día no laborable)? */
export function isNonWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6 || isHoliday(date);
}

/**
 * ✅ CONSERVADOR: Redondea una fecha a la siguiente media hora
 */
export function roundUpToNextHalfHour(date: Date): Date {
  const result = new Date(date);
  const minutes = result.getMinutes();

  if (minutes === 0 || minutes === 30) return result;

  if (minutes < 30) {
    result.setMinutes(30, 0, 0);
  } else {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  }

  return result;
}

/**
 * ✅ CONSERVADOR: Calcula la próxima fecha y hora de inicio disponible
 */
export async function getNextAvailableStart(date: Date): Promise<Date> {
  const result = new Date(date);
  const WH = (await getAppSettings()).workHours; // Horario laboral en UTC

  while (true) {
    const hour = result.getUTCHours(); // Hora UTC

    // Saltar fines de semana y días festivos
    if (isNonWorkingDay(result)) {
      result.setUTCDate(result.getUTCDate() + 1);
      result.setUTCHours(WH.START, 0, 0, 0);
      continue;
    }

    // Ajustar a horario laboral si está fuera de él
    if (hour < WH.START) {
      result.setUTCHours(WH.START, 0, 0, 0);
    } else if (hour >= WH.LUNCH_START && hour < WH.LUNCH_END) {
      result.setUTCHours(WH.LUNCH_END, 0, 0, 0);
    } else if (hour >= WH.END) {
      result.setUTCDate(result.getUTCDate() + 1);
      result.setUTCHours(WH.START, 0, 0, 0);
      continue;
    }

    return roundUpToNextHalfHour(result);
  }
}

/**
 * ✅ CONSERVADOR: Calcula la fecha límite considerando horas laborales
 */
export async function calculateWorkingDeadline(start: Date, hoursNeeded: number): Promise<Date> {
  let remaining = hoursNeeded;
  let current = new Date(start);

  const WH = (await getAppSettings()).workHours; // Horario laboral en UTC

  const workBlocks = [
    { from: WH.START, to: WH.LUNCH_START },
    { from: WH.LUNCH_END, to: WH.END },
  ];

  while (remaining > 0) {
    // Saltar fines de semana y días festivos
    if (isNonWorkingDay(current)) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(WH.START, 0, 0, 0);
      continue;
    }

    let timeUsedToday = 0;
    let processedAnyBlock = false;

    const originalCurrentDay = current.getUTCDate();

    for (const block of workBlocks) {
      const blockStart = new Date(current);
      blockStart.setUTCHours(block.from, 0, 0, 0);

      const blockEnd = new Date(current);
      blockEnd.setUTCHours(block.to, 0, 0, 0);

      if (current < blockStart) {
        current = new Date(blockStart);
      }

      if (current >= blockEnd) {
        continue;
      }

      processedAnyBlock = true;

      const availableInBlock = (blockEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
      const timeToUse = Math.min(availableInBlock, remaining);

      current = new Date(current.getTime() + timeToUse * 60 * 60 * 1000);
      remaining -= timeToUse;
      timeUsedToday += timeToUse;

      if (remaining <= 0) break;
    }

    if (remaining <= 0) {
      break;
    }

    const crossedIntoNextDay = current.getUTCDate() !== originalCurrentDay;

    if (remaining > 0 && (crossedIntoNextDay || !processedAnyBlock || timeUsedToday === 0)) {
      if (!crossedIntoNextDay) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
      current.setUTCHours(WH.START, 0, 0, 0);
    }
  }

  return current;
}
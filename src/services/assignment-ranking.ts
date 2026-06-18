// src/services/assignment-ranking.ts
// NÚCLEO DE DECISIÓN del motor "¿QUIÉN?", PURO y sin IO (no toca DB, ClickUp ni
// settings). Recibe los slots ya calculados + los umbrales y decide a quién elegir.
// Vive aparte de task-assignment.service.ts para poder testearlo sin mocks: toda la
// lógica sutil (carril/congestión, escalado de nivel y de cargo, especialista vs
// generalista) se ejercita con fixtures sintéticas.
import { Level, Priority } from '@/db/enums';
import { VacationAwareUserSlot } from '@/interfaces';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Rango numérico de cada nivel: JUNIOR < MID < SENIOR. En automático solo se asigna
// a niveles >= al pedido.
export const LEVEL_RANK: Record<Level, number> = { JUNIOR: 1, MID: 2, SENIOR: 3 };

// Orden de escalado de nivel, de menor a mayor.
export const LEVELS_ASCENDING: Level[] = [Level.JUNIOR, Level.MID, Level.SENIOR];

// Rango de prioridad: mayor número = más prioritaria (mismo criterio que el motor de fechas).
export const PRIORITY_RANK: Record<Priority, number> = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 };

// Grupos de afinidad de cargo, de mayor preferencia a menor: 1 primario → 2 secundario → 3 otro.
export const ROLE_AFFINITY_ASCENDING: Array<1 | 2 | 3> = [1, 2, 3];

/**
 * Orden de preferencia entre candidatos:
 *   1. Quien se libera ANTES, si la diferencia es mayor que `closeWindowDays`.
 *   2. Si se liberan en fechas PARECIDAS (dentro de la ventana), gana quien tenga
 *      MENOS congestión de prioridad (menos tareas de prioridad ≥ la pedida) —
 *      así no se apilan urgentes en el mismo diseñador aunque sea especialista.
 *   3. Desempates: menos carga total y, por último, la fecha exacta.
 * `closeWindowDays` reutiliza el umbral que ya separa especialista/generalista.
 */
export function compareSlots(
  a: VacationAwareUserSlot,
  b: VacationAwareUserSlot,
  closeWindowDays: number
): number {
  const dateDiffMs = a.availableDate.getTime() - b.availableDate.getTime();
  if (Math.abs(dateDiffMs) / MS_PER_DAY > closeWindowDays) return dateDiffMs;

  const congestionDiff =
    (a.samePriorityOrHigherLoad ?? 0) - (b.samePriorityOrHigherLoad ?? 0);
  if (congestionDiff !== 0) return congestionDiff;

  const loadDiff = a.totalAssignedDurationDays - b.totalAssignedDurationDays;
  if (loadDiff !== 0) return loadDiff;

  return dateDiffMs;
}

// Disponible antes primero (fecha ya ajustada por cola + vacaciones + festivos);
// entre quienes se liberan en fechas parecidas, el de menor congestión de prioridad.
export function sortByAvailability(
  users: VacationAwareUserSlot[],
  closeWindowDays: number
): VacationAwareUserSlot[] {
  return [...users].sort((a, b) => compareSlots(a, b, closeWindowDays));
}

/**
 * Mejor candidato DENTRO de un mismo nivel. La regla de niveles manda; la de
 * especialista/generalista queda como DESEMPATE dentro del nivel: si el mejor
 * especialista se libera mucho más tarde que el mejor generalista
 * (umbral DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST), se prefiere el generalista.
 * En caso normal gana simplemente el de antes-disponible / menos-carga.
 */
export function pickBestInLevel(
  slots: VacationAwareUserSlot[],
  forceGeneralistThresholdDays: number
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const sorted = sortByAvailability(slots, forceGeneralistThresholdDays);
  const bestOverall = sorted[0];

  const bestSpecialist = sorted.find((s) => s.isSpecialist) ?? null;
  const bestGeneralist = sorted.find((s) => !s.isSpecialist) ?? null;

  // Desempate especialista/generalista solo si el mejor del nivel es especialista
  // y existe un generalista que se libera bastante antes.
  if (bestSpecialist && bestGeneralist && bestOverall.isSpecialist) {
    const daysLater =
      (bestSpecialist.availableDate.getTime() - bestGeneralist.availableDate.getTime()) / MS_PER_DAY;
    if (daysLater > forceGeneralistThresholdDays) {
      return bestGeneralist;
    }
  }

  return bestOverall;
}

/**
 * Mejor candidato de un conjunto de slots aplicando el ESCALADO POR NIVEL.
 * - Solo se consideran candidatos de nivel >= reqLevel (nunca uno inferior en automático).
 * - Se toma el mejor candidato de cada nivel (antes-disponible / menos-carga, con el
 *   desempate especialista/generalista interno).
 * - Se empieza por reqLevel y se compara contra el nivel inmediatamente superior:
 *   si el mejor del nivel actual se libera MÁS de `levelEscalationDays` días DESPUÉS
 *   que el mejor del nivel superior, se escala al superior. Se repite hacia SENIOR.
 */
export function pickBestByLevelEscalation(
  slots: VacationAwareUserSlot[],
  reqLevel: Level,
  levelEscalationDays: number,
  forceGeneralistThreshold: number
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const reqRank = LEVEL_RANK[reqLevel];
  const candidateLevels = LEVELS_ASCENDING.filter((lvl) => LEVEL_RANK[lvl] >= reqRank);

  const bestByLevel: Partial<Record<Level, VacationAwareUserSlot>> = {};
  for (const lvl of candidateLevels) {
    const slotsOfLevel = slots.filter((s) => s.level === lvl);
    const best = pickBestInLevel(slotsOfLevel, forceGeneralistThreshold);
    if (best) bestByLevel[lvl] = best;
  }

  let chosen: VacationAwareUserSlot | null = null;
  for (const lvl of candidateLevels) {
    const current = bestByLevel[lvl];
    if (!current) continue;
    if (!chosen) {
      chosen = current;
      continue;
    }
    const daysLater = (chosen.availableDate.getTime() - current.availableDate.getTime()) / MS_PER_DAY;
    if (daysLater > levelEscalationDays) chosen = current;
  }

  return chosen;
}

/**
 * Selección con DOBLE ESCALADO: CARGO por encima de NIVEL (núcleo PURO).
 *
 * - Los slots se agrupan por `roleAffinity` (1 primario → 2 secundario → 3 otro cargo).
 *   Dentro de cada grupo se resuelve el nivel con `pickBestByLevelEscalation`.
 * - ESCALADO entre cargos: si el mejor del grupo actual se libera MÁS de
 *   `forceGeneralistThreshold` días DESPUÉS que el del siguiente grupo (affinity
 *   superior), se considera también ese grupo (1→2→3). Mismo umbral que separa
 *   especialista de generalista: "ve a otros cargos cuando los preferidos están saturados".
 *
 * El override MANUAL (asignar a mano) no pasa por aquí.
 */
export function pickBestAcrossAffinity(
  userSlots: VacationAwareUserSlot[],
  reqLevel: Level,
  levelEscalationDays: number,
  forceGeneralistThreshold: number
): VacationAwareUserSlot | null {
  if (userSlots.length === 0) return null;

  // Mejor candidato por grupo de afinidad de cargo. Los slots sin `roleAffinity`
  // (datos antiguos) se tratan como afinidad 3 (fallback).
  const bestByAffinity: Partial<Record<1 | 2 | 3, VacationAwareUserSlot>> = {};
  for (const affinity of ROLE_AFFINITY_ASCENDING) {
    const slotsOfAffinity = userSlots.filter((s) => (s.roleAffinity ?? 3) === affinity);
    if (slotsOfAffinity.length === 0) continue;
    const best = pickBestByLevelEscalation(
      slotsOfAffinity,
      reqLevel,
      levelEscalationDays,
      forceGeneralistThreshold
    );
    if (best) bestByAffinity[affinity] = best;
  }

  let chosen: VacationAwareUserSlot | null = null;
  for (const affinity of ROLE_AFFINITY_ASCENDING) {
    const current = bestByAffinity[affinity];
    if (!current) continue;
    if (!chosen) {
      chosen = current;
      continue;
    }
    const daysLater = (chosen.availableDate.getTime() - current.availableDate.getTime()) / MS_PER_DAY;
    if (daysLater > forceGeneralistThreshold) chosen = current;
  }

  return chosen;
}

// src/services/assignment-ranking.ts
// NÚCLEO DE DECISIÓN del motor "¿QUIÉN?", PURO y sin IO (no toca DB, ClickUp ni
// settings). Recibe los slots ya calculados + los umbrales y decide a quién elegir.
// Vive aparte de task-assignment.service.ts para poder testearlo sin mocks: toda la
// lógica sutil (fecha de liberación, escalado de nivel y de cargo, especialista vs
// generalista) se ejercita con fixtures sintéticas.
//
// CRITERIO PRINCIPAL: entre candidatos comparables (mismo cargo y nivel) manda la
// FECHA/HORA DE LIBERACIÓN — quien se libera antes gana (con cualquier diferencia,
// aunque sea de horas), porque puede empezar y terminar la tarea nueva antes. El
// tamaño de la cola (cuántas tareas o cuántos días arrastra) NO se mira directamente:
// ya está reflejado en esa fecha. Solo cuando dos se liberan EXACTAMENTE a la vez se
// desempata por carga.
//
// Refinamientos sobre el review del motor:
//   #1 El desempate del mismo día mide la carga en DÍAS de trabajo, no en nº de tareas.
//   #2 Tope blando de carga (overloadSoftCapDays): empuja la fecha efectiva de quien
//      arrastra una cola grande, para no sobreasignarle. 0 = desactivado.
//   #3 Escalados de NIVEL y de CARGO con umbral propio (levelEscalationDays /
//      crossRoleEscalationDays) en vez de un único umbral compartido.
//   #4 Equidad: a igualdad de día, decide la MENOR carga acumulada y, en último
//      término, un id estable (reparte y es reproducible).
//   #5 `isSpecialist` se deriva de los cargos del miembro (en el service).
//   #6 Desempate final DETERMINISTA por id (no el orden de llegada al array).
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
 * Umbrales del núcleo de decisión. Cada escalado (nivel y cargo) tiene su propio
 * umbral para poder afinarlos por separado; `forceGeneralistDays` resuelve el
 * desempate especialista/generalista dentro de un nivel.
 */
export interface RankingConfig {
  /** Umbral (días) para preferir generalista sobre especialista dentro de un nivel. */
  forceGeneralistDays: number;
  /** Umbral (días) para escalar al NIVEL superior. */
  levelEscalationDays: number;
  /** Umbral (días) para escalar a otro CARGO/afinidad. */
  crossRoleEscalationDays: number;
  /** Tope blando de carga total (días); 0 = desactivado. */
  overloadSoftCapDays: number;
}

/**
 * Fecha de liberación EFECTIVA para comparar candidatos. Con el tope blando de
 * carga activo (overloadSoftCapDays > 0), a quien ya supera ese tope de trabajo
 * total pendiente se le empuja la fecha hacia adelante en proporción al exceso.
 * Así dejamos de apilar tareas en quien arrastra una cola enorme. Con 0, no hay
 * penalización y la fecha efectiva es la real (comportamiento por defecto).
 */
function effectiveAvailableMs(s: VacationAwareUserSlot, cfg: RankingConfig): number {
  const base = s.availableDate.getTime();
  if (cfg.overloadSoftCapDays <= 0) return base;
  const excess = s.totalAssignedDurationDays - cfg.overloadSoftCapDays;
  return excess > 0 ? base + excess * MS_PER_DAY : base;
}

/**
 * Orden de preferencia entre candidatos:
 *   1. DÍA de liberación (fecha efectiva): quien se libera antes gana. Es el criterio
 *      dominante — determina cuándo arranca y termina la tarea nueva. La cola del
 *      candidato ya está reflejada aquí, así que NO se cuenta aparte.
 *   2. Solo si se liberan el MISMO día se desempata: menor congestión de prioridad
 *      (en días de trabajo) → menor carga total → id estable (nunca el orden de
 *      llegada al array, que era arbitrario).
 */
export function compareSlots(
  a: VacationAwareUserSlot,
  b: VacationAwareUserSlot,
  cfg: RankingConfig
): number {
  const aMs = effectiveAvailableMs(a, cfg);
  const bMs = effectiveAvailableMs(b, cfg);

  // 1. Fecha/hora de liberación: quien se libera ANTES gana, con CUALQUIER diferencia
  //    (aunque sea de horas / medio día). Es el criterio dominante; el tamaño de la
  //    cola no compite con la fecha.
  if (aMs !== bMs) return aMs - bMs;

  // 2. Se liberan EXACTAMENTE a la vez → desempate por carga (congestión de prioridad
  //    en días → carga total) y, por último, id estable (no el orden de llegada).
  const congestionDiff =
    (a.samePriorityOrHigherLoadDays ?? 0) - (b.samePriorityOrHigherLoadDays ?? 0);
  if (congestionDiff !== 0) return congestionDiff;

  const loadDiff = a.totalAssignedDurationDays - b.totalAssignedDurationDays;
  if (loadDiff !== 0) return loadDiff;

  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

// Disponible antes primero (fecha ya ajustada por cola + vacaciones + festivos);
// entre quienes se liberan el mismo día, el de menor carga.
export function sortByAvailability(
  users: VacationAwareUserSlot[],
  cfg: RankingConfig
): VacationAwareUserSlot[] {
  return [...users].sort((a, b) => compareSlots(a, b, cfg));
}

/**
 * Mejor candidato DENTRO de un mismo nivel. Manda la fecha de liberación; la regla
 * especialista/generalista queda como matiz: si el mejor del nivel es especialista
 * y existe un generalista que se libera MÁS de `forceGeneralistDays` días antes, se
 * prefiere el generalista (reservar al especialista). En el caso normal gana el de
 * antes-disponible.
 */
export function pickBestInLevel(
  slots: VacationAwareUserSlot[],
  cfg: RankingConfig
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const sorted = sortByAvailability(slots, cfg);
  const bestOverall = sorted[0];

  const bestSpecialist = sorted.find((s) => s.isSpecialist) ?? null;
  const bestGeneralist = sorted.find((s) => !s.isSpecialist) ?? null;

  if (bestSpecialist && bestGeneralist && bestOverall.isSpecialist) {
    const daysEarlier =
      (bestSpecialist.availableDate.getTime() - bestGeneralist.availableDate.getTime()) / MS_PER_DAY;
    if (daysEarlier > cfg.forceGeneralistDays) {
      return bestGeneralist;
    }
  }

  return bestOverall;
}

/**
 * Mejor candidato de un conjunto de slots aplicando el ESCALADO POR NIVEL.
 * - Solo se consideran candidatos de nivel >= reqLevel (nunca uno inferior en automático).
 * - Se toma el mejor candidato de cada nivel (antes-disponible, con el desempate
 *   especialista/generalista interno).
 * - Se empieza por reqLevel y se compara contra el nivel inmediatamente superior:
 *   si el mejor del nivel actual se libera MÁS de `levelEscalationDays` días DESPUÉS
 *   que el mejor del nivel superior, se escala al superior. Se repite hacia SENIOR.
 */
export function pickBestByLevelEscalation(
  slots: VacationAwareUserSlot[],
  reqLevel: Level,
  cfg: RankingConfig
): VacationAwareUserSlot | null {
  if (slots.length === 0) return null;

  const reqRank = LEVEL_RANK[reqLevel];
  const candidateLevels = LEVELS_ASCENDING.filter((lvl) => LEVEL_RANK[lvl] >= reqRank);

  const bestByLevel: Partial<Record<Level, VacationAwareUserSlot>> = {};
  for (const lvl of candidateLevels) {
    const slotsOfLevel = slots.filter((s) => s.level === lvl);
    const best = pickBestInLevel(slotsOfLevel, cfg);
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
    if (daysLater > cfg.levelEscalationDays) chosen = current;
  }

  return chosen;
}

/**
 * Selección con DOBLE ESCALADO: CARGO por encima de NIVEL (núcleo PURO).
 *
 * - Los slots se agrupan por `roleAffinity` (1 primario → 2 secundario → 3 otro cargo).
 *   Dentro de cada grupo se resuelve el nivel con `pickBestByLevelEscalation`.
 * - ESCALADO entre cargos: si el mejor del grupo actual se libera MÁS de
 *   `crossRoleEscalationDays` días DESPUÉS que el del siguiente grupo (affinity
 *   superior), se considera también ese grupo (1→2→3): "ve a otros cargos cuando
 *   los preferidos están saturados".
 *
 * El override MANUAL (asignar a mano) no pasa por aquí.
 */
export function pickBestAcrossAffinity(
  userSlots: VacationAwareUserSlot[],
  reqLevel: Level,
  cfg: RankingConfig
): VacationAwareUserSlot | null {
  if (userSlots.length === 0) return null;

  // Mejor candidato por grupo de afinidad de cargo. Los slots sin `roleAffinity`
  // (datos antiguos) se tratan como afinidad 3 (fallback).
  const bestByAffinity: Partial<Record<1 | 2 | 3, VacationAwareUserSlot>> = {};
  for (const affinity of ROLE_AFFINITY_ASCENDING) {
    const slotsOfAffinity = userSlots.filter((s) => (s.roleAffinity ?? 3) === affinity);
    if (slotsOfAffinity.length === 0) continue;
    const best = pickBestByLevelEscalation(slotsOfAffinity, reqLevel, cfg);
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
    if (daysLater > cfg.crossRoleEscalationDays) chosen = current;
  }

  return chosen;
}

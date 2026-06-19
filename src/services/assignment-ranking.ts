// src/services/assignment-ranking.ts
// NÚCLEO DE DECISIÓN del motor "¿QUIÉN?", PURO y sin IO (no toca DB, ClickUp ni
// settings). Recibe los slots ya calculados + los umbrales y decide a quién elegir.
// Vive aparte de task-assignment.service.ts para poder testearlo sin mocks: toda la
// lógica sutil (carril/congestión, escalado de nivel y de cargo, especialista vs
// generalista) se ejercita con fixtures sintéticas.
//
// Refinamientos sobre el review del motor:
//   #1 Congestión medida en DÍAS de trabajo del carril (no nº de tareas).
//   #2 Tope blando de carga (overloadSoftCapDays): empuja la fecha efectiva de
//      quien arrastra una cola grande de trabajo de menor prioridad, que el
//      carril por sí solo ignora → menos sobreasignación.
//   #3 Tres escalados con umbral PROPIO (closeWindow / forceGeneralist /
//      crossRole) en vez de un único forceGeneralistThreshold compartido.
//   #4 Equidad: a igualdad de fecha/congestión, decide la MENOR carga acumulada
//      (reparte hacia el menos cargado) y, en último término, un id estable.
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
 * Umbrales del núcleo de decisión, ya SEPARADOS. Antes un único
 * `forceGeneralistThreshold` gobernaba los tres escalados (fechas parejas,
 * especialista/generalista y cargo); separarlos permite afinar cada uno sin
 * mover los otros. Poner el mismo valor en los tres reproduce el comportamiento
 * del umbral único.
 */
export interface RankingConfig {
  /** Ventana (días) para considerar dos fechas de liberación "parejas". */
  closeWindowDays: number;
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
 * Así dejamos de apilar tareas en quien arrastra una cola enorme de trabajo de
 * MENOR prioridad (que el carril ignora). Con 0, no hay penalización y la fecha
 * efectiva es la real (comportamiento previo).
 */
function effectiveAvailableMs(s: VacationAwareUserSlot, cfg: RankingConfig): number {
  const base = s.availableDate.getTime();
  if (cfg.overloadSoftCapDays <= 0) return base;
  const excess = s.totalAssignedDurationDays - cfg.overloadSoftCapDays;
  return excess > 0 ? base + excess * MS_PER_DAY : base;
}

/**
 * Orden de preferencia entre candidatos:
 *   1. Quien se libera ANTES (fecha EFECTIVA, ya penalizada por sobrecarga), si la
 *      diferencia supera `closeWindowDays`.
 *   2. Si se liberan en fechas PARECIDAS, gana quien tenga MENOS congestión de
 *      prioridad medida en DÍAS de trabajo (no en nº de tareas) — así no se apilan
 *      urgentes en el mismo diseñador aunque sea especialista.
 *   3. Desempates (equidad): menor carga total acumulada → fecha real → id estable
 *      (nunca el orden de llegada al array, que era arbitrario).
 */
export function compareSlots(
  a: VacationAwareUserSlot,
  b: VacationAwareUserSlot,
  cfg: RankingConfig
): number {
  const effDiff = effectiveAvailableMs(a, cfg) - effectiveAvailableMs(b, cfg);
  if (Math.abs(effDiff) / MS_PER_DAY > cfg.closeWindowDays) return effDiff;

  const congestionDiff =
    (a.samePriorityOrHigherLoadDays ?? 0) - (b.samePriorityOrHigherLoadDays ?? 0);
  if (congestionDiff !== 0) return congestionDiff;

  const loadDiff = a.totalAssignedDurationDays - b.totalAssignedDurationDays;
  if (loadDiff !== 0) return loadDiff;

  const realDiff = a.availableDate.getTime() - b.availableDate.getTime();
  if (realDiff !== 0) return realDiff;

  // Desempate final DETERMINISTA por id (estable y reproducible) en vez de
  // depender del orden de entrada al array.
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

// Disponible antes primero (fecha ya ajustada por cola + vacaciones + festivos);
// entre quienes se liberan en fechas parecidas, el de menor congestión de prioridad.
export function sortByAvailability(
  users: VacationAwareUserSlot[],
  cfg: RankingConfig
): VacationAwareUserSlot[] {
  return [...users].sort((a, b) => compareSlots(a, b, cfg));
}

/**
 * Mejor candidato DENTRO de un mismo nivel. La regla de niveles manda; la de
 * especialista/generalista queda como DESEMPATE dentro del nivel: si el mejor
 * especialista se libera mucho más tarde que el mejor generalista
 * (umbral `forceGeneralistDays`), se prefiere el generalista. En caso normal gana
 * simplemente el de antes-disponible / menos-carga.
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

  // Desempate especialista/generalista solo si el mejor del nivel es especialista
  // y existe un generalista que se libera bastante antes.
  if (bestSpecialist && bestGeneralist && bestOverall.isSpecialist) {
    const daysLater =
      (bestSpecialist.availableDate.getTime() - bestGeneralist.availableDate.getTime()) / MS_PER_DAY;
    if (daysLater > cfg.forceGeneralistDays) {
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

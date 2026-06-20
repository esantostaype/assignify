// src/services/low-cascade.ts
// NÚCLEO PURO (sin IO) del "empuje en cascada" de tareas LOW. Vive aparte —como
// assignment-ranking.ts— para testearlo sin mocks: toda la lógica sutil (qué Low se
// puede mover y cómo se re-secuencian) se ejercita con fixtures deterministas.
//
// REGLA DE NEGOCIO: cuando se crea una tarea de prioridad MAYOR que LOW, las tareas
// LOW "movibles" del diseñador se recolocan DESPUÉS de la tarea nueva, en cascada (una
// tras otra). Una LOW es movible SOLO el día en que se creó y mientras falte margen
// antes del cierre del día laboral; pasada esa ventana, su deadline ya se considera
// comunicado al solicitante y NO se mueve (para no estar avisándole cambios de fecha).
import type { LocalTaskStatus } from '@/utils/clickup-status-mapping-utils'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_HOUR = 1000 * 60 * 60

/** Una LOW candidata a moverse (datos mínimos para la cascada). */
export interface MovableLow {
  taskId: string
  ownerUserId: string
  /** Inicio actual: para ordenar la cascada y para "empujar, no adelantar". */
  currentStart: Date
  /** Fin actual: si la Low no se mueve, el cursor de la cascada salta a esta fecha. */
  currentDue: Date
  /** Duración real en días (de task_meta). */
  durationDays: number
}

/**
 * Resuelve el primer hueco laboral válido para `ownerUserId` a partir de `fromDate`,
 * devolviendo {start, due} ya saltando horario, festivos y vacaciones del dueño. Lo
 * inyecta la capa IO (con getNextAvailableStart + calculateWorkingDeadline + lógica de
 * vacaciones); en los tests se pasa un resolver determinista.
 */
export type SlotResolver = (
  fromDate: Date,
  ownerUserId: string,
  durationDays: number
) => Promise<{ start: Date; due: Date }>

/** Una reprogramación concreta a aplicar en ClickUp. */
export interface CascadeMove {
  taskId: string
  ownerUserId: string
  newStart: Date
  newDue: Date
}

export interface MovableLowCheck {
  status: LocalTaskStatus
  /** task_meta.createdAt en epoch ms; null si la tarea NO la creó Assignify. */
  createdAtMs: number | null
  /** Ahora, epoch ms. */
  nowMs: number
  /** Hora de cierre del día laboral en UTC (de getAppSettings; puede ser 24). */
  workHoursEndUtc: number
  /** Offset del workspace en horas (Perú = -5); para anclar el "día local". */
  utcOffsetHours: number
  /** Margen antes del cierre dentro del cual la Low YA NO se mueve (horas). Def 1. */
  closeBufferHours?: number
}

/**
 * ¿Esta LOW se puede mover por una tarea nueva de mayor prioridad? Solo si:
 *   (a) está en TO_DO (no empezada ni entregada),
 *   (b) la creó Assignify HOY (mismo día LOCAL del workspace), y
 *   (c) falta MÁS de `closeBufferHours` para el cierre del día laboral.
 * Si no, su deadline ya se considera comunicado y queda FIJA.
 *
 * Todo se computa en HORA LOCAL (nowMs + offset) para que el cruce de la medianoche
 * UTC —el día laboral de Inszone cierra a las 24 UTC = 19:00 local— no descuadre ni el
 * "mismo día" ni la "última hora".
 */
export function isMovableLow({
  status,
  createdAtMs,
  nowMs,
  workHoursEndUtc,
  utcOffsetHours,
  closeBufferHours = 1,
}: MovableLowCheck): boolean {
  if (status !== 'TO_DO') return false
  if (createdAtMs == null) return false

  const offsetMs = utcOffsetHours * MS_PER_HOUR
  const nowLocalMs = nowMs + offsetMs
  const createdLocalMs = createdAtMs + offsetMs

  // (b) Creada hoy, en el mismo día LOCAL del workspace.
  const nowLocalDay = Math.floor(nowLocalMs / MS_PER_DAY)
  if (Math.floor(createdLocalMs / MS_PER_DAY) !== nowLocalDay) return false

  // (c) Falta más de `closeBufferHours` para el cierre del día laboral (hora local).
  // Cierre local = END en hora local (END_utc + offset; p.ej. 24 + (-5) = 19:00 local).
  const localDayStartMs = nowLocalDay * MS_PER_DAY
  const endLocalHour = workHoursEndUtc + utcOffsetHours
  const closeLocalMs = localDayStartMs + endLocalHour * MS_PER_HOUR
  return nowLocalMs <= closeLocalMs - closeBufferHours * MS_PER_HOUR
}

/**
 * Recoloca las LOW en CASCADA después de `afterDate` (el deadline de la tarea nueva en
 * ese diseñador). Ordena por inicio actual y encadena: cada Low va a max(su inicio,
 * cursor) resolviendo el hueco real; el cursor avanza al fin resultante.
 *
 * "Empujar, no adelantar": una Low que YA empieza en/después del cursor no se mueve (se
 * respeta su fecha) y solo corre el cursor a su fin actual. Devuelve SOLO las Low que
 * cambian de fecha (las demás se quedan como están).
 */
export async function computeLowCascade(
  lows: MovableLow[],
  afterDate: Date,
  resolveSlot: SlotResolver
): Promise<CascadeMove[]> {
  const ordered = [...lows].sort(
    (a, b) =>
      a.currentStart.getTime() - b.currentStart.getTime() ||
      (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0)
  )

  const moves: CascadeMove[] = []
  let cursorMs = afterDate.getTime()

  for (const low of ordered) {
    if (low.currentStart.getTime() >= cursorMs) {
      // Ya está después de lo que va delante: no se mueve; el cursor salta a su fin.
      cursorMs = low.currentDue.getTime()
      continue
    }
    const { start, due } = await resolveSlot(new Date(cursorMs), low.ownerUserId, low.durationDays)
    moves.push({ taskId: low.taskId, ownerUserId: low.ownerUserId, newStart: start, newDue: due })
    cursorMs = due.getTime()
  }

  return moves
}

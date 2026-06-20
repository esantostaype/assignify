import { describe, it, expect } from 'vitest'
import {
  isMovableLow,
  computeLowCascade,
  type MovableLow,
  type SlotResolver,
} from './low-cascade'

// ── isMovableLow ─────────────────────────────────────────────────────────────
// Valores de Inszone: cierre END = 24 UTC, huso -5 (Perú) → cierre 19:00 local.
const END_UTC = 24
const OFFSET = -5
// "Hoy" = 18 jun. now 20:00 UTC = 15:00 local (día laboral, lejos del cierre).
const utc = (h: number, m = 0, day = 18) => Date.UTC(2026, 5, day, h, m, 0)

const baseCheck = {
  status: 'TO_DO' as const,
  createdAtMs: utc(18), // creada hoy 13:00 local
  nowMs: utc(20), // 15:00 local
  workHoursEndUtc: END_UTC,
  utcOffsetHours: OFFSET,
}

describe('isMovableLow', () => {
  it('TO_DO + creada hoy + lejos del cierre → movible', () => {
    expect(isMovableLow(baseCheck)).toBe(true)
  })

  it('IN_PROGRESS → no movible (ya empezó)', () => {
    expect(isMovableLow({ ...baseCheck, status: 'IN_PROGRESS' })).toBe(false)
  })

  it('ON_APPROVAL → no movible', () => {
    expect(isMovableLow({ ...baseCheck, status: 'ON_APPROVAL' })).toBe(false)
  })

  it('sin task_meta (createdAtMs null) → no movible', () => {
    expect(isMovableLow({ ...baseCheck, createdAtMs: null })).toBe(false)
  })

  it('creada un día anterior (otro día local) → no movible', () => {
    expect(isMovableLow({ ...baseCheck, createdAtMs: utc(18, 0, 17) })).toBe(false)
  })

  it('en la última hora del día (18:30 local) → no movible', () => {
    // 23:30 UTC = 18:30 local; el cierre local es 19:00 con buffer 1h → corte 18:00.
    expect(isMovableLow({ ...baseCheck, nowMs: utc(23, 30) })).toBe(false)
  })

  it('justo con más de 1h de margen (17:00 local) → movible', () => {
    // 22:00 UTC = 17:00 local ≤ 18:00 (corte) → movible.
    expect(isMovableLow({ ...baseCheck, nowMs: utc(22) })).toBe(true)
  })

  it('pasado el cierre, en la madrugada UTC (00:30 UTC = 19:30 local del MISMO día) → no movible', () => {
    // Cruce de medianoche UTC: 19 jun 00:30 UTC sigue siendo el 18 jun 19:30 local
    // (día laboral ya cerrado). createdAt del 18 local. Debe quedar fija.
    const created = utc(18, 0, 18) // 18 jun 13:00 local
    const now = Date.UTC(2026, 5, 19, 0, 30, 0) // 18 jun 19:30 local
    expect(isMovableLow({ ...baseCheck, createdAtMs: created, nowMs: now })).toBe(false)
  })
})

// ── computeLowCascade ────────────────────────────────────────────────────────
const BASE = new Date('2026-06-18T15:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(BASE + days * DAY)

// Resolver fake determinista: sin huecos, due = start + dur días.
const fakeResolver: SlotResolver = async (from, _owner, dur) => ({
  start: from,
  due: new Date(from.getTime() + dur * DAY),
})

function low(taskId: string, startDays: number, durationDays = 1, owner = 'u'): MovableLow {
  return {
    taskId,
    ownerUserId: owner,
    currentStart: at(startDays),
    currentDue: at(startDays + durationDays),
    durationDays,
  }
}

describe('computeLowCascade', () => {
  it('sin Low → no hay movimientos', async () => {
    expect(await computeLowCascade([], at(1), fakeResolver)).toEqual([])
  })

  it('1 Low anterior → se recoloca tras la tarea nueva', async () => {
    const moves = await computeLowCascade([low('a', 0)], at(1), fakeResolver)
    expect(moves).toHaveLength(1)
    expect(moves[0].taskId).toBe('a')
    expect(moves[0].newStart.getTime()).toBe(at(1).getTime())
    expect(moves[0].newDue.getTime()).toBe(at(2).getTime())
  })

  it('2 Low → la 2ª arranca tras el fin de la 1ª (encadenado)', async () => {
    const moves = await computeLowCascade([low('a', 0), low('b', 0.5)], at(1), fakeResolver)
    expect(moves.map((m) => m.taskId)).toEqual(['a', 'b'])
    expect(moves[0].newStart.getTime()).toBe(at(1).getTime())
    expect(moves[0].newDue.getTime()).toBe(at(2).getTime())
    expect(moves[1].newStart.getTime()).toBe(at(2).getTime())
    expect(moves[1].newDue.getTime()).toBe(at(3).getTime())
  })

  it('3 Low → cascada consecutiva en orden de inicio', async () => {
    const moves = await computeLowCascade(
      [low('c', 2), low('a', 0), low('b', 1)],
      at(1),
      fakeResolver
    )
    expect(moves.map((m) => m.taskId)).toEqual(['a', 'b', 'c'])
    expect(moves[0].newStart.getTime()).toBe(at(1).getTime())
    expect(moves[1].newStart.getTime()).toBe(at(2).getTime())
    expect(moves[2].newStart.getTime()).toBe(at(3).getTime())
  })

  it('"empujar, no adelantar": una Low ya posterior al cursor no se mueve', async () => {
    // a (en 0) se mueve a [1,2]; b empieza en 5 (ya después de 2) → se respeta, no se mueve.
    const moves = await computeLowCascade([low('a', 0), low('b', 5)], at(1), fakeResolver)
    expect(moves.map((m) => m.taskId)).toEqual(['a'])
  })

  it('respeta el hueco que devuelve el resolver (festivo/vacación)', async () => {
    // Resolver que salta 1 día (simula no-laborable): start = from + 1.
    const skipResolver: SlotResolver = async (from, _o, dur) => {
      const start = new Date(from.getTime() + DAY)
      return { start, due: new Date(start.getTime() + dur * DAY) }
    }
    const moves = await computeLowCascade([low('a', 0)], at(1), skipResolver)
    expect(moves[0].newStart.getTime()).toBe(at(2).getTime())
    expect(moves[0].newDue.getTime()).toBe(at(3).getTime())
  })
})

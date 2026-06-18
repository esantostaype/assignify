import { describe, it, expect } from 'vitest'
import { Level } from '@/db/enums'
import { VacationAwareUserSlot } from '@/interfaces'
import {
  compareSlots,
  pickBestInLevel,
  pickBestByLevelEscalation,
  pickBestAcrossAffinity,
} from './assignment-ranking'

// Fecha base fija para que las pruebas no dependan de "hoy".
const BASE = new Date('2026-06-18T12:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000
const at = (days: number) => new Date(BASE + days * DAY)

// Construye un slot con valores por defecto razonables; se sobreescribe lo relevante.
function slot(overrides: Partial<VacationAwareUserSlot> = {}): VacationAwareUserSlot {
  const availableDate = overrides.availableDate ?? at(0)
  return {
    userId: 'u',
    userName: 'User',
    availableDate,
    tasks: [],
    cargaTotal: 0,
    isSpecialist: false,
    totalAssignedDurationDays: 0,
    level: Level.MID,
    upcomingVacations: [],
    potentialTaskStart: availableDate,
    potentialTaskEnd: availableDate,
    hasVacationConflict: false,
    workingDaysUntilAvailable: 0,
    roleAffinity: 1,
    samePriorityOrHigherLoad: 0,
    status: 'available',
    ...overrides,
  }
}

const WINDOW = 3 // ventana "fechas parecidas" (≈ DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST)

describe('compareSlots', () => {
  it('prefiere a quien se libera ANTES cuando la diferencia supera la ventana', () => {
    const early = slot({ userId: 'early', availableDate: at(0), samePriorityOrHigherLoad: 9 })
    const late = slot({ userId: 'late', availableDate: at(10), samePriorityOrHigherLoad: 0 })
    // Aunque 'early' tenga más congestión, su fecha es muy anterior → gana.
    expect(compareSlots(early, late, WINDOW)).toBeLessThan(0)
  })

  it('dentro de la ventana, gana quien tiene MENOS congestión de prioridad', () => {
    const congested = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoad: 4 })
    const light = slot({ userId: 'b', availableDate: at(1), samePriorityOrHigherLoad: 1 })
    // 1 día de diferencia (< ventana) → decide la congestión: 'light' gana.
    expect(compareSlots(congested, light, WINDOW)).toBeGreaterThan(0)
  })

  it('dentro de la ventana e igual congestión, gana la menor carga total', () => {
    const heavy = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoad: 2, totalAssignedDurationDays: 12 })
    const lean = slot({ userId: 'b', availableDate: at(1), samePriorityOrHigherLoad: 2, totalAssignedDurationDays: 3 })
    expect(compareSlots(heavy, lean, WINDOW)).toBeGreaterThan(0)
  })
})

describe('pickBestInLevel', () => {
  it('escala a generalista si el especialista se libera mucho más tarde', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(10) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(0) })
    const best = pickBestInLevel([specialist, generalist], WINDOW)
    expect(best?.userId).toBe('gen')
  })

  it('mantiene al especialista cuando se libera primero (no fuerza generalista dentro de la ventana)', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(0) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(2) })
    // El especialista se libera antes y el generalista no lo supera por más que la ventana → se queda el especialista.
    const best = pickBestInLevel([specialist, generalist], WINDOW)
    expect(best?.userId).toBe('spec')
  })
})

describe('pickBestByLevelEscalation', () => {
  it('nunca elige un nivel inferior al pedido', () => {
    const junior = slot({ userId: 'jr', level: Level.JUNIOR, availableDate: at(0) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(5) })
    // Pedimos MID: el junior queda fuera aunque se libere antes.
    const best = pickBestByLevelEscalation([junior, senior], Level.MID, 3, WINDOW)
    expect(best?.userId).toBe('sr')
  })

  it('escala a un nivel superior si el del nivel pedido se libera mucho más tarde', () => {
    const mid = slot({ userId: 'mid', level: Level.MID, availableDate: at(10) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(0) })
    // Pedimos MID, pero el mid se libera 10 días después del senior (> levelEscalationDays=3) → escala.
    const best = pickBestByLevelEscalation([mid, senior], Level.MID, 3, WINDOW)
    expect(best?.userId).toBe('sr')
  })

  it('se queda en el nivel pedido si se libera dentro del umbral de escalado', () => {
    const mid = slot({ userId: 'mid', level: Level.MID, availableDate: at(2) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(0) })
    const best = pickBestByLevelEscalation([mid, senior], Level.MID, 3, WINDOW)
    expect(best?.userId).toBe('mid')
  })
})

describe('pickBestAcrossAffinity', () => {
  const ESC = 3 // levelEscalationDays

  it('prefiere el cargo PRIMARIO cuando se libera en fecha parecida al secundario', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(1) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, ESC, WINDOW)
    expect(best?.userId).toBe('prim')
  })

  it('escala a otro cargo si el primario está saturado (se libera mucho más tarde)', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(20) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    // El primario se libera 20 días después → se considera el secundario (1→2).
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, ESC, WINDOW)
    expect(best?.userId).toBe('sec')
  })

  it('balancea por prioridad: entre dos primarios cercanos, gana el menos cargado de urgentes', () => {
    const busyUrgent = slot({ userId: 'busy', roleAffinity: 1, availableDate: at(0), samePriorityOrHigherLoad: 5 })
    const freeUrgent = slot({ userId: 'free', roleAffinity: 1, availableDate: at(2), samePriorityOrHigherLoad: 0 })
    // 2 días de diferencia (< ventana) → decide la congestión de prioridad: 'free' gana.
    const best = pickBestAcrossAffinity([busyUrgent, freeUrgent], Level.MID, ESC, WINDOW)
    expect(best?.userId).toBe('free')
  })

  it('sin candidatos devuelve null', () => {
    expect(pickBestAcrossAffinity([], Level.MID, ESC, WINDOW)).toBeNull()
  })
})

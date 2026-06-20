import { describe, it, expect } from 'vitest'
import { Level } from '@/db/enums'
import { VacationAwareUserSlot } from '@/interfaces'
import {
  compareSlots,
  pickBestInLevel,
  pickBestByLevelEscalation,
  pickBestAcrossAffinity,
  type RankingConfig,
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
    samePriorityOrHigherLoadDays: 0,
    status: 'available',
    ...overrides,
  }
}

// Config base de los tests: umbrales de escalado = 3 días, tope de carga desactivado.
const cfg = (o: Partial<RankingConfig> = {}): RankingConfig => ({
  forceGeneralistDays: 3,
  levelEscalationDays: 3,
  crossRoleEscalationDays: 3,
  overloadSoftCapDays: 0,
  ...o,
})

describe('compareSlots', () => {
  it('manda la fecha: quien se libera ANTES gana (días distintos)', () => {
    const early = slot({ userId: 'early', availableDate: at(0) })
    const late = slot({ userId: 'late', availableDate: at(2) })
    expect(compareSlots(early, late, cfg())).toBeLessThan(0)
  })

  it('la fecha manda aunque el que se libera antes tenga MÁS carga (caso del usuario)', () => {
    // A: muchas tareas en cola pero se libera el día 0. B: menos carga pero se libera el día 2.
    const a = slot({ userId: 'A', availableDate: at(0), samePriorityOrHigherLoadDays: 10, totalAssignedDurationDays: 10 })
    const b = slot({ userId: 'B', availableDate: at(2), samePriorityOrHigherLoadDays: 12, totalAssignedDurationDays: 12 })
    // Debe ganar A porque se libera antes (terminaría la tarea nueva antes).
    expect(compareSlots(a, b, cfg())).toBeLessThan(0)
  })

  it('el MISMO día desempata por menor congestión de prioridad (en días)', () => {
    const congested = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoadDays: 4 })
    const light = slot({ userId: 'b', availableDate: at(0), samePriorityOrHigherLoadDays: 1 })
    expect(compareSlots(congested, light, cfg())).toBeGreaterThan(0)
  })

  it('el MISMO día mide la congestión en DÍAS de trabajo, no en nº de tareas', () => {
    // 'many' tiene MÁS tareas pero suman MENOS días; 'few' tiene una sola, larga.
    const many = slot({ userId: 'many', availableDate: at(0), samePriorityOrHigherLoad: 6, samePriorityOrHigherLoadDays: 0.5 })
    const few = slot({ userId: 'few', availableDate: at(0), samePriorityOrHigherLoad: 1, samePriorityOrHigherLoadDays: 5 })
    expect(compareSlots(many, few, cfg())).toBeLessThan(0)
  })

  it('el MISMO día e igual congestión, gana la menor carga total', () => {
    const heavy = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoadDays: 2, totalAssignedDurationDays: 12 })
    const lean = slot({ userId: 'b', availableDate: at(0), samePriorityOrHigherLoadDays: 2, totalAssignedDurationDays: 3 })
    expect(compareSlots(heavy, lean, cfg())).toBeGreaterThan(0)
  })

  it('tope blando de carga: empuja la fecha efectiva del sobrecargado (#2)', () => {
    const over = slot({ userId: 'over', availableDate: at(0), totalAssignedDurationDays: 30 })
    const free = slot({ userId: 'free', availableDate: at(5), totalAssignedDurationDays: 2 })
    // Sin tope (0): decide la fecha → 'over' gana por liberarse 5 días antes.
    expect(compareSlots(over, free, cfg())).toBeLessThan(0)
    // Con tope a 10 días: a 'over' se le empuja la fecha (+20) → ahora gana 'free'.
    expect(compareSlots(over, free, cfg({ overloadSoftCapDays: 10 }))).toBeGreaterThan(0)
  })

  it('desempate final DETERMINISTA por id cuando todo empata el mismo día (#6)', () => {
    const a = slot({ userId: 'aaa' })
    const b = slot({ userId: 'zzz' })
    expect(compareSlots(a, b, cfg())).toBeLessThan(0)
    expect(compareSlots(b, a, cfg())).toBeGreaterThan(0)
  })
})

describe('pickBestInLevel', () => {
  it('elige a quien se libera antes, sea generalista o especialista', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(10) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(0) })
    // El generalista se libera antes → gana.
    expect(pickBestInLevel([specialist, generalist], cfg())?.userId).toBe('gen')
  })

  it('mantiene al especialista cuando se libera antes', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(0) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(2) })
    expect(pickBestInLevel([specialist, generalist], cfg())?.userId).toBe('spec')
  })
})

describe('pickBestByLevelEscalation', () => {
  it('nunca elige un nivel inferior al pedido', () => {
    const junior = slot({ userId: 'jr', level: Level.JUNIOR, availableDate: at(0) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(5) })
    // Pedimos MID: el junior queda fuera aunque se libere antes.
    const best = pickBestByLevelEscalation([junior, senior], Level.MID, cfg())
    expect(best?.userId).toBe('sr')
  })

  it('escala a un nivel superior si el del nivel pedido se libera mucho más tarde', () => {
    const mid = slot({ userId: 'mid', level: Level.MID, availableDate: at(10) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(0) })
    // El mid se libera 10 días después del senior (> levelEscalationDays=3) → escala.
    const best = pickBestByLevelEscalation([mid, senior], Level.MID, cfg())
    expect(best?.userId).toBe('sr')
  })

  it('se queda en el nivel pedido si se libera dentro del umbral de escalado', () => {
    const mid = slot({ userId: 'mid', level: Level.MID, availableDate: at(2) })
    const senior = slot({ userId: 'sr', level: Level.SENIOR, availableDate: at(0) })
    const best = pickBestByLevelEscalation([mid, senior], Level.MID, cfg())
    expect(best?.userId).toBe('mid')
  })
})

describe('pickBestAcrossAffinity', () => {
  it('prefiere el cargo PRIMARIO cuando se libera en fecha cercana al secundario', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(1) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    // El secundario se libera 1 día antes, pero no supera crossRoleEscalationDays(3) → se queda el primario.
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, cfg())
    expect(best?.userId).toBe('prim')
  })

  it('escala a otro cargo si el primario está saturado (se libera mucho más tarde)', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(20) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, cfg())
    expect(best?.userId).toBe('sec')
  })

  it('entre dos primarios que se liberan el mismo día, gana el menos cargado', () => {
    const busy = slot({ userId: 'busy', roleAffinity: 1, availableDate: at(0), samePriorityOrHigherLoadDays: 5 })
    const free = slot({ userId: 'free', roleAffinity: 1, availableDate: at(0), samePriorityOrHigherLoadDays: 0 })
    const best = pickBestAcrossAffinity([busy, free], Level.MID, cfg())
    expect(best?.userId).toBe('free')
  })

  it('separa escalado de NIVEL y de CARGO con umbrales distintos (#3)', () => {
    // Primario MID se libera 5 días después de un secundario MID. Con crossRole alto (8)
    // NO se escala de cargo (se queda el primario).
    const primary = slot({ userId: 'prim', roleAffinity: 1, level: Level.MID, availableDate: at(5) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, level: Level.MID, availableDate: at(0) })
    const best = pickBestAcrossAffinity(
      [primary, secondary],
      Level.MID,
      cfg({ levelEscalationDays: 1, crossRoleEscalationDays: 8 })
    )
    expect(best?.userId).toBe('prim')
  })

  it('sin candidatos devuelve null', () => {
    expect(pickBestAcrossAffinity([], Level.MID, cfg())).toBeNull()
  })
})

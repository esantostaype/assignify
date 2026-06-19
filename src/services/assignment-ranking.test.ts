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

// Config base de los tests: ventana/umbrales = 3 días, tope de carga desactivado.
// Cada test sobreescribe lo que necesita (p.ej. overloadSoftCapDays).
const cfg = (o: Partial<RankingConfig> = {}): RankingConfig => ({
  closeWindowDays: 3,
  forceGeneralistDays: 3,
  levelEscalationDays: 3,
  crossRoleEscalationDays: 3,
  overloadSoftCapDays: 0,
  ...o,
})

describe('compareSlots', () => {
  it('prefiere a quien se libera ANTES cuando la diferencia supera la ventana', () => {
    const early = slot({ userId: 'early', availableDate: at(0), samePriorityOrHigherLoadDays: 9 })
    const late = slot({ userId: 'late', availableDate: at(10), samePriorityOrHigherLoadDays: 0 })
    // Aunque 'early' tenga más congestión, su fecha es muy anterior → gana.
    expect(compareSlots(early, late, cfg())).toBeLessThan(0)
  })

  it('dentro de la ventana, gana quien tiene MENOS congestión de prioridad (en días)', () => {
    const congested = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoadDays: 4 })
    const light = slot({ userId: 'b', availableDate: at(1), samePriorityOrHigherLoadDays: 1 })
    // 1 día de diferencia (< ventana) → decide la congestión: 'light' gana.
    expect(compareSlots(congested, light, cfg())).toBeGreaterThan(0)
  })

  it('mide la congestión en DÍAS de trabajo, no en nº de tareas', () => {
    // 'many' tiene MÁS tareas pero suman MENOS días; 'few' tiene una sola, larga.
    const many = slot({ userId: 'many', availableDate: at(0), samePriorityOrHigherLoad: 6, samePriorityOrHigherLoadDays: 0.5 })
    const few = slot({ userId: 'few', availableDate: at(1), samePriorityOrHigherLoad: 1, samePriorityOrHigherLoadDays: 5 })
    // Dentro de la ventana: gana 'many' porque su carga real (en días) es menor.
    expect(compareSlots(many, few, cfg())).toBeLessThan(0)
  })

  it('dentro de la ventana e igual congestión, gana la menor carga total', () => {
    const heavy = slot({ userId: 'a', availableDate: at(0), samePriorityOrHigherLoadDays: 2, totalAssignedDurationDays: 12 })
    const lean = slot({ userId: 'b', availableDate: at(1), samePriorityOrHigherLoadDays: 2, totalAssignedDurationDays: 3 })
    expect(compareSlots(heavy, lean, cfg())).toBeGreaterThan(0)
  })

  it('tope blando de carga: penaliza la fecha efectiva del sobrecargado (#2)', () => {
    // 'over' se libera antes pero arrastra 30 días de trabajo total; 'free' apenas 2.
    const over = slot({ userId: 'over', availableDate: at(0), totalAssignedDurationDays: 30 })
    const free = slot({ userId: 'free', availableDate: at(5), totalAssignedDurationDays: 2 })
    // Sin tope (0): decide la fecha → 'over' gana por liberarse 5 días antes.
    expect(compareSlots(over, free, cfg())).toBeLessThan(0)
    // Con tope a 10 días: a 'over' se le empuja la fecha (+20) → ahora gana 'free'.
    expect(compareSlots(over, free, cfg({ overloadSoftCapDays: 10 }))).toBeGreaterThan(0)
  })

  it('desempate final DETERMINISTA por id, no por orden de llegada (#6)', () => {
    const a = slot({ userId: 'aaa' })
    const b = slot({ userId: 'zzz' })
    // Todo idéntico salvo el id → el desempate es estable y reproducible.
    expect(compareSlots(a, b, cfg())).toBeLessThan(0)
    expect(compareSlots(b, a, cfg())).toBeGreaterThan(0)
  })
})

describe('pickBestInLevel', () => {
  it('escala a generalista si el especialista se libera mucho más tarde', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(10) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(0) })
    const best = pickBestInLevel([specialist, generalist], cfg())
    expect(best?.userId).toBe('gen')
  })

  it('mantiene al especialista cuando se libera primero (no fuerza generalista dentro de la ventana)', () => {
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(0) })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(2) })
    // El especialista se libera antes y el generalista no lo supera por más que la ventana → se queda el especialista.
    const best = pickBestInLevel([specialist, generalist], cfg())
    expect(best?.userId).toBe('spec')
  })

  it('usa forceGeneralistDays propio para decidir especialista vs generalista (#3)', () => {
    // Dentro de la ventana de fechas el especialista gana el orden por tener MENOS
    // congestión; luego forceGeneralistDays decide si se "baja" al generalista que
    // se libera un poco antes.
    const specialist = slot({ userId: 'spec', isSpecialist: true, availableDate: at(2), samePriorityOrHigherLoadDays: 0 })
    const generalist = slot({ userId: 'gen', isSpecialist: false, availableDate: at(0), samePriorityOrHigherLoadDays: 5 })
    // El generalista se libera 2 días antes. Con forceGeneralistDays alto (8) NO se fuerza → especialista.
    expect(pickBestInLevel([specialist, generalist], cfg({ forceGeneralistDays: 8 }))?.userId).toBe('spec')
    // Con forceGeneralistDays bajo (1): 2 > 1 → se fuerza el generalista.
    expect(pickBestInLevel([specialist, generalist], cfg({ forceGeneralistDays: 1 }))?.userId).toBe('gen')
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
    // Pedimos MID, pero el mid se libera 10 días después del senior (> levelEscalationDays=3) → escala.
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
  it('prefiere el cargo PRIMARIO cuando se libera en fecha parecida al secundario', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(1) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, cfg())
    expect(best?.userId).toBe('prim')
  })

  it('escala a otro cargo si el primario está saturado (se libera mucho más tarde)', () => {
    const primary = slot({ userId: 'prim', roleAffinity: 1, availableDate: at(20) })
    const secondary = slot({ userId: 'sec', roleAffinity: 2, availableDate: at(0) })
    // El primario se libera 20 días después → se considera el secundario (1→2).
    const best = pickBestAcrossAffinity([primary, secondary], Level.MID, cfg())
    expect(best?.userId).toBe('sec')
  })

  it('balancea por prioridad: entre dos primarios cercanos, gana el menos cargado de urgentes', () => {
    const busyUrgent = slot({ userId: 'busy', roleAffinity: 1, availableDate: at(0), samePriorityOrHigherLoadDays: 5 })
    const freeUrgent = slot({ userId: 'free', roleAffinity: 1, availableDate: at(2), samePriorityOrHigherLoadDays: 0 })
    // 2 días de diferencia (< ventana) → decide la congestión de prioridad: 'free' gana.
    const best = pickBestAcrossAffinity([busyUrgent, freeUrgent], Level.MID, cfg())
    expect(best?.userId).toBe('free')
  })

  it('separa escalado de NIVEL y de CARGO con umbrales distintos (#3)', () => {
    // Primario MID se libera 5 días después de un secundario MID. Con crossRole alto (8)
    // NO se escala de cargo (se queda el primario) aunque el de nivel fuese bajo.
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

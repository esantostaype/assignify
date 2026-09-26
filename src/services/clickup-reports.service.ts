/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/clickup-reports.service.ts
// Reportes leídos EN VIVO de ClickUp. Tres vistas + filtros (personas, rango de meses):
//   A) fetchWorkloadSeries — carga (días laborales) por mes de EJECUCIÓN (span).
//   B) fetchCreatedSeries  — conteo por mes de creación EFECTIVA (deshace la migración).
//   C) fetchDemandSeries   — días laborales por mes de creación (híbrido).
// Ver notas de cada función. Modelo de horas consistente con el motor (isNonWorkingDay
// + ventanas de getAppSettings). La migración de workspace (~jun 2026) reseteó
// date_created; por eso la creación efectiva = min(date_created, start ?? due).
import axios from 'axios'
import { API_CONFIG } from '@/config'
import { getAppSettings } from '@/services/app-settings.service'
import { getHolidayMatcher } from '@/services/holidays.service'
import { isNonWorkingDay, setActiveHolidays } from '@/utils/task-calculation-utils'

const HOUR_MS = 60 * 60 * 1000
const LIMA_OFFSET_MS = 5 * HOUR_MS
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MAX_PAGES = 200
const MAX_DAYS_PER_TASK = 4000

interface WorkHours {
  START: number
  LUNCH_START: number
  LUNCH_END: number
  END: number
}

export interface ReportFetchOptions {
  token?: string
  teamId?: string | null
  /** Filtrar a tareas asignadas a alguno de estos ids de ClickUp. */
  assigneeIds?: string[] | null
  /** Ventana de fechas (epoch ms): recorta los meses mostrados a [from, to]. */
  from?: number | null
  to?: number | null
}

interface RawTask {
  start: number | null
  due: number | null
  created: number | null
  assignees: string[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

async function cu(path: string, token: string, params: Record<string, any>): Promise<any> {
  const res = await axios.get(`${API_CONFIG.CLICKUP_API_BASE}${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    params,
  })
  return res.data
}

async function resolveTeamIds(token: string, teamId?: string | null): Promise<string[]> {
  if (teamId) return [teamId]
  return (((await cu('/team', token, {})).teams || []) as any[]).map((t) => String(t.id))
}

const num = (v: any): number | null => {
  const n = parseInt(v)
  return Number.isFinite(n) ? n : null
}

/** Recorre TODAS las tareas (incluidas cerradas), excluye `ongoing`, devuelve fechas
 *  crudas + assignees. Compartido por los tres reportes. */
async function crawlRawTasks(
  token: string,
  teamIds: string[]
): Promise<{ rows: RawTask[]; truncated: boolean }> {
  const rows: RawTask[] = []
  let truncated = false
  for (const teamId of teamIds) {
    let page = 0
    let hasMore = true
    while (hasMore && page < MAX_PAGES) {
      let data: any
      try {
        data = await cu(`/team/${teamId}/task`, token, {
          page,
          include_closed: true,
          subtasks: true,
          order_by: 'created',
        })
      } catch {
        break
      }
      const tasks: any[] = data.tasks || []
      for (const t of tasks) {
        const isOngoing = (t.tags || []).some(
          (tag: any) => (tag?.name || '').toLowerCase() === 'ongoing'
        )
        if (isOngoing) continue
        rows.push({
          start: num(t.start_date),
          due: num(t.due_date),
          created: num(t.date_created),
          assignees: (t.assignees || []).map((a: any) => String(a.id)),
        })
      }
      hasMore = tasks.length >= 100
      page++
      if (hasMore && page >= MAX_PAGES) truncated = true
    }
  }
  return { rows, truncated }
}

/** Filtra por assignee (si hay ids seleccionados). */
function filterByAssignees(rows: RawTask[], assigneeIds?: string[] | null): RawTask[] {
  if (!assigneeIds || assigneeIds.length === 0) return rows
  const set = new Set(assigneeIds)
  return rows.filter((r) => r.assignees.some((a) => set.has(a)))
}

/** ¿El mes 'YYYY-MM' cae dentro de la ventana [from, to]? */
function inDateWindow(key: string, from?: number | null, to?: number | null): boolean {
  if (from == null && to == null) return true
  const [y, m] = key.split('-').map(Number)
  const monthStart = Date.UTC(y, m - 1, 1)
  const monthEnd = Date.UTC(y, m, 1) - 1
  if (from != null && monthEnd < from) return false
  if (to != null && monthStart > to) return false
  return true
}

function limaMonthKey(ms: number): string {
  const d = new Date(ms - LIMA_OFFSET_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Rellena los meses faltantes entre la primera y última clave (vacíos = 0). */
function fillMonths<T>(
  buckets: Map<string, number>,
  make: (key: string, label: string, value: number) => T
): T[] {
  if (buckets.size === 0) return []
  const keys = [...buckets.keys()].sort()
  const [minY, minM] = keys[0].split('-').map(Number)
  const [maxY, maxM] = keys[keys.length - 1].split('-').map(Number)
  const out: T[] = []
  let y = minY
  let m = minM
  while (y < maxY || (y === maxY && m <= maxM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(make(key, `${MONTHS[m - 1]} ${y}`, buckets.get(key) || 0))
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

// ─── A) CARGA LABORAL ────────────────────────────────────────────────────────

export interface MonthPoint {
  key: string
  label: string
  days: number
  hours: number
}

export interface WorkloadSeries {
  months: MonthPoint[]
  totalDays: number
  totalHours: number
  includedTasks: number
  skippedNoDates: number
  hoursPerDay: number
  from: string | null
  to: string | null
  truncated: boolean
}

function addSpanWorkloadByMonth(
  startMs: number,
  dueMs: number,
  wh: WorkHours,
  buckets?: Map<string, number> | null
): number {
  if (!(dueMs > startMs)) return 0
  const blocks: [number, number][] = [
    [wh.START, wh.LUNCH_START],
    [wh.LUNCH_END, wh.END],
  ]
  const cur = new Date(startMs)
  cur.setUTCHours(0, 0, 0, 0)
  let safety = 0
  let total = 0
  while (cur.getTime() <= dueMs && safety < MAX_DAYS_PER_TASK) {
    safety++
    if (!isNonWorkingDay(cur)) {
      const y = cur.getUTCFullYear()
      const mo = cur.getUTCMonth()
      const d = cur.getUTCDate()
      const key = `${y}-${String(mo + 1).padStart(2, '0')}`
      for (const [from, to] of blocks) {
        const bStart = Date.UTC(y, mo, d, from, 0, 0, 0)
        const bEnd = Date.UTC(y, mo, d, to, 0, 0, 0)
        const a = Math.max(startMs, bStart)
        const b = Math.min(dueMs, bEnd)
        if (b > a) {
          const hrs = (b - a) / HOUR_MS
          if (buckets) buckets.set(key, (buckets.get(key) || 0) + hrs)
          total += hrs
        }
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return total
}

function nextWorkingDayStart(ms: number, wh: WorkHours): number {
  const d = new Date(ms)
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(wh.START, 0, 0, 0)
  let guard = 0
  while (isNonWorkingDay(d) && guard < 3660) {
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(wh.START, 0, 0, 0)
    guard++
  }
  return d.getTime()
}

function addOneWorkingDay(dueMs: number, hoursPerDay: number, buckets: Map<string, number>): void {
  const key = limaMonthKey(dueMs)
  buckets.set(key, (buckets.get(key) || 0) + hoursPerDay)
}

function prevBefore(sorted: number[], target: number): number | null {
  let lo = 0
  let hi = sorted.length
  let r = -1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < target) {
      r = mid
      lo = mid + 1
    } else hi = mid
  }
  return r >= 0 ? sorted[r] : null
}

function hoursPerDayOf(wh: WorkHours): number {
  return Math.max(1, wh.LUNCH_START - wh.START) + Math.max(0, wh.END - wh.LUNCH_END) || 8
}

export async function fetchWorkloadSeries(opts: ReportFetchOptions = {}): Promise<WorkloadSeries> {
  const empty: WorkloadSeries = {
    months: [], totalDays: 0, totalHours: 0, includedTasks: 0, skippedNoDates: 0,
    hoursPerDay: 8, from: null, to: null, truncated: false,
  }
  const token = opts.token
  if (!token) return empty

  const teamIds = await resolveTeamIds(token, opts.teamId)
  const { rows: allRows, truncated } = await crawlRawTasks(token, teamIds)
  const rows = filterByAssignees(allRows, opts.assigneeIds)

  const spans: { start: number; due: number }[] = []
  const deadlineOnly: number[] = []
  const allDeadlines: number[] = []
  let skippedNoDates = 0
  let minTs = Infinity
  let maxTs = -Infinity
  for (const rr of rows) {
    if (rr.start != null && rr.due != null && rr.due > rr.start) {
      spans.push({ start: rr.start, due: rr.due })
      allDeadlines.push(rr.due)
      if (rr.start < minTs) minTs = rr.start
      if (rr.due > maxTs) maxTs = rr.due
    } else if (rr.due != null) {
      deadlineOnly.push(rr.due)
      allDeadlines.push(rr.due)
      if (rr.due < minTs) minTs = rr.due
      if (rr.due > maxTs) maxTs = rr.due
    } else {
      skippedNoDates++
    }
  }

  if (spans.length === 0 && deadlineOnly.length === 0) return { ...empty, skippedNoDates, truncated }

  const wh = (await getAppSettings(opts.teamId ?? undefined)).workHours
  setActiveHolidays(await getHolidayMatcher(opts.teamId ?? undefined))
  const hoursPerDay = hoursPerDayOf(wh)

  const buckets = new Map<string, number>()
  for (const s of spans) addSpanWorkloadByMonth(s.start, s.due, wh, buckets)

  allDeadlines.sort((a, b) => a - b)
  for (const due of deadlineOnly) {
    const prev = prevBefore(allDeadlines, due)
    const start = prev == null ? null : nextWorkingDayStart(prev, wh)
    if (start != null && start < due) {
      const tmp = new Map<string, number>()
      const h = addSpanWorkloadByMonth(start, due, wh, tmp)
      if (h >= hoursPerDay) for (const [k, v] of tmp) buckets.set(k, (buckets.get(k) || 0) + v)
      else addOneWorkingDay(due, hoursPerDay, buckets)
    } else {
      addOneWorkingDay(due, hoursPerDay, buckets)
    }
  }

  let months = fillMonths(buckets, (key, label, hours) => ({
    key, label, hours: r1(hours), days: r1(hours / hoursPerDay),
  }))
  months = months.filter((mo) => inDateWindow(mo.key, opts.from, opts.to))
  const totalHours = months.reduce((s, mo) => s + mo.hours, 0)

  return {
    months,
    totalHours: r1(totalHours),
    totalDays: r1(totalHours / hoursPerDay),
    includedTasks: spans.length + deadlineOnly.length,
    skippedNoDates,
    hoursPerDay,
    from: Number.isFinite(minTs) ? new Date(minTs).toISOString() : null,
    to: Number.isFinite(maxTs) ? new Date(maxTs).toISOString() : null,
    truncated,
  }
}

// ─── B) CREACIÓN / INTAKE ────────────────────────────────────────────────────

export interface CreatedMonthPoint {
  key: string
  label: string
  count: number
}

export interface CreatedSeries {
  months: CreatedMonthPoint[]
  total: number
  adjusted: number
  from: string | null
  to: string | null
  truncated: boolean
}

/** Fecha de creación efectiva de una tarea (deshace la migración). */
function effectiveCreated(rr: RawTask): number | null {
  const base = rr.start ?? rr.due ?? rr.created
  const created = rr.created ?? base
  const eff = base != null ? Math.min(created as number, base) : (created as number)
  return eff != null && Number.isFinite(eff) ? eff : null
}

export async function fetchCreatedSeries(opts: ReportFetchOptions = {}): Promise<CreatedSeries> {
  const empty: CreatedSeries = { months: [], total: 0, adjusted: 0, from: null, to: null, truncated: false }
  const token = opts.token
  if (!token) return empty

  const teamIds = await resolveTeamIds(token, opts.teamId)
  const { rows: allRows, truncated } = await crawlRawTasks(token, teamIds)
  const rows = filterByAssignees(allRows, opts.assigneeIds)

  const buckets = new Map<string, number>()
  let adjusted = 0
  let minTs = Infinity
  let maxTs = -Infinity
  for (const rr of rows) {
    const eff = effectiveCreated(rr)
    if (eff == null) continue
    if (rr.created != null && eff < rr.created) adjusted++
    buckets.set(limaMonthKey(eff), (buckets.get(limaMonthKey(eff)) || 0) + 1)
    if (eff < minTs) minTs = eff
    if (eff > maxTs) maxTs = eff
  }

  let months = fillMonths(buckets, (key, label, count) => ({ key, label, count }))
  months = months.filter((mo) => inDateWindow(mo.key, opts.from, opts.to))
  const total = months.reduce((s, mo) => s + mo.count, 0)

  return {
    months,
    total,
    adjusted,
    from: Number.isFinite(minTs) ? new Date(minTs).toISOString() : null,
    to: Number.isFinite(maxTs) ? new Date(maxTs).toISOString() : null,
    truncated,
  }
}

// ─── C) DEMANDA (carga por mes de creación) ──────────────────────────────────

export interface DemandMonthPoint {
  key: string
  label: string
  days: number
  hours: number
  tasks: number
}

export interface DemandSeries {
  months: DemandMonthPoint[]
  totalDays: number
  totalHours: number
  totalTasks: number
  adjusted: number
  hoursPerDay: number
  skippedNoDates: number
  from: string | null
  to: string | null
  truncated: boolean
}

export async function fetchDemandSeries(opts: ReportFetchOptions = {}): Promise<DemandSeries> {
  const empty: DemandSeries = {
    months: [], totalDays: 0, totalHours: 0, totalTasks: 0, adjusted: 0,
    hoursPerDay: 8, skippedNoDates: 0, from: null, to: null, truncated: false,
  }
  const token = opts.token
  if (!token) return empty

  const teamIds = await resolveTeamIds(token, opts.teamId)
  const { rows: allRows, truncated } = await crawlRawTasks(token, teamIds)
  const rows = filterByAssignees(allRows, opts.assigneeIds)
  if (rows.length === 0) return { ...empty, truncated }

  const wh = (await getAppSettings(opts.teamId ?? undefined)).workHours
  setActiveHolidays(await getHolidayMatcher(opts.teamId ?? undefined))
  const hoursPerDay = hoursPerDayOf(wh)

  const allDeadlines = rows.filter((rr) => rr.due != null).map((rr) => rr.due as number).sort((a, b) => a - b)

  const hoursByMonth = new Map<string, number>()
  const tasksByMonth = new Map<string, number>()
  let adjusted = 0
  let skippedNoDates = 0

  for (const rr of rows) {
    let hours = 0
    if (rr.start != null && rr.due != null && rr.due > rr.start) {
      hours = addSpanWorkloadByMonth(rr.start, rr.due, wh)
    } else if (rr.due != null) {
      const prev = prevBefore(allDeadlines, rr.due)
      const start = prev == null ? null : nextWorkingDayStart(prev, wh)
      if (start != null && start < rr.due) {
        const h = addSpanWorkloadByMonth(start, rr.due, wh)
        hours = h >= hoursPerDay ? h : hoursPerDay
      } else {
        hours = hoursPerDay
      }
    } else {
      skippedNoDates++
      continue
    }

    const eff = effectiveCreated(rr)
    if (eff == null) continue
    if (rr.created != null && eff < rr.created) adjusted++
    const key = limaMonthKey(eff)
    hoursByMonth.set(key, (hoursByMonth.get(key) || 0) + hours)
    tasksByMonth.set(key, (tasksByMonth.get(key) || 0) + 1)
  }

  let months = fillMonths(hoursByMonth, (key, label, hrs) => ({
    key, label, hours: r1(hrs), days: r1(hrs / hoursPerDay), tasks: tasksByMonth.get(key) || 0,
  }))
  months = months.filter((mo) => inDateWindow(mo.key, opts.from, opts.to))
  const totalHours = months.reduce((s, mo) => s + mo.hours, 0)
  const totalTasks = months.reduce((s, mo) => s + mo.tasks, 0)

  return {
    months,
    totalHours: r1(totalHours),
    totalDays: r1(totalHours / hoursPerDay),
    totalTasks,
    adjusted,
    hoursPerDay,
    skippedNoDates,
    from: months.length ? isoOfMonth(months[0].key, false) : null,
    to: months.length ? isoOfMonth(months[months.length - 1].key, true) : null,
    truncated,
  }
}

/** ISO del inicio (o fin) del mes 'YYYY-MM'. */
function isoOfMonth(key: string, end: boolean): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(end ? Date.UTC(y, m, 0) : Date.UTC(y, m - 1, 1)).toISOString()
}

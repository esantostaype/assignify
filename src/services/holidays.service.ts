// Feriados por workspace (reemplaza el usHolidays.json hardcodeado). Lee de la tabla
// `holiday` (cacheada 60s por workspace) y arma el matcher que consume el motor
// (isNonWorkingDay vía setActiveHolidays). Modelo MIXTO: year NULL = recurrente (mes/día
// cada año) → "MM-DD"; con year = fecha única → "YYYY-MM-DD".
import { db } from '@/db'
import { holiday as holidayTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { HolidayMatcher } from '@/utils/task-calculation-utils'

export interface HolidayRow {
  id: number
  name: string
  month: number
  day: number
  year: number | null
}

const TTL_MS = 60_000
const cache = new Map<string, { at: number; rows: HolidayRow[] }>()

const pad = (n: number) => String(n).padStart(2, '0')

/** Filas de feriados del workspace (cacheadas). Para la API/UI y para el matcher. */
export async function getWorkspaceHolidays(workspaceId?: string | null): Promise<HolidayRow[]> {
  const key = workspaceId ?? 'global'
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows

  let rows: HolidayRow[] = []
  try {
    const q = db
      .select({
        id: holidayTable.id,
        name: holidayTable.name,
        month: holidayTable.month,
        day: holidayTable.day,
        year: holidayTable.year,
      })
      .from(holidayTable)
    rows = workspaceId ? await q.where(eq(holidayTable.workspaceId, workspaceId)) : await q
  } catch (e) {
    console.error('getWorkspaceHolidays failed:', e)
    rows = []
  }
  cache.set(key, { at: Date.now(), rows })
  return rows
}

/** Invalida la cache de feriados del workspace (tras crear/editar/borrar/importar). */
export function invalidateHolidays(workspaceId?: string | null): void {
  cache.delete(workspaceId ?? 'global')
}

/** Matcher para el motor: { recurrentes "MM-DD", fechas únicas "YYYY-MM-DD" }. */
export async function getHolidayMatcher(workspaceId?: string | null): Promise<HolidayMatcher> {
  const rows = await getWorkspaceHolidays(workspaceId)
  const dated = new Set<string>()
  const recurring = new Set<string>()
  for (const h of rows) {
    const mmdd = `${pad(h.month)}-${pad(h.day)}`
    if (h.year == null) recurring.add(mmdd)
    else dated.add(`${h.year}-${mmdd}`)
  }
  return { dated, recurring }
}

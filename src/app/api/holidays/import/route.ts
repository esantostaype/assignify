import { NextResponse } from 'next/server'
import { db } from '@/db'
import { holiday } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import {
  invalidateHolidays,
  parseHolidayInput,
  type HolidayInput,
} from '@/services/holidays.service'

// Escribe datos en vivo de la DB: nunca pre-renderizar/cachear en build.
export const dynamic = 'force-dynamic'

// Parser CSV mínimo (sin dependencias): respeta campos entre comillas dobles,
// "" escapado, y tolera CRLF/LF + BOM de Excel. Devuelve filas no vacías.
function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // quitar BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Descartar líneas totalmente vacías.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// POST → importa feriados desde CSV (columnas: Name, Month, Day, Year).
// Body: { csv: string, mode?: 'replace' | 'append' }. Year vacío = recurrente.
// Por defecto 'replace': el archivo pasa a ser el set completo de feriados del workspace.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { csv?: unknown; mode?: unknown }
    const csv = typeof body.csv === 'string' ? body.csv : ''
    if (!csv.trim()) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    }
    const mode = body.mode === 'append' ? 'append' : 'replace'

    const valid: HolidayInput[] = []
    let skipped = 0
    parseCsv(csv).forEach((cols, idx) => {
      // Primera fila con un mes NO numérico = cabecera → saltar sin contar.
      if (idx === 0 && Number.isNaN(Number((cols[1] ?? '').trim()))) return
      const parsed = parseHolidayInput({
        name: (cols[0] ?? '').trim(),
        month: (cols[1] ?? '').trim(),
        day: (cols[2] ?? '').trim(),
        year: (cols[3] ?? '').trim(),
      })
      if (typeof parsed === 'string') skipped++
      else valid.push(parsed)
    })

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in the file' },
        { status: 400 }
      )
    }

    const wsId = await getCurrentWorkspaceId()

    // Estrategia segura SIN transacción (libSQL/HTTP): primero INSERTA las nuevas,
    // luego BORRA las viejas. Si el insert falla, no se borró nada; si el delete
    // falla, quedan duplicados pero CERO pérdida de datos (recuperable).
    let oldIds: number[] = []
    if (mode === 'replace') {
      const existing = await db
        .select({ id: holiday.id })
        .from(holiday)
        .where(eq(holiday.workspaceId, wsId ?? '__none__'))
      oldIds = existing.map((e) => e.id)
    }

    await db.insert(holiday).values(valid.map((v) => ({ ...v, workspaceId: wsId })))

    if (mode === 'replace' && oldIds.length > 0) {
      await db
        .delete(holiday)
        .where(
          and(eq(holiday.workspaceId, wsId ?? '__none__'), inArray(holiday.id, oldIds))
        )
    }

    invalidateHolidays(wsId)
    return NextResponse.json({ imported: valid.length, skipped, mode })
  } catch (error) {
    console.error('Error importing holidays:', error)
    return NextResponse.json({ error: 'Failed to import holidays' }, { status: 500 })
  }
}

// scripts/add-holiday-table.js  [Feriados — H1]
// Crea la tabla `holiday` (feriados por workspace, mixto: recurrente mes/día con year NULL,
// o fecha única con year) y la siembra UNA vez con los feriados de usHolidays.json (como
// fechas únicas) para el workspace por defecto. CREATE TABLE IF NOT EXISTS + seed solo si
// está vacía → idempotente. NO usa drizzle-kit push.
require('dotenv/config')
const { createClient } = require('@libsql/client')
const holidays = require('../src/data/usHolidays.json')

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '9017044866'

;(async () => {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL no configurado')

  const client = createClient({ url, authToken })

  await client.execute(`
    CREATE TABLE IF NOT EXISTS holiday (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      month        INTEGER NOT NULL,
      day          INTEGER NOT NULL,
      year         INTEGER,
      workspace_id TEXT,
      created_at   INTEGER NOT NULL
    )
  `)

  const count = await client.execute('SELECT COUNT(*) AS n FROM holiday')
  if (Number(count.rows[0].n) === 0) {
    const now = Date.now()
    for (const h of holidays) {
      const [y, m, d] = h.date.split('-').map(Number)
      await client.execute({
        sql: 'INSERT INTO holiday (name, month, day, year, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [h.name, m, d, y, WORKSPACE_ID, now],
      })
    }
    console.log(`✅ Seed: ${holidays.length} feriados insertados para workspace ${WORKSPACE_ID}.`)
  } else {
    console.log(`ℹ️ holiday ya tiene ${count.rows[0].n} filas; no se re-siembra.`)
  }

  const info = await client.execute('PRAGMA table_info(holiday)')
  console.log(`✅ Tabla holiday lista (${info.rows.length} columnas).`)
  process.exit(0)
})().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})

// scripts/add-assignment-lock-table.js  [SaaS fase 8 — lock de creación por workspace]
// Crea la tabla assignment_lock (un lock por workspace para serializar la creación
// de tareas). CREATE TABLE IF NOT EXISTS → idempotente. NO usa drizzle-kit push.
require('dotenv/config')
const { createClient } = require('@libsql/client')

;(async () => {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL no configurado')

  const client = createClient({ url, authToken })

  await client.execute(`
    CREATE TABLE IF NOT EXISTS assignment_lock (
      workspace_id TEXT PRIMARY KEY,
      locked_at    INTEGER NOT NULL
    )
  `)

  const info = await client.execute('PRAGMA table_info(assignment_lock)')
  console.log(`✅ Tabla assignment_lock lista (${info.rows.length} columnas).`)
  process.exit(0)
})().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})

// scripts/add-workspace-webhook-table.js  [SaaS fase 4 — webhooks por workspace]
// Crea la tabla workspace_webhook (un webhook de ClickUp por workspace, con su secret
// cifrado) en Turso. CREATE TABLE IF NOT EXISTS → idempotente. NO usa drizzle-kit push.
require('dotenv/config')
const { createClient } = require('@libsql/client')

;(async () => {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL no configurado')

  const client = createClient({ url, authToken })

  await client.execute(`
    CREATE TABLE IF NOT EXISTS workspace_webhook (
      workspace_id TEXT PRIMARY KEY,
      webhook_id   TEXT NOT NULL,
      secret_enc   TEXT NOT NULL,
      endpoint     TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    )
  `)

  const info = await client.execute('PRAGMA table_info(workspace_webhook)')
  console.log(`✅ Tabla workspace_webhook lista (${info.rows.length} columnas).`)
  process.exit(0)
})().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})

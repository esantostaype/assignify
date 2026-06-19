// scripts/add-workspaces-column.js  [SaaS fase 4 — selector multi-workspace]
// Añade la columna `workspaces` (JSON como TEXT) a clickup_connection para guardar
// TODOS los workspaces autorizados del usuario (el activo sigue en workspace_id).
// Es ADD COLUMN nullable e IDEMPOTENTE (revisa si ya existe). NO usa drizzle-kit
// push (que se atascó en un índice cosmético; ver skill assignify-saas-roadmap).
require('dotenv/config')
const { createClient } = require('@libsql/client')

;(async () => {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL no configurado')

  const client = createClient({ url, authToken })

  // ¿Ya existe la columna? (idempotencia: re-correr el script no falla)
  const info = await client.execute('PRAGMA table_info(clickup_connection)')
  const has = info.rows.some((r) => r.name === 'workspaces')
  if (has) {
    console.log('✅ La columna `workspaces` ya existe en clickup_connection. Nada que hacer.')
    process.exit(0)
  }

  await client.execute('ALTER TABLE clickup_connection ADD COLUMN workspaces TEXT')
  console.log('✅ Columna `workspaces` (TEXT/JSON) añadida a clickup_connection.')
  process.exit(0)
})().catch((e) => {
  console.error('❌ Migración falló:', e)
  process.exit(1)
})

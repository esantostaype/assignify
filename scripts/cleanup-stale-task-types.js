// scripts/cleanup-stale-task-types.js  [SaaS fase 4 — hardening]
// Borra los task_type HUÉRFANOS que quedaron bajo el workspace_id stale 90170099166
// (nombres viejos "UX/UI"/"Graphic" del esquema single-tenant ya eliminado). Aborta si
// algún user_role los referencia. Idempotente.
require('dotenv/config')
const { createClient } = require('@libsql/client')

const STALE = '90170099166'

;(async () => {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const tt = await c.execute({ sql: 'SELECT id, name FROM task_type WHERE workspace_id = ?', args: [STALE] })
  if (tt.rows.length === 0) {
    console.log(`✅ No hay task_type stale en ${STALE}. Nada que limpiar.`)
    process.exit(0)
  }

  const ids = tt.rows.map((r) => r.id)
  const ph = ids.map(() => '?').join(',')
  const refs = await c.execute({ sql: `SELECT COUNT(*) n FROM user_role WHERE type_id IN (${ph})`, args: ids })
  const n = Number(refs.rows[0].n)
  if (n > 0) {
    console.error(`❌ ABORTADO: ${n} user_role referencian esos task_type. No se borra nada.`)
    process.exit(1)
  }

  const del = await c.execute({ sql: 'DELETE FROM task_type WHERE workspace_id = ?', args: [STALE] })
  console.log(`✅ Borrados ${del.rowsAffected} task_type huerfanos (ws ${STALE}): ${tt.rows.map((r) => `${r.id}:${r.name}`).join(', ')}`)
  process.exit(0)
})().catch((e) => {
  console.error('❌ Fallo:', e)
  process.exit(1)
})

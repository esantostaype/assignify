// scripts/fix-name-uniques.js  [SaaS fase 4 — hardening]
// Cambia uniques GLOBALES a uniques POR WORKSPACE (workspace_id + …) en las tablas de
// config, para que cada inquilino tenga sus propios nombres/keys sin chocar. Solo toca
// ÍNDICES (no recrea tablas): son índices nombrados (origin=c). Idempotente. Aborta si
// encuentra duplicados por las columnas destino (no toca nada en ese caso).
require('dotenv/config')
const { createClient } = require('@libsql/client')

const PLAN = [
  { table: 'brand', oldIdx: 'brand_name_unique', newIdx: 'brand_workspace_name_unique', cols: ['workspace_id', 'name'] },
  { table: 'task_type', oldIdx: 'task_type_name_unique', newIdx: 'task_type_workspace_name_unique', cols: ['workspace_id', 'name'] },
  { table: 'system_settings', oldIdx: 'system_settings_category_key_unique', newIdx: 'system_settings_ws_category_key_unique', cols: ['workspace_id', 'category', 'key'] },
  { table: 'tier_list', oldIdx: 'tier_list_name_unique', newIdx: 'tier_list_workspace_name_unique', cols: ['workspace_id', 'name'] },
]

;(async () => {
  const c = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  // 1) Seguridad: abortar si ya hay duplicados por las columnas destino.
  for (const { table, cols } of PLAN) {
    const colList = cols.join(', ')
    const dup = await c.execute(
      `SELECT ${colList}, COUNT(*) n FROM ${table} GROUP BY ${colList} HAVING COUNT(*) > 1`
    )
    if (dup.rows.length) {
      console.error(`❌ ABORTADO: ${table} tiene duplicados (${colList}) — no se toca nada:`)
      dup.rows.forEach((r) => console.error(`   ${cols.map((col) => `${col}=${r[col]}`).join(' ')} x${r.n}`))
      process.exit(1)
    }
  }

  // 2) Reemplazar el índice único global por el compuesto con workspace_id.
  for (const { table, oldIdx, newIdx, cols } of PLAN) {
    await c.execute(`DROP INDEX IF EXISTS ${oldIdx}`)
    await c.execute(`CREATE UNIQUE INDEX IF NOT EXISTS ${newIdx} ON ${table}(${cols.join(', ')})`)
    console.log(`✅ ${table}: -${oldIdx}  +${newIdx}(${cols.join(', ')})`)
  }
  process.exit(0)
})().catch((e) => {
  console.error('❌ Fallo:', e)
  process.exit(1)
})

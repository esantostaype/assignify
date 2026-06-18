// scripts/backfill-workspace.js  [SaaS fase 2]
// Rellena workspace_id en las tablas de config con el workspace de Inszone (el del
// CLICKUP_API_TOKEN global actual). Se corre UNA vez tras agregar las columnas.
// Imprime el id del workspace para que lo pongas en DEFAULT_WORKSPACE_ID.
require('dotenv/config')
const { createClient } = require('@libsql/client')

const TABLES = ['user', 'task_type', 'tier_list', 'brand', 'system_settings', 'task_meta']

async function getInszoneTeamId() {
  const token = process.env.CLICKUP_API_TOKEN
  if (!token) throw new Error('CLICKUP_API_TOKEN no configurado')
  const res = await fetch('https://api.clickup.com/api/v2/team', {
    headers: { Authorization: token },
  })
  if (!res.ok) throw new Error(`ClickUp /team respondió ${res.status}`)
  const data = await res.json()
  const team = data?.teams?.[0]
  if (!team) throw new Error('No se encontró ningún workspace para el token')
  return { id: String(team.id), name: team.name }
}

;(async () => {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  // Si se pasa un id explícito (recomendado), se usa ese y se SOBREESCRIBEN todas
  // las filas (modo migración, corrige valores previos). Si no, deriva del token.
  const explicit = process.argv[2]
  let id, name
  if (explicit) {
    id = explicit
    name = '(id explícito)'
  } else {
    ;({ id, name } = await getInszoneTeamId())
  }
  console.log(`Workspace destino: ${name} (id ${id})`)

  for (const table of TABLES) {
    try {
      const r = await client.execute({
        sql: explicit
          ? `UPDATE ${table} SET workspace_id = ?`
          : `UPDATE ${table} SET workspace_id = ? WHERE workspace_id IS NULL`,
        args: [id],
      })
      console.log(`  ${table}: ${r.rowsAffected} filas backfilled`)
    } catch (e) {
      console.error(`  ${table}: ERROR`, e.message)
    }
  }

  console.log(`\n✅ Backfill listo. Pon en tu .env (y en Vercel):  DEFAULT_WORKSPACE_ID=${id}`)
  process.exit(0)
})().catch((e) => {
  console.error('❌ Backfill falló:', e)
  process.exit(1)
})

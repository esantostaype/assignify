// Migración puntual: añade user_role.is_primary (cargo primario/secundario).
// ADD COLUMN con default 0 (false): no destructivo, las filas existentes
// quedan como secundarias. Idempotente. Lee credenciales de .env (process.env).
import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const info = await client.execute('PRAGMA table_info(user_role)')
const exists = info.rows.some((r) => r.name === 'is_primary')

if (exists) {
  console.log('OK: la columna is_primary ya existe, nada que hacer.')
} else {
  await client.execute(
    'ALTER TABLE user_role ADD COLUMN is_primary integer NOT NULL DEFAULT 0'
  )
  console.log('OK: columna is_primary añadida (default 0 = secundario).')
}

const count = await client.execute('SELECT COUNT(*) AS n FROM user_role')
console.log(`user_role tiene ${count.rows[0].n} filas (intactas).`)
client.close()

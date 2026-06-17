// src/db/index.ts — cliente Drizzle sobre Turso (libSQL).
// Init perezoso: el cliente se crea en el primer uso, no al importar, para que el
// build no falle si las variables aún no están configuradas.
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

type DB = LibSQLDatabase<typeof schema>

const globalForDb = globalThis as unknown as { __db?: DB }

function createDb(): DB {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) throw new Error('TURSO_DATABASE_URL no está configurado')
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  const instance = drizzle(client, { schema })
  if (process.env.NODE_ENV !== 'production') globalForDb.__db = instance
  return instance
}

function getDb(): DB {
  return globalForDb.__db ?? createDb()
}

// Proxy transparente: `db.select()...` funciona igual, pero el cliente real solo
// se instancia cuando se ejecuta la primera consulta.
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

export { schema }

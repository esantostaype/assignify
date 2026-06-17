// src/db/index.ts — cliente Drizzle sobre Turso (libSQL).
// Init perezoso: el cliente se crea en el primer uso, no al importar, para que el
// build no falle si las variables aún no están configuradas.
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

type DB = LibSQLDatabase<typeof schema>

// IMPORTANTE: NO reutilizar el cliente entre llamadas. libSQL es HTTP (stateless),
// así que recrearlo es barato y NO acumula conexiones. Un cliente de LARGA VIDA
// (el que antes se cacheaba en globalThis durante el dev server) devolvía
// RESULTADOS RANCIOS para ciertas consultas (p.ej. SELECT sin WHERE y queries
// relacionales `with`): el modal/tarjeta mostraban nivel/roles/vacaciones viejos
// aunque la DB estuviera correcta. Un cliente FRESCO por operación siempre lee el
// estado actual. (En producción ya se comportaba así; esto alinea el dev.)
function getDb(): DB {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) throw new Error('TURSO_DATABASE_URL no está configurado')
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  return drizzle(client, { schema })
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

// scripts/seed-auth-user.js
// Crea (o actualiza la contraseña de) un usuario que puede INICIAR SESIÓN en
// Assignify. La contraseña se guarda hasheada con bcrypt; nunca en claro.
//
// Uso (lee .env para TURSO_*):
//   ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='UnaClaveFuerte' node scripts/seed-auth-user.js
//   o:  node scripts/seed-auth-user.js tu@correo.com 'UnaClaveFuerte' "Tu Nombre"
require('dotenv/config')
const { createClient } = require('@libsql/client')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || process.argv[3] || ''
const name = process.env.ADMIN_NAME || process.argv[4] || null

if (!email || !password) {
  console.error("Falta email/contraseña.\n  ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/seed-auth-user.js")
  process.exit(1)
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.')
  process.exit(1)
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

;(async () => {
  const hash = await bcrypt.hash(password, 12)
  const now = Date.now()

  const existing = await client.execute({
    sql: 'SELECT id FROM auth_user WHERE email = ?',
    args: [email],
  })

  if (existing.rows.length > 0) {
    await client.execute({
      sql: 'UPDATE auth_user SET password_hash = ?, name = COALESCE(?, name), active = 1, updated_at = ? WHERE email = ?',
      args: [hash, name, now, email],
    })
    console.log(`✅ Usuario actualizado: ${email}`)
  } else {
    await client.execute({
      sql: 'INSERT INTO auth_user (id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      args: [crypto.randomUUID(), email, hash, name, 'admin', now, now],
    })
    console.log(`✅ Usuario creado: ${email}`)
  }
  process.exit(0)
})().catch((e) => {
  console.error('❌ Error sembrando el usuario:', e)
  process.exit(1)
})

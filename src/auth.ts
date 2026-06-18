// src/auth.ts
// Config COMPLETA de Auth.js (runtime Node): añade el provider de credenciales que
// valida contra Turso con bcrypt. No importar en el middleware (no es edge-safe).
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'
import { db } from '@/db'
import { authUser } from '@/db/schema'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const u = await db.query.authUser.findFirst({
          where: eq(authUser.email, email),
        })
        if (!u || !u.active) return null

        const ok = await bcrypt.compare(password, u.passwordHash)
        if (!ok) return null

        return { id: u.id, email: u.email, name: u.name ?? undefined, role: u.role }
      },
    }),
  ],
})

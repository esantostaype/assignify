// src/auth.ts
// Config COMPLETA de Auth.js (runtime Node): providers de credenciales (email/pass)
// y de ClickUp OAuth (modo SaaS, fase 1). No importar en el middleware (no es
// edge-safe: usa bcrypt, DB y node:crypto).
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { OAuthConfig } from 'next-auth/providers'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'
import { db } from '@/db'
import { authUser, clickupConnection } from '@/db/schema'
import { encryptSecret } from '@/lib/crypto'

// Perfil que devuelve GET https://api.clickup.com/api/v2/user → { user: {...} }.
interface ClickUpProfile {
  user: {
    id: number | string
    username?: string
    email?: string
    color?: string
    profilePicture?: string | null
  }
}

// Provider OAuth custom de ClickUp (no es OIDC). Endpoints confirmados en los docs:
//   authorize: https://app.clickup.com/api?client_id&redirect_uri&state
//   token:     POST https://api.clickup.com/api/v2/oauth/token  (client_id/secret/code en body)
//   user:      GET  https://api.clickup.com/api/v2/user         (Authorization: Bearer)
// El token de ClickUp NO expira. Requiere AUTH_CLICKUP_ID / AUTH_CLICKUP_SECRET.
const ClickUpProvider: OAuthConfig<ClickUpProfile> = {
  id: 'clickup',
  name: 'ClickUp',
  type: 'oauth',
  authorization: { url: 'https://app.clickup.com/api', params: {} },
  token: 'https://api.clickup.com/api/v2/oauth/token',
  userinfo: 'https://api.clickup.com/api/v2/user',
  clientId: process.env.AUTH_CLICKUP_ID,
  clientSecret: process.env.AUTH_CLICKUP_SECRET,
  checks: ['state'],
  profile(profile) {
    const u = profile.user
    return {
      id: String(u.id),
      name: u.username ?? u.email ?? String(u.id),
      email: u.email ?? null,
      image: u.profilePicture ?? null,
    }
  },
}

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

        const u = await db.query.authUser.findFirst({ where: eq(authUser.email, email) })
        if (!u || !u.active) return null

        const ok = await bcrypt.compare(password, u.passwordHash)
        if (!ok) return null

        return { id: u.id, email: u.email, name: u.name ?? undefined, role: u.role }
      },
    }),
    ClickUpProvider,
  ],
  events: {
    // Al iniciar sesión con ClickUp, persistimos el token (CIFRADO) por usuario.
    // Es la base del modo multi-inquilino (fase 3 lo usará para llamar a ClickUp
    // con el token de cada quien). Side-effect: no altera el JWT.
    async signIn({ account, user, profile }) {
      if (account?.provider !== 'clickup' || !account.access_token || !user?.id) return
      const token = account.access_token
      const cu = (profile as ClickUpProfile | undefined)?.user
      const enc = encryptSecret(token)
      const now = new Date()

      // Workspace activo: consultamos los workspaces autorizados del usuario y
      // guardamos el primero (un picker para multi-workspace es fase posterior).
      // Si falla, NO bloqueamos el login; el workspace se completará luego.
      let workspaceId: string | null = null
      let workspaceName: string | null = null
      try {
        const res = await fetch('https://api.clickup.com/api/v2/team', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = (await res.json()) as { teams?: { id: string | number; name?: string }[] }
          const team = data.teams?.[0]
          if (team) {
            workspaceId = String(team.id)
            workspaceName = team.name ?? null
          }
        }
      } catch {
        /* sin bloquear el login */
      }

      await db
        .insert(clickupConnection)
        .values({
          clickupUserId: user.id,
          email: cu?.email ?? user.email ?? null,
          username: cu?.username ?? user.name ?? null,
          accessTokenEnc: enc,
          workspaceId,
          workspaceName,
        })
        .onConflictDoUpdate({
          target: clickupConnection.clickupUserId,
          set: {
            accessTokenEnc: enc,
            email: cu?.email ?? user.email ?? null,
            username: cu?.username ?? user.name ?? null,
            // Solo sobreescribe el workspace si lo pudimos resolver ahora.
            ...(workspaceId ? { workspaceId, workspaceName } : {}),
            updatedAt: now,
          },
        })
    },
  },
})

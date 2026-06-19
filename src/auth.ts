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
import { ensureWorkspaceWebhook } from '@/lib/workspace-webhook'

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

      // Workspaces autorizados: traemos TODOS los teams del usuario (el selector
      // multi-workspace los lista). Si el fetch falla, NO bloqueamos el login: la
      // lista se completará en el próximo acceso.
      let workspaces: { id: string; name: string | null }[] = []
      try {
        const res = await fetch('https://api.clickup.com/api/v2/team', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = (await res.json()) as { teams?: { id: string | number; name?: string }[] }
          workspaces = (data.teams ?? []).map((t) => ({ id: String(t.id), name: t.name ?? null }))
        }
      } catch {
        /* sin bloquear el login */
      }

      // Activo: si ya había uno elegido y sigue entre los autorizados, lo
      // respetamos (no pisamos la elección del usuario); si no, el primero.
      const existing = await db.query.clickupConnection.findFirst({
        where: eq(clickupConnection.clickupUserId, user.id),
      })
      const prevActive = existing?.workspaceId ?? null
      const active =
        (prevActive ? workspaces.find((w) => w.id === prevActive) : undefined) ?? workspaces[0]
      const workspaceId = active?.id ?? prevActive
      const workspaceName = active?.name ?? existing?.workspaceName ?? null

      await db
        .insert(clickupConnection)
        .values({
          clickupUserId: user.id,
          email: cu?.email ?? user.email ?? null,
          username: cu?.username ?? user.name ?? null,
          accessTokenEnc: enc,
          workspaceId,
          workspaceName,
          workspaces: workspaces.length ? workspaces : null,
        })
        .onConflictDoUpdate({
          target: clickupConnection.clickupUserId,
          set: {
            accessTokenEnc: enc,
            email: cu?.email ?? user.email ?? null,
            username: cu?.username ?? user.name ?? null,
            // Activo resuelto (preserva el previo si sigue disponible).
            ...(workspaceId ? { workspaceId, workspaceName } : {}),
            // Lista completa: solo si la trajimos ahora (no la borramos si falló el fetch).
            ...(workspaces.length ? { workspaces } : {}),
            updatedAt: now,
          },
        })

      // Registrar (idempotente, best-effort) el webhook de cada workspace autorizado
      // para que ClickUp notifique sus cambios. Solo actúa si hay WEBHOOK_PUBLIC_URL
      // (prod); si falla, no bloquea el login.
      await Promise.allSettled(workspaces.map((w) => ensureWorkspaceWebhook(w.id, token)))
    },
  },
})

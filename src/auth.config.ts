// src/auth.config.ts
// Config de Auth.js EDGE-SAFE: solo lo que el middleware necesita para validar la
// sesión (JWT) y decidir acceso. NO importa DB ni bcrypt — el provider de
// credenciales (que sí toca DB) vive en auth.ts y solo corre en el runtime Node.
import type { NextAuthConfig } from 'next-auth'

// Rutas accesibles SIN sesión:
//   /login           → la propia pantalla de login
//   /api/auth/*       → endpoints de Auth.js (signin/callback/session/csrf…)
//   /api/clickup-webhook, /api/cron/* → servicios externos con su PROPIO secreto
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/guide' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/clickup-webhook') ||
    pathname.startsWith('/api/cron')
  )
}

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    // Protección en el EDGE: todo requiere sesión salvo las rutas públicas.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      if (isPublicPath(nextUrl.pathname)) return true
      return isLoggedIn // false → Auth.js redirige a pages.signIn (/login)
    },
    // Propaga id/role al token y a la sesión.
    jwt({ token, user, account }) {
      if (user) {
        // ClickUp OAuth: usar el id ESTABLE de ClickUp (account.providerAccountId).
        // Sin adapter de DB, Auth.js genera un user.id efímero (UUID) distinto en
        // cada login; usarlo creaba una clickup_connection nueva cada vez. Para
        // credenciales se mantiene el id de authUser.
        token.id =
          account?.provider === 'clickup' && account.providerAccountId
            ? account.providerAccountId
            : (user.id as string)
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? ''
        session.user.role = token.role as string | undefined
      }
      return session
    },
  },
  providers: [], // Los providers reales se añaden en auth.ts (runtime Node).
} satisfies NextAuthConfig

// src/middleware.ts
// Protección de rutas en el EDGE. Dos mundos INDEPENDIENTES:
//   1) /hugeicons/*  → login PROPIO (username/password del .env → cookie de sesión).
//   2) el resto      → Auth.js (config edge-safe; público pasa, no-público sin sesión →
//                      /login). El login principal sigue igual.
import NextAuth from 'next-auth'
import { authConfig, isPublicPath } from '@/auth.config'
import { NextResponse, type NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

// Cookie de la sesión propia de Hugeicons (mismo nombre que /api/hugeicons/login; se repite
// aquí a propósito para NO importar ese route y arrastrar node:crypto al runtime Edge).
const HUGEICONS_COOKIE = 'hugeicons_session'

function isHugeiconsPath(pathname: string): boolean {
  return (
    pathname === '/hugeicons' ||
    pathname.startsWith('/hugeicons/') ||
    pathname.startsWith('/api/hugeicons')
  )
}

// Guard INDEPENDIENTE de Hugeicons (no usa Auth.js). Deja pasar la pantalla de login y sus
// endpoints; el resto exige la cookie de sesión (== HUGEICONS_SESSION_TOKEN del .env).
function hugeiconsGuard(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  if (pathname === '/hugeicons/login' || pathname.startsWith('/api/hugeicons')) {
    return NextResponse.next()
  }
  const token = req.cookies.get(HUGEICONS_COOKIE)?.value
  const expected = process.env.HUGEICONS_SESSION_TOKEN
  if (expected && token === expected) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/hugeicons/login'
  url.search = ''
  return NextResponse.redirect(url)
}

// Wrapper de Auth.js: `req.auth` trae la sesión ya resuelta en el Edge. En runtime el `req`
// ES el NextRequest de Next; los tipos de next-auth no lo exponen completo, así que lo
// tratamos como NextRequest para leer nextUrl/cookies.
export default auth((req) => {
  const r = req as unknown as NextRequest
  const { pathname } = r.nextUrl
  // 1) /hugeicons tiene su PROPIO login → se resuelve antes de tocar Auth.js.
  if (isHugeiconsPath(pathname)) return hugeiconsGuard(r)
  // 2) Resto de la app: público pasa; no-público sin sesión → /login.
  if (isPublicPath(pathname)) return NextResponse.next()
  if (req.auth) return NextResponse.next()
  const url = r.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
})

export const config = {
  // Corre en todo MENOS estáticos de Next y archivos de /public (imágenes, etc.).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}

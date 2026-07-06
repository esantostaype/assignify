import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { HUGEICONS_COOKIE } from '@/lib/hugeicons-auth'

// Login propio de Hugeicons (independiente de Auth.js). Verifica username/password contra
// el .env y, si coinciden, setea la cookie de sesión que el middleware valida.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Comparación en tiempo constante (evita fugas por timing). Longitudes distintas → false.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: unknown
    password?: unknown
  }

  // .trim() en las vars del .env: en Windows los valores suelen arrastrar un \r (CRLF) o
  // espacios al final que romperían la comparación exacta byte-a-byte.
  const envUser = process.env.HUGEICONS_USER?.trim()
  const envPass = process.env.HUGEICONS_PASSWORD?.trim()
  const token = process.env.HUGEICONS_SESSION_TOKEN?.trim()

  if (!envUser || !envPass || !token) {
    return NextResponse.json(
      { error: 'Hugeicons login is not configured on the server.' },
      { status: 500 }
    )
  }

  const inUser = typeof body.username === 'string' ? body.username.trim() : ''
  const inPass = typeof body.password === 'string' ? body.password : ''
  const okUser = safeEqual(inUser, envUser)
  const okPass = safeEqual(inPass, envPass)
  if (!okUser || !okPass) {
    // Diagnóstico SIN exponer secretos (solo presencia + longitudes) — temporal, para
    // ver en los logs del server si el mismatch es de usuario o de contraseña.
    console.warn('[hugeicons-login] mismatch', {
      userOk: okUser,
      passOk: okPass,
      envUserLen: envUser.length,
      inUserLen: inUser.length,
      envPassLen: envPass.length,
      inPassLen: inPass.length,
    })
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(HUGEICONS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  })
  return res
}

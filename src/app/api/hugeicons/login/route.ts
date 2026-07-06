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

  const envUser = process.env.HUGEICONS_USER
  const envPass = process.env.HUGEICONS_PASSWORD
  const token = process.env.HUGEICONS_SESSION_TOKEN

  if (!envUser || !envPass || !token) {
    return NextResponse.json(
      { error: 'Hugeicons login is not configured on the server.' },
      { status: 500 }
    )
  }

  const okUser = typeof body.username === 'string' && safeEqual(body.username, envUser)
  const okPass = typeof body.password === 'string' && safeEqual(body.password, envPass)
  if (!okUser || !okPass) {
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

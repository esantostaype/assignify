import { NextResponse } from 'next/server'
import { HUGEICONS_COOKIE } from '../login/route'

// Cierra la sesión propia de Hugeicons borrando su cookie.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(HUGEICONS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

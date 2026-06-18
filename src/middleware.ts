// src/middleware.ts
// Protección de rutas en el EDGE: usa la config edge-safe (sin DB/bcrypt). El
// callback `authorized` (en auth.config) decide qué pasa. Cualquier ruta no pública
// sin sesión → redirige a /login.
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  // Corre en todo MENOS estáticos de Next y archivos de /public (imágenes, etc.).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}

// src/types/next-auth.d.ts
// Augmenta los tipos de Auth.js para llevar `id` y `role` en la sesión y el token.
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: string
    } & DefaultSession['user']
  }
  interface User {
    role?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
  }
}

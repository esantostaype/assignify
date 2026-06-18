// src/app/api/auth/[...nextauth]/route.ts
// Endpoints de Auth.js (signin/callback/session/csrf/signout). Toca DB+bcrypt → Node.
import { handlers } from '@/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const { GET, POST } = handlers

// Nombre de la cookie de la sesión PROPIA de Hugeicons. Vive aquí (no en un route) para que
// los route handlers y el middleware (Edge) la compartan: Next.js rechaza exports que no sean
// campos válidos de Route (GET/POST/runtime/…) dentro de un route.ts. Es solo un string, así
// que es edge-safe (no arrastra node:crypto ni nada de Node).
export const HUGEICONS_COOKIE = 'hugeicons_session'

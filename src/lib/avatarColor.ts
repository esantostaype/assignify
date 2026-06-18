// Color de fondo para el avatar de un usuario.
// Usa el color real (de ClickUp) cuando existe; si viene vacío (el usuario no
// tiene color asignado en ClickUp), genera uno determinista a partir del seed
// (id) para que cada persona tenga un color consistente y distinto.
export function avatarColor(color: string | undefined | null, seed: string): string {
  if (color && color.trim()) return color
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`
}

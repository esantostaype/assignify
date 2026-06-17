// src/components/designers/designerUtils.ts
// Utilidades de CLIENTE para la vista de diseñadores (solo presentación).
// No importa nada de @/db ni código solo-servidor: seguro para "use client".
import type { RoleDetail, UserLevel } from '@/hooks/queries/useWorkload'

// Etiquetas legibles del nivel del diseñador.
const LEVEL_LABEL: Record<UserLevel, string> = {
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
}

export function levelLabel(level?: UserLevel | null): string | null {
  if (!level) return null
  return LEVEL_LABEL[level] ?? null
}

/**
 * Deriva el TÍTULO del puesto a partir del nombre del tipo de cargo:
 * - termina en "Design"   → cámbialo a "Designer" (p.ej. "Graphic Design" → "Graphic Designer")
 * - termina en "Designer" → déjalo tal cual
 * - en otro caso          → deja el nombre sin cambios
 */
export function typeToJobTitle(name: string): string {
  const trimmed = name.trim()
  if (trimmed.endsWith('Designer')) return trimmed
  if (trimmed.endsWith('Design')) return `${trimmed.slice(0, -'Design'.length).trim()} Designer`
  return trimmed
}

/**
 * Cargo primario del diseñador (isPrimary=true); si no hay primario, el primer
 * cargo. Devuelve null si no tiene cargos.
 */
export function primaryRole(roleDetails: RoleDetail[]): RoleDetail | null {
  if (!roleDetails || roleDetails.length === 0) return null
  return roleDetails.find((r) => r.isPrimary) ?? roleDetails[0]
}

// src/components/team/memberUtils.ts
// Utilidades de CLIENTE para la vista del equipo (solo presentación).
// No importa nada de @/db ni código solo-servidor: seguro para "use client".
import type { RoleDetail, UserLevel } from '@/hooks/queries/useWorkload'

// Etiquetas legibles del nivel del miembro.
const LEVEL_LABEL: Record<UserLevel, string> = {
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
}

export function levelLabel(level?: UserLevel | null): string | null {
  if (!level) return null
  return LEVEL_LABEL[level] ?? null
}

/** Título del puesto = nombre del tipo de cargo, tal cual (cada workspace lo define). */
export function typeToJobTitle(name: string): string {
  return name.trim()
}

/**
 * Cargo primario del miembro (isPrimary=true); si no hay primario, el primer
 * cargo. Devuelve null si no tiene cargos.
 */
export function primaryRole(roleDetails: RoleDetail[]): RoleDetail | null {
  if (!roleDetails || roleDetails.length === 0) return null
  return roleDetails.find((r) => r.isPrimary) ?? roleDetails[0]
}

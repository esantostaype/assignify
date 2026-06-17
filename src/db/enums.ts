// src/db/enums.ts — Enums del dominio (antes venían de @prisma/client).
// Cada enum se expone como objeto-valor Y como tipo, igual que generaba Prisma,
// para no tocar el código que usa `Status.TO_DO` o el tipo `Priority`.

export const Status = {
  TO_DO: 'TO_DO',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_APPROVAL: 'ON_APPROVAL',
  COMPLETE: 'COMPLETE',
} as const
export type Status = (typeof Status)[keyof typeof Status]

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const
export type Priority = (typeof Priority)[keyof typeof Priority]

export const Tier = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
} as const
export type Tier = (typeof Tier)[keyof typeof Tier]

// Nivel del diseñador. Determina el escalado de asignación: una tarea solo se
// asigna en automático a diseñadores de nivel IGUAL o SUPERIOR al solicitado.
export const Level = {
  JUNIOR: 'JUNIOR',
  MID: 'MID',
  SENIOR: 'SENIOR',
} as const
export type Level = (typeof Level)[keyof typeof Level]

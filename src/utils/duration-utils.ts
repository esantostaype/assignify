export const formatDaysToReadable = (days: number): string => {
  if (days === 0) return "0 hours"
  
  const fullDays = Math.floor(days)
  const remainingHours = Math.round((days - fullDays) * 8)
  
  // Casos especiales
  if (fullDays === 0) {
    return remainingHours === 1 ? "1 hour" : `${remainingHours} hours`
  }
  
  if (remainingHours === 0) {
    return fullDays === 1 ? "1 day" : `${fullDays} days`
  }
  
  const dayText = fullDays === 1 ? "day" : "days"
  const hourText = remainingHours === 1 ? "hour" : "hours"
  
  return `${fullDays} ${dayText} ${remainingHours} ${hourText}`
}

export const formatDaysToCompact = (days: number): string => {
  if (days === 0) return "0h"

  const fullDays = Math.floor(days)
  const remainingHours = Math.round((days - fullDays) * 8)

  if (fullDays === 0) {
    return `${remainingHours}h`
  }

  if (remainingHours === 0) {
    return `${fullDays}d`
  }

  return `${fullDays}d ${remainingHours}h`
}

// ─────────────────────────────────────────────────────────────────────────────
// [SaaS] Unidad de duración POR WORKSPACE (días/horas/minutos). La duración se
// guarda y viaja SIEMPRE en "días base" (lo que usa el motor: 1 día = 8 h = 480 min);
// la unidad es solo para EDITAR y MOSTRAR. Conversión en los bordes UI ↔ días base.
export type DurationUnit = 'days' | 'hours' | 'minutes'
export const DURATION_UNITS: DurationUnit[] = ['days', 'hours', 'minutes']

const HOURS_PER_DAY = 8
const MINUTES_PER_DAY = HOURS_PER_DAY * 60

/** Valor en la unidad dada → "días base" (lo que consume el motor). */
export const unitToDays = (value: number, unit: DurationUnit): number => {
  if (unit === 'hours') return value / HOURS_PER_DAY
  if (unit === 'minutes') return value / MINUTES_PER_DAY
  return value
}

/** "Días base" → valor en la unidad dada (para editar/mostrar). */
export const daysToUnit = (days: number, unit: DurationUnit): number => {
  if (unit === 'hours') return days * HOURS_PER_DAY
  if (unit === 'minutes') return days * MINUTES_PER_DAY
  return days
}

/** Etiqueta singular/plural de la unidad para una cantidad. */
export const unitLabel = (value: number, unit: DurationUnit): string => {
  const one = Math.abs(value) === 1
  if (unit === 'hours') return one ? 'hour' : 'hours'
  if (unit === 'minutes') return one ? 'minute' : 'minutes'
  return one ? 'day' : 'days'
}

/** Formatea una duración (en días base) en la unidad del workspace. */
export const formatDuration = (days: number, unit: DurationUnit): string => {
  if (unit === 'days') return formatDaysToReadable(days)
  const value = Math.round(daysToUnit(days, unit) * 100) / 100 // evita 29.999…
  return `${value} ${unitLabel(value, unit)}`
}
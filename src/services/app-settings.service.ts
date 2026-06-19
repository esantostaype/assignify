// src/services/app-settings.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Servicio SOLO-SERVIDOR que lee la configuración del motor desde Turso
// (tabla system_settings) y la entrega ya normalizada para el motor de
// asignación. Reemplaza la lectura directa de las constantes de @/config:
// ahora esas constantes solo se usan como FALLBACK si la DB falla o falta un
// valor.
//
// IMPORTANTE: NO importar este módulo desde componentes "use client" (arrastra
// @/db / @libsql al bundle de cliente). Úsalo solo en rutas API y servicios.
//
// El usuario edita el horario en HORA LOCAL (Perú) y el sistema lo convierte a
// UTC. La conversión es: utcHour = localHour - utcOffsetHours.
//   Con utc_offset_hours = -5 (Perú):
//     START       = 10 - (-5) = 15
//     LUNCH_START = 14 - (-5) = 19
//     LUNCH_END   = (14 + 1) - (-5) = 20
//     END         = 19 - (-5) = 24
//   (Coincide con los valores UTC hardcodeados que usaba el motor.)
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { getFromCache, setInCache, deleteFromCache, invalidateCacheByPrefix } from '@/utils/cache';
import { WORK_HOURS, TASK_ASSIGNMENT_THRESHOLDS } from '@/config';

export interface AppWorkHours {
  /** Inicio de jornada (UTC). */
  START: number;
  /** Inicio del almuerzo (UTC). */
  LUNCH_START: number;
  /** Fin del almuerzo (UTC). */
  LUNCH_END: number;
  /** Fin de jornada (UTC). */
  END: number;
}

export interface AppThresholds {
  DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST: number;
  NORMAL_TASKS_BEFORE_LOW_THRESHOLD: number;
  CONSECUTIVE_LOW_TASKS_THRESHOLD: number;
}

export interface AppSettings {
  /** Horario laboral YA convertido a UTC. */
  workHours: AppWorkHours;
  thresholds: AppThresholds;
  /** Días para escalar de nivel (umbral nuevo). */
  levelEscalationDays: number;
}

// Defaults a partir de las constantes de @/config + el nuevo umbral.
// Se usan cuando la DB falla o falta algún valor.
const FALLBACK_SETTINGS: AppSettings = {
  workHours: { ...WORK_HOURS },
  thresholds: { ...TASK_ASSIGNMENT_THRESHOLDS },
  levelEscalationDays: 3,
};

const CACHE_KEY = 'app-settings:engine';
const CACHE_TTL_SECONDS = 60;

/** Normaliza una hora a [0, 24]; mantiene 24 (fin de jornada) tal cual. */
function normalizeHour(hour: number): number {
  if (hour === 24) return 24;
  const mod = ((hour % 24) + 24) % 24;
  return mod;
}

/** Convierte una hora local a UTC: utcHour = localHour - utcOffsetHours. */
function localToUtc(localHour: number, utcOffsetHours: number): number {
  return normalizeHour(localHour - utcOffsetHours);
}

interface SettingRow {
  category: string;
  key: string;
  // value es JSON: puede venir como number, string, etc.
  value: unknown;
}

/** Busca un setting numérico; si falta o no es número, devuelve el fallback. */
function readNumber(
  rows: SettingRow[],
  category: string,
  key: string,
  fallback: number
): number {
  const row = rows.find((r) => r.category === category && r.key === key);
  if (!row) return fallback;
  const num = typeof row.value === 'number' ? row.value : Number(row.value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Lee la configuración del motor desde Turso (cacheada ~60s en memoria) y la
 * entrega ya tipada y con el horario convertido a UTC. Ante cualquier fallo
 * (DB caída, tabla vacía, valores ausentes) usa los defaults de @/config.
 */
export async function getAppSettings(workspaceId?: string | null): Promise<AppSettings> {
  const cacheKey = `${CACHE_KEY}:${workspaceId ?? 'global'}`;
  const cached = getFromCache<AppSettings>(cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Acotado al workspace cuando se pasa; si no, comportamiento legacy (todas las filas).
    const rows = (workspaceId
      ? await db.query.systemSettings.findMany({ where: eq(systemSettings.workspaceId, workspaceId) })
      : await db.query.systemSettings.findMany()) as SettingRow[];

    // Si la tabla está vacía, devolvemos fallback (el endpoint /api/settings la
    // seedea en su primer GET). No cacheamos el fallback para reintentar pronto.
    if (rows.length === 0) {
      return FALLBACK_SETTINGS;
    }

    // ── work_schedule (en HORA LOCAL) → UTC ──────────────────────────────────
    const utcOffset = readNumber(rows, 'work_schedule', 'utc_offset_hours', -5);
    const startLocal = readNumber(rows, 'work_schedule', 'start_hour_local', 10);
    const lunchStartLocal = readNumber(rows, 'work_schedule', 'lunch_start_local', 14);
    const lunchDuration = readNumber(rows, 'work_schedule', 'lunch_duration_hours', 1);
    const endLocal = readNumber(rows, 'work_schedule', 'end_hour_local', 19);

    const workHours: AppWorkHours = {
      START: localToUtc(startLocal, utcOffset),
      LUNCH_START: localToUtc(lunchStartLocal, utcOffset),
      LUNCH_END: localToUtc(lunchStartLocal + lunchDuration, utcOffset),
      END: localToUtc(endLocal, utcOffset),
    };

    // ── task_assignment ──────────────────────────────────────────────────────
    const thresholds: AppThresholds = {
      DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST: readNumber(
        rows,
        'task_assignment',
        'deadline_difference_to_force_generalist',
        TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST
      ),
      NORMAL_TASKS_BEFORE_LOW_THRESHOLD: readNumber(
        rows,
        'task_assignment',
        'normal_tasks_before_low',
        TASK_ASSIGNMENT_THRESHOLDS.NORMAL_TASKS_BEFORE_LOW_THRESHOLD
      ),
      CONSECUTIVE_LOW_TASKS_THRESHOLD: readNumber(
        rows,
        'task_assignment',
        'consecutive_low_tasks',
        TASK_ASSIGNMENT_THRESHOLDS.CONSECUTIVE_LOW_TASKS_THRESHOLD
      ),
    };

    const levelEscalationDays = readNumber(
      rows,
      'task_assignment',
      'level_escalation_days',
      FALLBACK_SETTINGS.levelEscalationDays
    );

    const settings: AppSettings = { workHours, thresholds, levelEscalationDays };
    setInCache(cacheKey, settings, CACHE_TTL_SECONDS);
    return settings;
  } catch (error) {
    console.error('getAppSettings: failed to read system_settings, using @/config fallback:', error);
    return FALLBACK_SETTINGS;
  }
}

/** Invalida la caché en memoria de la config del motor (de un workspace, o todas). */
export function invalidateAppSettingsCache(workspaceId?: string | null): void {
  if (workspaceId !== undefined) {
    deleteFromCache(`${CACHE_KEY}:${workspaceId ?? 'global'}`);
  } else {
    invalidateCacheByPrefix(`${CACHE_KEY}:`);
  }
}

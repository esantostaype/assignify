// src/config/settings-catalog.ts
// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO de la configuración del motor que vive en Turso (system_settings).
// Lo consumen /api/settings (GET seedea si la tabla está vacía) y
// /api/settings/reset (POST borra y recrea con estos valores).
//
// El usuario edita el HORARIO en HORA LOCAL (Perú). El servicio
// app-settings.service.ts lo convierte a UTC para el motor:
//   utcHour = localHour - utc_offset_hours.
// Con utc_offset_hours = -5 los valores UTC resultantes (START=15, LUNCH_START=19,
// LUNCH_END=20, END=24) coinciden con los que el motor usaba hardcodeados.

export interface SettingDefinition {
  category: string;
  key: string;
  value: number | string;
  dataType: 'number' | 'string' | 'boolean';
  label: string;
  description: string;
  group: string;
  order: number;
  minValue?: number;
  maxValue?: number;
  required: boolean;
}

export const DEFAULT_SETTINGS: SettingDefinition[] = [
  // ── Horario laboral (HORA LOCAL — Perú) ─────────────────────────────────────
  {
    category: 'work_schedule',
    key: 'start_hour_local',
    value: 10,
    dataType: 'number',
    label: 'Workday start (local time)',
    description: 'Local time when the workday starts (24h format)',
    group: 'work_schedule',
    order: 1,
    minValue: 0,
    maxValue: 23,
    required: true,
  },
  {
    category: 'work_schedule',
    key: 'lunch_start_local',
    value: 14,
    dataType: 'number',
    label: 'Lunch start (local time)',
    description: 'Local time when lunch starts (24h format)',
    group: 'work_schedule',
    order: 2,
    minValue: 0,
    maxValue: 23,
    required: true,
  },
  {
    category: 'work_schedule',
    key: 'lunch_duration_hours',
    value: 1,
    dataType: 'number',
    label: 'Lunch duration (hours)',
    description: 'Lunch duration in hours',
    group: 'work_schedule',
    order: 3,
    minValue: 0.5,
    maxValue: 4,
    required: true,
  },
  {
    category: 'work_schedule',
    key: 'end_hour_local',
    value: 19,
    dataType: 'number',
    label: 'Workday end (local time)',
    description: 'Local time when the workday ends (24h format)',
    group: 'work_schedule',
    order: 4,
    minValue: 0,
    maxValue: 24,
    required: true,
  },
  {
    category: 'work_schedule',
    key: 'utc_offset_hours',
    value: -5,
    dataType: 'number',
    label: 'Timezone offset (hours)',
    description: 'Difference of the local timezone relative to UTC (Peru = -5)',
    group: 'work_schedule',
    order: 5,
    minValue: -12,
    maxValue: 14,
    required: true,
  },

  // ── Asignación de tareas ────────────────────────────────────────────────────
  {
    category: 'task_assignment',
    key: 'deadline_difference_to_force_generalist',
    value: 10,
    dataType: 'number',
    label: 'Difference to force generalist (days)',
    description:
      'If the specialist frees up this many days later than the generalist, the task is assigned to the generalist',
    group: 'task_assignment',
    order: 1,
    minValue: 1,
    maxValue: 60,
    required: true,
  },
  {
    category: 'task_assignment',
    key: 'normal_tasks_before_low',
    value: 5,
    dataType: 'number',
    label: 'Normal tasks before a low one',
    description: 'Number of NORMAL tasks before placing a LOW priority one',
    group: 'task_assignment',
    order: 2,
    minValue: 1,
    maxValue: 20,
    required: true,
  },
  {
    category: 'task_assignment',
    key: 'consecutive_low_tasks',
    value: 4,
    dataType: 'number',
    label: 'Max consecutive low tasks',
    description: 'Maximum consecutive LOW tasks before forcing interleaving',
    group: 'task_assignment',
    order: 3,
    minValue: 1,
    maxValue: 20,
    required: true,
  },
  {
    category: 'task_assignment',
    key: 'level_escalation_days',
    value: 3,
    dataType: 'number',
    label: 'Days to escalate level',
    description: 'Number of days after which a task escalates to the next level',
    group: 'task_assignment',
    order: 4,
    minValue: 1,
    maxValue: 60,
    required: true,
  },
];

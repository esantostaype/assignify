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
  value: number | string | boolean;
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
  {
    category: 'task_assignment',
    key: 'close_dates_window_days',
    value: 10,
    dataType: 'number',
    label: 'Close-dates window (days)',
    description:
      'Two candidates freeing up within this many days of each other are treated as "tied" on date; the choice then falls to workload and role fit instead of the exact day.',
    group: 'task_assignment',
    order: 5,
    minValue: 1,
    maxValue: 60,
    required: true,
  },
  {
    category: 'task_assignment',
    key: 'cross_role_escalation_days',
    value: 10,
    dataType: 'number',
    label: 'Cross-role escalation (days)',
    description:
      'If the best candidate of the preferred role frees up more than this many days later than one of a secondary/other role, the other role is also considered.',
    group: 'task_assignment',
    order: 6,
    minValue: 1,
    maxValue: 60,
    required: true,
  },
  {
    category: 'task_assignment',
    key: 'overload_soft_cap_days',
    value: 0,
    dataType: 'number',
    label: 'Overload soft cap (days, 0 = off)',
    description:
      'Soft fairness cap: when a member already has more than this many days of total pending work, their effective availability is pushed back so heavy queues of lower-priority work stop attracting new tasks. 0 disables it.',
    group: 'task_assignment',
    order: 7,
    minValue: 0,
    maxValue: 365,
    required: true,
  },

  // ── Auto-completar approvals (cron diario) ──────────────────────────────────
  {
    category: 'approvals',
    key: 'auto_complete_enabled',
    value: true,
    dataType: 'boolean',
    label: 'Auto-complete stale approvals',
    description:
      'When on, the daily job marks "On Approval" tasks as complete in ClickUp once their deadline has passed by the days below. Tasks tagged "keep" are never touched.',
    group: 'approvals',
    order: 1,
    required: true,
  },
  {
    category: 'approvals',
    key: 'auto_complete_days',
    value: 14,
    dataType: 'number',
    label: 'Days after deadline',
    description:
      'How many days past its deadline an "On Approval" task waits before being auto-completed.',
    group: 'approvals',
    order: 2,
    minValue: 1,
    maxValue: 90,
    required: true,
  },
];

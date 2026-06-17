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
    label: 'Inicio jornada (hora local)',
    description: 'Hora local en la que empieza la jornada (formato 24h)',
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
    label: 'Inicio almuerzo (hora local)',
    description: 'Hora local en la que empieza el almuerzo (formato 24h)',
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
    label: 'Duración almuerzo (horas)',
    description: 'Duración del almuerzo en horas',
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
    label: 'Fin jornada (hora local)',
    description: 'Hora local en la que termina la jornada (formato 24h)',
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
    label: 'Offset de zona horaria (horas)',
    description: 'Diferencia de la zona horaria local respecto a UTC (Perú = -5)',
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
    label: 'Diferencia para forzar generalista (días)',
    description:
      'Si el especialista se libera tantos días más tarde que el generalista, se asigna al generalista',
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
    label: 'Tareas normales antes de una baja',
    description: 'Número de tareas NORMAL antes de colocar una de prioridad LOW',
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
    label: 'Máximo de tareas bajas consecutivas',
    description: 'Máximo de tareas LOW consecutivas antes de forzar intercalado',
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
    label: 'Días para escalar de nivel',
    description: 'Días tras los cuales una tarea escala al siguiente nivel',
    group: 'task_assignment',
    order: 4,
    minValue: 1,
    maxValue: 60,
    required: true,
  },
];

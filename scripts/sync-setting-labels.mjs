// Migración puntual: pone en INGLES los label/description de system_settings
// (los que se muestran en el modal de Settings). NO toca los `value` ya
// configurados, solo el texto visible. Idempotente. Lee credenciales de .env.
// Tras correrlo una vez, los entornos nuevos ya se seedean en ingles desde
// src/config/settings-catalog.ts.
import 'dotenv/config'
import { createClient } from '@libsql/client'

const SETTINGS = [
  // work_schedule
  { category: 'work_schedule', key: 'start_hour_local', label: 'Workday start (local time)', description: 'Local time when the workday starts (24h format)' },
  { category: 'work_schedule', key: 'lunch_start_local', label: 'Lunch start (local time)', description: 'Local time when lunch starts (24h format)' },
  { category: 'work_schedule', key: 'lunch_duration_hours', label: 'Lunch duration (hours)', description: 'Lunch duration in hours' },
  { category: 'work_schedule', key: 'end_hour_local', label: 'Workday end (local time)', description: 'Local time when the workday ends (24h format)' },
  { category: 'work_schedule', key: 'utc_offset_hours', label: 'Timezone offset (hours)', description: 'Difference of the local timezone relative to UTC (Peru = -5)' },
  // task_assignment
  { category: 'task_assignment', key: 'deadline_difference_to_force_generalist', label: 'Difference to force generalist (days)', description: 'If the specialist frees up this many days later than the generalist, the task is assigned to the generalist' },
  { category: 'task_assignment', key: 'normal_tasks_before_low', label: 'Normal tasks before a low one', description: 'Number of NORMAL tasks before placing a LOW priority one' },
  { category: 'task_assignment', key: 'consecutive_low_tasks', label: 'Max consecutive low tasks', description: 'Maximum consecutive LOW tasks before forcing interleaving' },
  { category: 'task_assignment', key: 'level_escalation_days', label: 'Days to escalate level', description: 'Number of days after which a task escalates to the next level' },
]

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

let updated = 0
for (const s of SETTINGS) {
  const res = await client.execute({
    sql: 'UPDATE system_settings SET label = ?, description = ? WHERE category = ? AND key = ?',
    args: [s.label, s.description, s.category, s.key],
  })
  if (res.rowsAffected > 0) updated++
}
console.log(`OK: ${updated}/${SETTINGS.length} setting labels actualizados a ingles.`)
client.close()

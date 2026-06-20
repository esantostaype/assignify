// src/db/schema.ts — Schema Drizzle (SQLite/Turso) de la CONFIG del equipo.
// Las TAREAS viven en ClickUp (no en la DB), por eso no hay tablas Task/TaskAssignment.
// Notas de dialecto vs el viejo Postgres/Prisma:
//   - enums → text con `enum` (SQLite no tiene enums nativos)
//   - DateTime → integer timestamp en ms (mode: 'timestamp_ms')
//   - Boolean → integer (mode: 'boolean')
//   - Json → text (mode: 'json')
import { sqliteTable, text, integer, real, unique, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const TIER_NAMES = ['S', 'A', 'B', 'C', 'D', 'E'] as const
export const STATUS_NAMES = ['TO_DO', 'IN_PROGRESS', 'ON_APPROVAL', 'COMPLETE'] as const
export const LEVEL_NAMES = ['JUNIOR', 'MID', 'SENIOR'] as const

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())

export const tierList = sqliteTable(
  'tier_list',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name', { enum: TIER_NAMES }).notNull(),
    duration: real('duration').notNull(),
    // [SaaS] Workspace dueño de esta config (nullable; backfill con el de Inszone).
    workspaceId: text('workspace_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // Único por (workspaceId, name): cada workspace tiene sus propios tiers S/A/B/C/D/E.
  (t) => ({ workspaceNameUnique: unique('tier_list_workspace_name_unique').on(t.workspaceId, t.name) })
)

// [SaaS] PK COMPUESTO (id de ClickUp + workspaceId): la MISMA persona puede ser
// miembro de varios workspaces. `email` deja de ser único global (mismo correo en
// distintos workspaces). workspaceId se deja nullable a propósito para no romper los
// inserts del código single-tenant viejo que comparte esta Turso (SQLite admite NULL
// en columnas de PK compuesto).
export const user = sqliteTable(
  'user',
  {
    id: text('id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(false),
    // Nivel del diseñador (Junior/Mid/Senior). Decide el escalado de asignación.
    level: text('level', { enum: LEVEL_NAMES }).notNull().default('MID'),
    workspaceId: text('workspace_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.id, t.workspaceId] }) })
)

export const userVacation = sqliteTable(
  'user_vacation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Sin FK a user.id: el PK de user ahora es compuesto (id, workspaceId).
    userId: text('user_id').notNull(),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }).notNull(),
    // [SaaS] Workspace dueño de la vacación (acota la relación con user).
    workspaceId: text('workspace_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ uniq: unique().on(t.workspaceId, t.userId, t.startDate, t.endDate) })
)

export const taskType = sqliteTable(
  'task_type',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // [SaaS] Único por (workspaceId, name): cada workspace puede tener su propio "UX/UI".
    name: text('name').notNull(),
    // [SaaS] Workspace dueño del tipo (nullable; backfill).
    workspaceId: text('workspace_id'),
  },
  (t) => ({ workspaceNameUnique: unique('task_type_workspace_name_unique').on(t.workspaceId, t.name) })
)

export const brand = sqliteTable(
  'brand',
  {
    id: text('id').primaryKey(),
    // [SaaS] Único por (workspaceId, name): dos workspaces pueden tener una lista del mismo nombre.
    name: text('name').notNull(),
    spaceId: text('space_id'),
    folderId: text('folder_id'),
    teamId: text('team_id'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    description: text('description'),
    defaultStatus: text('default_status', { enum: STATUS_NAMES }).notNull().default('TO_DO'),
    // [SaaS] Workspace dueño del brand/lista (nullable; backfill).
    workspaceId: text('workspace_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ workspaceNameUnique: unique('brand_workspace_name_unique').on(t.workspaceId, t.name) })
)

export const userRole = sqliteTable(
  'user_role',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Sin FK a user.id: el PK de user ahora es compuesto (id, workspaceId).
    userId: text('user_id').notNull(),
    typeId: integer('type_id')
      .notNull()
      .references(() => taskType.id),
    brandId: text('brand_id').references(() => brand.id),
    // Cargo PRIMARIO (true) vs SECUNDARIO (false) para este tipo de tarea.
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    // [SaaS] Workspace dueño del rol (acota la relación con user).
    workspaceId: text('workspace_id'),
  },
  (t) => ({ uniq: unique().on(t.workspaceId, t.userId, t.typeId, t.brandId) })
)

// Metadata SIDECAR de cada tarea creada por Assignify, keyed por el id de ClickUp.
// NO es una copia de la tarea (estado/fechas/asignados viven y mutan en ClickUp y se
// leen en vivo). Aquí solo va lo INMUTABLE de creación que ClickUp no puede
// representar (tier/duración real, nivel pedido) + el rastro de la sugerencia para
// medir el motor. Write-once: se inserta al crear y no se vuelve a tocar.
export const taskMeta = sqliteTable('task_meta', {
  // id de la tarea en ClickUp (clave de cruce con fetchActiveClickUpTasks).
  clickupTaskId: text('clickup_task_id').primaryKey(),
  typeId: integer('type_id').notNull(),
  tierId: integer('tier_id').notNull(),
  // Duración REAL con la que se creó la tarea (días). Resuelve "ClickUp no trae tier".
  durationDays: real('duration_days').notNull(),
  brandId: text('brand_id').notNull(),
  priority: text('priority').notNull(),
  // Nivel solicitado al crear (Jr/Mid/Sr); no se persiste en la tarea de ClickUp.
  requestedLevel: text('requested_level', { enum: LEVEL_NAMES }).notNull().default('MID'),
  // Rastro de la sugerencia, para medir aciertos/override del motor.
  suggestedUserId: text('suggested_user_id'),
  // Asignados REALES al crear (JSON). Solo "foto" de creación; la verdad vive en ClickUp.
  assignedUserIds: text('assigned_user_ids', { mode: 'json' }).$type<string[]>(),
  // true si el sugerido NO quedó entre los asignados reales (override humano).
  wasOverride: integer('was_override', { mode: 'boolean' }).notNull().default(false),
  // [SaaS] Workspace dueño de la tarea (nullable; backfill).
  workspaceId: text('workspace_id'),
  createdAt: createdAt(),
})

// Usuarios que INICIAN SESIÓN en Assignify (operadores/managers), separados de
// `user` (que son los diseñadores de ClickUp, datos del motor — esos no loguean).
// La autenticación (Auth.js + credenciales) valida contra esta tabla.
export const authUser = sqliteTable('auth_user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  // Hash bcrypt de la contraseña (NUNCA la contraseña en claro).
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role').notNull().default('admin'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// [SaaS v2] Conexión de ClickUp por usuario: guarda el token (CIFRADO) que devuelve
// el OAuth de ClickUp al iniciar sesión con ClickUp. Es la base del modo
// multi-inquilino (cada usuario opera su propio workspace con SU token). El token
// de ClickUp no expira. NO se guarda jamás en claro.
export const clickupConnection = sqliteTable('clickup_connection', {
  // id de usuario en ClickUp (== id de la cuenta cuando se loguea con ClickUp).
  clickupUserId: text('clickup_user_id').primaryKey(),
  email: text('email'),
  username: text('username'),
  // Token de acceso de ClickUp cifrado (AES-256-GCM); ver src/lib/crypto.ts.
  accessTokenEnc: text('access_token_enc').notNull(),
  // Workspace ACTIVO del usuario (el que aísla su data). Se elige entre `workspaces`
  // desde el WorkspaceSwitcher; lo leen getCurrentWorkspaceId/getCurrentClickUpContext.
  workspaceId: text('workspace_id'),
  workspaceName: text('workspace_name'),
  // TODOS los workspaces que el usuario autorizó en el OAuth. El activo es `workspaceId`.
  // Se rellena/actualiza en cada login con ClickUp (events.signIn).
  workspaces: text('workspaces', { mode: 'json' }).$type<{ id: string; name: string | null }[]>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// [SaaS fase 8] Lock por workspace para serializar la creación de tareas (evita que
// dos creaciones simultáneas asignen tareas solapadas al mismo miembro). `locked_at`
// (epoch ms) sirve de TTL: un lock más viejo que el TTL se considera colgado.
export const assignmentLock = sqliteTable('assignment_lock', {
  workspaceId: text('workspace_id').primaryKey(),
  lockedAt: integer('locked_at').notNull(),
})

// [SaaS fase 4] Webhook de ClickUp registrado POR WORKSPACE (no por usuario). Al
// conectar un workspace registramos su webhook vía la API de ClickUp y guardamos su
// `secret` (CIFRADO) para validar la firma de SUS eventos. El handler resuelve el
// secret por `?ws={workspaceId}`. Reemplaza el único webhook global single-tenant.
export const workspaceWebhook = sqliteTable('workspace_webhook', {
  workspaceId: text('workspace_id').primaryKey(),
  webhookId: text('webhook_id').notNull(),
  // Secret del webhook cifrado (AES-256-GCM); ver src/lib/crypto.ts.
  secretEnc: text('secret_enc').notNull(),
  endpoint: text('endpoint').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').notNull(),
  entityIntId: integer('entity_int_id'),
  entityStringId: text('entity_string_id'),
  action: text('action').notNull(),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  clickupResponse: text('clickup_response', { mode: 'json' }),
  createdAt: createdAt(),
})

export const systemSettings = sqliteTable(
  'system_settings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    category: text('category').notNull(),
    key: text('key').notNull(),
    value: text('value', { mode: 'json' }).notNull(),
    dataType: text('data_type').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    group: text('group').notNull(),
    order: integer('order').notNull().default(0),
    minValue: real('min_value'),
    maxValue: real('max_value'),
    options: text('options', { mode: 'json' }),
    required: integer('required', { mode: 'boolean' }).notNull().default(true),
    // [SaaS] Workspace dueño de la config (nullable; backfill).
    workspaceId: text('workspace_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    // Único por (workspaceId, category, key): cada workspace tiene su propia config.
    uniq: unique('system_settings_ws_category_key_unique').on(t.workspaceId, t.category, t.key),
    groupOrderIdx: index('system_settings_group_order_idx').on(t.group, t.order),
  })
)

// ---- Relaciones (API relacional de Drizzle ≈ `include` de Prisma) ----
export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRole),
  vacations: many(userVacation),
}))

export const userVacationRelations = relations(userVacation, ({ one }) => ({
  // Relación COMPUESTA (userId + workspaceId) → user(id, workspaceId).
  user: one(user, {
    fields: [userVacation.userId, userVacation.workspaceId],
    references: [user.id, user.workspaceId],
  }),
}))

export const brandRelations = relations(brand, ({ many }) => ({
  userRoles: many(userRole),
}))

export const taskTypeRelations = relations(taskType, ({ many }) => ({
  roles: many(userRole),
}))

export const userRoleRelations = relations(userRole, ({ one }) => ({
  // Relación COMPUESTA (userId + workspaceId) → user(id, workspaceId).
  user: one(user, {
    fields: [userRole.userId, userRole.workspaceId],
    references: [user.id, user.workspaceId],
  }),
  type: one(taskType, { fields: [userRole.typeId], references: [taskType.id] }),
  brand: one(brand, { fields: [userRole.brandId], references: [brand.id] }),
}))

// src/db/schema.ts — Schema Drizzle (SQLite/Turso) de la CONFIG del equipo.
// Las TAREAS viven en ClickUp (no en la DB), por eso no hay tablas Task/TaskAssignment.
// Notas de dialecto vs el viejo Postgres/Prisma:
//   - enums → text con `enum` (SQLite no tiene enums nativos)
//   - DateTime → integer timestamp en ms (mode: 'timestamp_ms')
//   - Boolean → integer (mode: 'boolean')
//   - Json → text (mode: 'json')
import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const TIER_NAMES = ['S', 'A', 'B', 'C', 'D', 'E'] as const
export const STATUS_NAMES = ['TO_DO', 'IN_PROGRESS', 'ON_APPROVAL', 'COMPLETE'] as const

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())

export const tierList = sqliteTable('tier_list', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { enum: TIER_NAMES }).notNull().unique(),
  duration: real('duration').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const userVacation = sqliteTable(
  'user_vacation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.startDate, t.endDate) })
)

export const taskType = sqliteTable('task_type', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const brand = sqliteTable('brand', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  spaceId: text('space_id'),
  folderId: text('folder_id'),
  teamId: text('team_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  description: text('description'),
  defaultStatus: text('default_status', { enum: STATUS_NAMES }).notNull().default('TO_DO'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const userRole = sqliteTable(
  'user_role',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    typeId: integer('type_id')
      .notNull()
      .references(() => taskType.id),
    brandId: text('brand_id').references(() => brand.id),
  },
  (t) => ({ uniq: unique().on(t.userId, t.typeId, t.brandId) })
)

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uniq: unique().on(t.category, t.key),
    groupOrderIdx: index('system_settings_group_order_idx').on(t.group, t.order),
  })
)

// ---- Relaciones (API relacional de Drizzle ≈ `include` de Prisma) ----
export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRole),
  vacations: many(userVacation),
}))

export const userVacationRelations = relations(userVacation, ({ one }) => ({
  user: one(user, { fields: [userVacation.userId], references: [user.id] }),
}))

export const brandRelations = relations(brand, ({ many }) => ({
  userRoles: many(userRole),
}))

export const taskTypeRelations = relations(taskType, ({ many }) => ({
  roles: many(userRole),
}))

export const userRoleRelations = relations(userRole, ({ one }) => ({
  user: one(user, { fields: [userRole.userId], references: [user.id] }),
  type: one(taskType, { fields: [userRole.typeId], references: [taskType.id] }),
  brand: one(brand, { fields: [userRole.brandId], references: [brand.id] }),
}))

---
name: assignify-context
description: >-
  Contexto, arquitectura y convenciones del proyecto Assignify (app de asignación
  automática de tareas de diseño: Next.js 14 + Drizzle/Turso + ClickUp, en
  E:\Next\assignify). CONSULTA esta skill SIEMPRE antes de tocar este repo —al
  iniciar la sesión o tras limpiar el contexto— para entender cómo funciona el
  motor de asignación, dónde vive cada dato (ClickUp = tareas en vivo; Turso =
  config), el flujo de crear tareas y los gotchas (force-dynamic, barrel @/utils,
  ya no hay Prisma). Úsala ante cualquier bug, feature o cambio en Assignify,
  aunque no se mencione explícitamente.
---

# Assignify — contexto del proyecto

App interna de **Inszone** para asignar tareas de diseño a los diseñadores del
equipo de forma automática, según su rol, carga de trabajo, disponibilidad,
vacaciones, festivos y prioridad de la tarea. Se integra con **ClickUp** (donde
viven las tareas) y se despliega en **Vercel**.

> Comunícate SIEMPRE en español. Los commits van en español y terminan con
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Stack

- **Next.js 14 (App Router) + TypeScript**, React Query, Zustand, Formik + Yup.
- **Datos: Drizzle ORM + Turso (libSQL/SQLite).** (Se migró desde Prisma/PostgreSQL — **Prisma ya NO existe**; no uses `prisma.*` ni `@prisma/client`.)
- **ClickUp** REST API + webhook. **Pusher** para tiempo real.
- **UI propia** en `src/components/ui` (Button, Modal, Input, Select, Card, Skeleton…), tokens en `src/app/globals.css`, tema claro/oscuro. Toasts: `react-hot-toast`. Iconos: Phosphor vía `@/lib/icons`.
- Deploy: **push a `main` → Vercel** auto-deploy; el usuario prueba en la app desplegada. Repo **PÚBLICO** → nunca commitees secretos; `.env` está gitignored. Vars clave: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLICKUP_API_TOKEN`, `CLICKUP_WEBHOOK_SECRET`, `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*`.

## Dónde vive cada dato (LO MÁS IMPORTANTE)

- **ClickUp = fuente de verdad de las TAREAS.** NO hay copia local de tareas. Se leen EN VIVO:
  - `fetchActiveClickUpTasks()` y `getActiveClickUpTasksByUser(userId)` en `src/services/clickup-tasks.service.ts`.
  - Esto eliminó de raíz la desincronización: el kanban, el panel de carga y el motor leen la misma fuente.
- **Turso (Drizzle) = solo CONFIG del equipo.** Tablas: `user`, `user_role`, `user_vacation`, `tier_list`, `task_type`, `brand`, `system_settings`, `sync_log`.
  - Schema + relations: `src/db/schema.ts`. Cliente (perezoso, vía Proxy): `src/db/index.ts` (`import { db } from '@/db'`). Enums: `src/db/enums.ts` (`Priority`, `Status`, `Tier`). Config de migraciones: `drizzle.config.ts`.
- Un **Brand** equivale a una **lista de ClickUp** (`brand.id === list.id`).
- Tipos de tarea (`task_type`): p. ej. "UX/UI Design", "Graphic Design" — definen qué diseñador es compatible (por su rol). El **tier** (S/A/B/C/D/E, en `tier_list`) define la **duración** por defecto.

## Motor de asignación (núcleo)

Separa dos preguntas:

### 1) ¿QUIÉN? — sugerencia de diseñador
`CreateTaskForm` → `useTaskSuggestion` → `GET /api/tasks/suggestion/simple` →
`getBestUserWithCache` → `getVacationAwareUserSlots` + `selectBestUserWithVacationLogic`
(en `src/services/task-assignment.service.ts`).
- Candidatos = usuarios con **rol** para ese **tipo + brand**.
- Disponibilidad y carga = **TODAS** sus tareas pendientes (`TO_DO`/`IN_PROGRESS`; **`ON_APPROVAL` NO cuenta**), leídas de ClickUp.
- Orden: **quien se libera antes** → desempate por **menos carga**.
- Especialista vs generalista: si el especialista se libera mucho más tarde (umbral `DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST`), va el generalista.
- La **prioridad NO cambia quién**.

### 2) ¿CUÁNDO? — fechas (modelo de carriles por prioridad)
`POST /api/tasks/parallel` → `calculateParallelPriorityInsertion`
(en `src/services/parallel-priority-insertion.service.ts`).
- Una tarea se **encola tras la última de prioridad IGUAL o MAYOR** del diseñador y corre **en paralelo con las de menor** prioridad (no las empuja):
  - **URGENT** → cola de urgentes (la 1ª arranca hoy).
  - **HIGH** → tras la última URGENT/HIGH.
  - **NORMAL** → tras la última URGENT/HIGH/NORMAL.
  - **LOW** → al final.
- Ajusta la fecha si choca con **vacaciones** del usuario.
- **Crea SOLO en ClickUp** (`createTaskInClickUp` en `src/services/clickup.service.ts`). NO escribe la tarea en la DB. Tras crear, notifica por Pusher.

### Fechas, horario y festivos
- `src/utils/task-calculation-utils.ts`: `getNextAvailableStart`, `calculateWorkingDeadline`, `isNonWorkingDay`.
- `WORK_HOURS` y `TASK_ASSIGNMENT_THRESHOLDS` están en `src/config` (las horas están en **UTC**).
- Festivos de EE.UU. en `src/data/usHolidays.json` (incluye Juneteenth = 19 jun).
- `OCCUPYING_STATUSES = [TO_DO, IN_PROGRESS]`.
- **Fechas de calendario** (vacaciones): se anclan a **mediodía UTC** para que el día no se corra (zona Perú UTC-5).

### Configuración editable (Settings en Turso)
`WORK_HOURS` y `TASK_ASSIGNMENT_THRESHOLDS` ya NO son constantes fijas: viven en `system_settings` (Turso) y las lee `getAppSettings()` (`src/services/app-settings.service.ts`, cacheado 60s, con FALLBACK a `@/config` si la DB falla). El horario se edita en **hora local + huso** y se convierte a UTC (`utcHour = localHour - utcOffset`). Catálogo en `src/config/settings-catalog.ts`. Modal de Settings accesible desde el Header. `app-settings.service` es **solo-servidor** (no importar en componentes cliente). PATCH/reset invalidan la cache.

### Niveles de diseñador (Jr/Mid/Sr)
`user.level` (`JUNIOR`/`MID`/`SENIOR`, en Turso; enum `Level` en `src/db/enums.ts`). Se elige al crear la tarea (`LevelSelect`; NO se persiste en la tarea) y se edita por diseñador (UserEditModal → `PATCH /api/users/[userId]`). El motor (`selectBestUserWithVacationLogic`) asigna a nivel **≥ el requerido**; si el mejor del nivel pedido se libera más de `levelEscalationDays` (Settings, def 3) después que el de un nivel superior, **escala** (Jr→Mid→Sr; Mid→Sr; Sr solo Sr). El override manual (asignar a mano) ignora el nivel. Especialista/generalista quedó como desempate dentro del mismo nivel.

### Tags de ClickUp con significado
- `ongoing` → tarea continua sin fecha fija; **excluida** de `fetchActiveClickUpTasks` (no la ve el motor, el panel ni el kanban).
- `keep` → tarea On Approval que NO debe auto-completarse.
- Cron `GET /api/cron/complete-stale-approvals` (Vercel cron diario via `vercel.json`; protegido con `CRON_SECRET`): pasa a Complete las On Approval con deadline + 14 días, salvo tag `keep`.

## Tiempo real
`/api/clickup-webhook` recibe eventos de ClickUp y solo hace `publishTaskUpdate` (Pusher) — **ya no escribe en la DB**. En el cliente, `usePusherTaskSync` (montado por `RealtimeListener`) invalida las queries `taskKeys.clickup()` y `workloadKeys.all` → el kanban y el panel "Carga del equipo" se repintan solos.

## Vistas y endpoints
- **/tasks** — kanban; lee ClickUp en vivo (`useClickUpTasks` → `GET /api/sync/clickup-tasks`).
- **/designers** — panel "Carga del equipo" (`TeamWorkload` → `GET /api/users/workload`, cruza ClickUp + Turso) + lista de diseñadores (editar roles/vacaciones).
- **/types**, **/tiers** — catálogos de configuración.
- **Crear tarea** — `CreateTaskForm` (aside derecho) → `POST /api/tasks/parallel`.

## Convenciones y GOTCHAS (no romper)
- **`force-dynamic`**: toda ruta en `src/app/api/**/route.ts` que toque la DB o ClickUp debe tener `export const dynamic = 'force-dynamic'`. Sin esto, Next intenta prerenderizarla en build y revienta ("no such table" / errores de conexión).
- **Barrel `@/utils` en cliente**: en componentes `"use client"` NO importes desde `@/utils` (el barrel arrastra utilidades que tocan `@/db`/`@libsql`, código solo-servidor, al bundle de cliente y rompe el prerender con "Element type is invalid"). Importa del módulo directo (p. ej. `@/utils/taskUtils`).
- `ON_APPROVAL` = trabajo entregado: no cuenta como carga ni empuja disponibilidad.
- Verifica SIEMPRE con `npx tsc --noEmit` y `npm run build` antes de commitear. Los logs `Dynamic server usage` durante el build son **normales** (no son fallo).
- Para cambios grandes: trabaja en una **rama** y valida en el **preview de Vercel** antes de mergear a `main` (no rompas producción).

## Comandos útiles
- `npm run dev` · `npm run build` · `npx tsc --noEmit`
- `npx drizzle-kit push` — aplica el schema de Drizzle a Turso (usa `drizzle.config.ts` + `.env`).
- Scripts (en `scripts/`, leen tokens de `.env`): `check-webhooks.js`, `inspect-clickup-load.js`, `setup-clickup-webhook.js`.

## Memorias relacionadas (auto-memoria de Claude)
Hay memorias del proyecto que complementan esto: arquitectura de sync, motor de asignación, "approval ≠ occupying", deploy workflow, idioma español. Si están disponibles en el contexto, respétalas.

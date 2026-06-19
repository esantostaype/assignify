---
name: assignify-context
description: >-
  Contexto, arquitectura y convenciones del proyecto Assignify (app de asignación
  automática de tareas de diseño: Next.js 14 + Drizzle/Turso + ClickUp, en
  D:\Next\assignify). CONSULTA esta skill SIEMPRE antes de tocar este repo —al
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

> **Hay una transformación a SaaS multi-inquilino EN CURSO en la rama
> `feat/saas-multi-tenant`** (login con ClickUp OAuth + datos aislados por workspace).
> Si trabajas en esa rama o en lo multi-tenant, consulta la skill
> **`assignify-saas-roadmap`** (tiene el estado, los gotchas y cómo retomar). `main`
> sigue single-tenant.

## Stack

- **Next.js 14 (App Router) + TypeScript**, React Query, Zustand, Formik + Yup.
- **Datos: Drizzle ORM + Turso (libSQL/SQLite).** (Se migró desde Prisma/PostgreSQL — **Prisma ya NO existe**; no uses `prisma.*` ni `@prisma/client`.)
- **ClickUp** REST API + webhook. **Pusher** para tiempo real.
- **UI propia** en `src/components/ui` (Button, Modal, Input, Select, Card, Skeleton…), tokens en `src/app/globals.css`, tema claro/oscuro. Toasts: `react-hot-toast`. Iconos: Phosphor vía `@/lib/icons`.
- **Auth: Auth.js v5 (next-auth) + Turso.** Login con credenciales (email/password) validadas contra la tabla `auth_user` (contraseñas **bcrypt**). `auth.config.ts` = config edge-safe (callbacks `authorized`/`jwt`/`session`, sin DB) que usa `middleware.ts` para **proteger TODAS las rutas en el edge**; `auth.ts` = provider de credenciales (bcrypt + DB, runtime Node). Rutas públicas: `/login`, `/api/auth/*`, `/api/clickup-webhook`, `/api/cron/*`. Sesión JWT (id/role). Sembrar usuarios: `node scripts/seed-auth-user.js` (lee `ADMIN_EMAIL`/`ADMIN_PASSWORD`). `auth_user` ≠ `user` (los `user` son diseñadores de ClickUp; no loguean).
- Deploy: **push a `main` → Vercel** auto-deploy; el usuario prueba en la app desplegada. Repo **PÚBLICO** → nunca commitees secretos; `.env` está gitignored. Vars clave: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLICKUP_API_TOKEN`, `CLICKUP_WEBHOOK_SECRET`, `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*`, **`AUTH_SECRET`** (requerido por Auth.js; genera con `npx auth secret` u `openssl rand -base64 32`).

## Dónde vive cada dato (LO MÁS IMPORTANTE)

- **ClickUp = fuente de verdad de las TAREAS.** NO hay copia local de tareas. Se leen EN VIVO:
  - `fetchActiveClickUpTasks()` y `getActiveClickUpTasksByUser(userId)` en `src/services/clickup-tasks.service.ts`.
  - Esto eliminó de raíz la desincronización: el kanban, el panel de carga y el motor leen la misma fuente.
  - **Caché del crawl (45s):** `fetchActiveClickUpTasks` cachea su recorrido (caro: team→space→folder→list) para que kanban/carga/motor compartan UNA lectura. Se invalida al crear (`invalidateAllCache`) y desde el webhook (`invalidateActiveClickUpTasksCache`).
- **Turso (Drizzle) = CONFIG del equipo + metadata sidecar de tareas.** Tablas: `user`, `user_role`, `user_vacation`, `tier_list`, `task_type`, `brand`, `system_settings`, `sync_log`, **`task_meta`**.
  - **`task_meta` (SIDECAR, NO copia de tarea):** keyed por `clickup_task_id`, write-once al crear. Guarda SOLO lo inmutable que ClickUp no representa (`tierId`, `durationDays` REAL, `requestedLevel`, `priority`, `brandId`) + el rastro de la sugerencia (`suggestedUserId`, `assignedUserIds`, `wasOverride`) para medir el motor. No desincroniza porque no duplica nada mutable (estado/fechas/asignados siguen viniendo en vivo de ClickUp). `fetchActiveClickUpTasks` hace left-join por id e inyecta `durationDays` cuando existe. Para tareas creadas FUERA de Assignify (sin fila) el motor **deriva la duración de las fechas reales `start→due`** (días hábiles, `estimateTaskDurationDays`), NO se backfillea la tabla: las fechas son mutables y guardarlas reincorporaría desincronización. **No metas aquí estado/asignados/fechas.**
  - Schema + relations: `src/db/schema.ts`. Cliente (perezoso, vía Proxy): `src/db/index.ts` (`import { db } from '@/db'`). Enums: `src/db/enums.ts` (`Priority`, `Status`, `Tier`). Config de migraciones: `drizzle.config.ts`.
- Un **Brand** equivale a una **lista de ClickUp** (`brand.id === list.id`).
- Tipos de tarea (`task_type`): p. ej. "UX/UI Design", "Graphic Design" — definen qué diseñador es compatible (por su rol). El **tier** (S/A/B/C/D/E, en `tier_list`) define la **duración** por defecto.

## Motor de asignación (núcleo)

Separa dos preguntas:

### 1) ¿QUIÉN? — sugerencia de diseñador
`CreateTaskForm` → `useTaskSuggestion` → `GET /api/tasks/suggestion/simple` →
`getRankedCandidates` (que reusa `getVacationAwareUserSlots` + `selectBestUserWithVacationLogic`)
en `src/services/task-assignment.service.ts`.
- **FUENTE ÚNICA para la UI**: `/suggestion/simple` devuelve `{ suggestedUserId, candidates }`. Los `candidates` (con `status` available/on_vacation/overloaded, `availableFrom`, `roleAffinity`, `isSuggested`) alimentan TANTO el diseñador sugerido COMO las opciones+badges del selector. **Ya NO existe `/api/users/enhanced` ni `useEnhancedUsers`** (se eliminaron: antes eran un segundo motor/criterio que generaba bloqueos e inconsistencias —p. ej. el sugerido y el seleccionado no coincidían).
- Candidatos = **TODOS** los diseñadores activos, clasificados por **afinidad de cargo** al tipo (con match de brand): `roleAffinity` = **1** si tienen rol para el tipo con `isPrimary=true` (cargo PRIMARIO), **2** si lo tienen con `isPrimary=false` (SECUNDARIO), **3** si NO tienen rol para el tipo (otro cargo, fallback).
- Carga y tareas pendientes (`TO_DO`/`IN_PROGRESS`; **`ON_APPROVAL` NO cuenta**) leídas de ClickUp. La **carga total** = suma de **duraciones reales** (de `task_meta` cuando existe; si no, derivadas de las fechas `start→due` en días hábiles), no el conteo de tareas.
- **Disponibilidad por CARRIL de prioridad (QUIÉN↔CUÁNDO reconciliados):** `availableDate` se mide sobre las tareas de prioridad **igual o mayor** a la pedida (el "carril"), no sobre toda la cola — igual que el motor de fechas (paso 2). Así un URGENT puede empezar antes que la última deadline absoluta del diseñador si lo que tiene por delante es de menor prioridad.
- Orden: **quien se libera antes** → desempate por **menos congestión de prioridad** → menos carga total.
- **La PRIORIDAD influye en QUIÉN (balanceo de carga)**: por candidato se calcula `samePriorityOrHigherLoad` = nº de tareas de prioridad **igual o mayor** a la pedida. Entre quienes se liberan en **fechas parecidas** (dentro del umbral `DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST`), gana el de **menor congestión de esa prioridad** —así no se apilan urgentes en el mismo diseñador, **aunque sea especialista**. Si las fechas difieren más que el umbral, manda la fecha. Comparador `compareSlots`.
- **Escalado por cargo (eje superior al de nivel)**: se elige el mejor de los PRIMARIOS; si se libera más de `DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST` días después que el mejor de los SECUNDARIOS, escala a secundarios; y si esos también están saturados, a otros cargos (1→2→3). Reusa el **mismo** umbral que separa especialista/generalista.
- Dentro de cada grupo de cargo se aplica el **escalado por nivel** (nivel ≥ requerido; si el del nivel pedido se libera mucho más tarde, escala a uno superior) y, como desempate final, especialista vs generalista (umbral `DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST`).
- **Núcleo PURO y testeado:** toda la decisión (comparador, escalado de nivel y de cargo, especialista/generalista) vive en `src/services/assignment-ranking.ts` (sin IO) y se prueba con Vitest en `assignment-ranking.test.ts` (`npm test`). `task-assignment.service.ts` solo hace el IO (leer DB/ClickUp/Settings) y delega la decisión en ese núcleo. Cada candidato trae un `reason` legible para la UI.
- El override **manual** ignora cargo y nivel. Se registra en `task_meta.wasOverride` (sugerido vs. asignado real) para medir el motor.

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
- **/designers** — `GET /api/users/workload` (cruza ClickUp + Turso) alimenta dos cosas: el **timeline de capacidad** (`CapacityTimeline`: una fila por diseñador con sus tareas pendientes como barras por prioridad, bandas de vacaciones y marcador de "se libera el…", para ver lo que ve el motor) + la **lista de diseñadores** (`UsersList`/`SyncedDesignerCard`, editar roles/vacaciones). El endpoint incluye `pendingTasks` por usuario para las barras.
- **/types**, **/tiers** — catálogos de configuración.
- **Crear tarea** — `CreateTaskForm` (aside derecho) → `POST /api/tasks/parallel`.
  - El formulario arranca **siempre vacío** (incluidos Priority y Level, con placeholder; son requeridos por la validación). Se **auto-limpia** tras crear con éxito y por **inactividad** (2 min, `FormikInactivityReset`).
  - El selector de asignación **sigue automáticamente a la sugerencia** mientras el usuario no la cambie a mano (`onAutoApply` NO marca "cambio manual"; `onChange` sí). Si el usuario elige a otro, aparece el aviso "Suggested: X · Apply".
  - Mientras el motor busca, un **overlay** (negro 70% + blur, con icono + "Finding suggested designer…") bloquea el aside. La **Duración** sale instantánea del tier (o manual): **no** muestra "Calculating".

## Convenciones y GOTCHAS (no romper)
- **`force-dynamic`**: toda ruta en `src/app/api/**/route.ts` que toque la DB o ClickUp debe tener `export const dynamic = 'force-dynamic'`. Sin esto, Next intenta prerenderizarla en build y revienta ("no such table" / errores de conexión).
- **Barrel `@/utils` en cliente**: en componentes `"use client"` NO importes desde `@/utils` (el barrel arrastra utilidades que tocan `@/db`/`@libsql`, código solo-servidor, al bundle de cliente y rompe el prerender con "Element type is invalid"). Importa del módulo directo (p. ej. `@/utils/taskUtils`).
- `ON_APPROVAL` = trabajo entregado: no cuenta como carga ni empuja disponibilidad.
- Verifica SIEMPRE con `npx tsc --noEmit` y `npm run build` antes de commitear. Si tocaste el motor, corre además `npm test` (Vitest, núcleo de `assignment-ranking`). Los logs `Dynamic server usage` durante el build son **normales** (no son fallo).
- Para cambios grandes: trabaja en una **rama** y valida en el **preview de Vercel** antes de mergear a `main` (no rompas producción).

## Comandos útiles
- `npm run dev` · `npm run build` · `npx tsc --noEmit` · `npm test` (Vitest, motor)
- `npx drizzle-kit push` — aplica el schema de Drizzle a Turso (usa `drizzle.config.ts` + `.env`).
- Scripts (en `scripts/`, leen tokens de `.env`): `check-webhooks.js`, `inspect-clickup-load.js`, `setup-clickup-webhook.js`.

## Memorias relacionadas (auto-memoria de Claude)
Hay memorias del proyecto que complementan esto: arquitectura de sync, motor de asignación, "approval ≠ occupying", deploy workflow, idioma español. Si están disponibles en el contexto, respétalas.

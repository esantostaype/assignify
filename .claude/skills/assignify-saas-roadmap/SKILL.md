---
name: assignify-saas-roadmap
description: >-
  Plan y decisiones de diseño para convertir Assignify (hoy SINGLE-TENANT: un
  solo workspace de ClickUp vía CLICKUP_API_TOKEN global) en un SaaS
  MULTI-INQUILINO donde cada usuario inicia sesión con ClickUp (OAuth) y opera su
  PROPIO workspace, con datos aislados. CONSULTA esta skill cuando se trabaje en la
  transformación multi-tenant de Assignify: login con ClickUp OAuth, tokens por
  usuario, aislamiento de datos por workspace, webhooks por workspace, o el
  renombrado de "Designers" a "Team/Members". NO aplica al funcionamiento
  single-tenant actual (para eso usa la skill assignify-context).
---

# Assignify → SaaS multi-inquilino (roadmap v2)

> Estado: **EN PRODUCCIÓN.** El SaaS multi-inquilino se MERGEÓ a `main` y está
> desplegado en Vercel (login ClickUp OAuth + datos aislados por workspace). Fases 1–8
> implementadas. Se sigue iterando en `feat/saas-multi-tenant` y se mergea a `main` por
> tandas (deploy = push a `main` → Vercel → el usuario prueba en vivo). El login
> email/password (admin Inszone) sigue conviviendo con el de ClickUp.
> **Ver "Fases 6–8" al final** para lo último (motor fecha-manda, lock de concurrencia,
> realtime de listas/miembros, UX/UI alineada con la intranet, Settings como página).

## ⚡ CÓMO RETOMAR (otra PC / sesión nueva) — LEER PRIMERO

1. **Rama**: `git fetch origin && git checkout feat/saas-multi-tenant && git pull && npm install`.
   Verifica el último commit con `git log --oneline -1`.
2. **`.env`** (NO viaja por git, recréalo en cada PC). Necesitas:
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLICKUP_API_TOKEN`, `CLICKUP_WEBHOOK_SECRET`,
   `PUSHER_*`/`NEXT_PUBLIC_PUSHER_*`, `AUTH_SECRET`, `AUTH_CLICKUP_ID`, `AUTH_CLICKUP_SECRET`,
   `ENCRYPTION_KEY` (opcional), y **`DEFAULT_WORKSPACE_ID=9017044866`** (Inszone real).
   - El **redirect URI** de la OAuth app de ClickUp debe incluir el puerto local de ESA PC
     (`http://localhost:<puerto>/api/auth/callback/clickup`).
3. **DB**: la Turso es compartida en la nube → el schema (PK compuesto, columnas
   workspace_id, clickup_connection, task_meta, auth_user) y los backfills YA están.
   **NO correr `npx drizzle-kit push`** (la última migración se atascó en un índice
   cosmético de user_role; las tablas/datos están bien, pero re-pushear podría recrear
   tablas). Si hay que cambiar schema, hacerlo con una migración SQL manual y cuidado.
4. **Ids**: Inszone real = **9017044866**; workspace de pruebas "Inszone Insurance" =
   **90171327636** (tiene tareas/diseñadores de prueba; sus "On Approval" son custom).
5. **GOTCHA dev server**: NO correr `npm run build` mientras `npm run dev` está arriba
   (ambos escriben `.next` → estado corrupto → errores raros como `ConnectTimeoutError`
   en el login de ClickUp). Si pasa: `Ctrl+C`, `Remove-Item -Recurse -Force .next`, `npm run dev`.
6. Verificación: `npx tsc --noEmit` · `npm run build` (con dev apagado) · `npm test` (20 tests).

## Objetivo

Cualquier persona/empresa puede usar Assignify con **su propio workspace de
ClickUp**: inicia sesión con ClickUp, la app sincroniza SUS miembros / listas /
tareas, y todo queda **aislado por inquilino** (un usuario nunca ve datos de otro).

## Decisiones tomadas

- **Login = "Conectar con ClickUp" (ClickUp OAuth).** Un solo paso autentica a la
  persona Y vincula su workspace + token. El email/password (y Google) quedan
  opcionales o se eliminan. Auth.js soporta ClickUp como **provider OAuth custom**
  (ClickUp expone OAuth2; sus tokens **no expiran** → no hay refresh que manejar).
- **Sí es SaaS multi-inquilino** (terceros con su propio ClickUp), no solo sumar
  operadores de Inszone al mismo workspace.
- **Renombrar "Designers" → "Team" / "Members"** (la app deja de ser específica de
  diseño). Los `task_type` (UX/UI, Graphic) y `tier_list` pasan a ser **config por
  workspace** que cada usuario define.

## Cambios de arquitectura (alto nivel)

1. **Auth (ClickUp OAuth):** provider custom en `auth.ts`; guardar el `access_token`
   de ClickUp **cifrado** por usuario. La cuenta se identifica por el user id de
   ClickUp. Vars nuevas: `AUTH_CLICKUP_ID` / `AUTH_CLICKUP_SECRET`.
2. **Aislamiento por tenant:** añadir `workspaceId` (u `ownerId`) a TODAS las tablas
   de config hoy globales y filtrar por él en cada query:
   `user`(→members), `user_role`, `user_vacation`, `task_type`, `tier_list`,
   `brand`, `system_settings`, `task_meta`. (`auth_user` se reemplaza/extiende por
   la cuenta ligada a ClickUp.)
3. **Servicios + motor por token:** dejar de leer `CLICKUP_API_TOKEN` global; enhebrar
   el token del usuario actual por toda la capa: `clickup-tasks.service`,
   `clickup.service`, `task-assignment.service`/`assignment-ranking` (el motor),
   `/api/users/workload`, el timeline. El crawl y la caché pasan a ser **por
   workspace** (clave de caché incluye workspaceId).
4. **Webhooks por workspace:** hoy hay UN webhook con `CLICKUP_WEBHOOK_SECRET`. Al
   conectar un workspace, **registrar su webhook** vía la API OAuth de ClickUp y
   enrutar/validar por workspace.
5. **Onboarding:** primer login → conectar ClickUp → sincronizar miembros/listas →
   definir task types / tiers → empezar a asignar.

## Progreso

- **Rama:** `feat/saas-multi-tenant`.
- **Fase 1 — EN CURSO (scaffolding hecho, falta probar con creds reales):**
  - Provider `clickup` (OAuth) en `src/auth.ts` (+ botón "Continue with ClickUp" en login).
  - Tabla `clickup_connection` (token cifrado por usuario) en `src/db/schema.ts`.
  - `src/lib/crypto.ts` (AES-256-GCM, clave de `ENCRYPTION_KEY`/`AUTH_SECRET`).
  - `events.signIn` guarda el token cifrado al loguear con ClickUp.
  - **PENDIENTE para activarlo:** crear la OAuth app en ClickUp y definir
    `AUTH_CLICKUP_ID` / `AUTH_CLICKUP_SECRET` (+ `ENCRYPTION_KEY` recomendado);
    correr `npx drizzle-kit push` para crear `clickup_connection` en Turso;
    probar el flujo (el provider es custom y puede necesitar ajuste fino).
  - El login email/password sigue intacto (no se rompió el single-tenant).

- **Fase 2 — base hecha; falta el SWEEP de scoping:**
  - Workspace activo se resuelve y guarda al loguear (`clickup_connection.workspaceId`).
  - Mapeo de estados robusto por `type` de ClickUp (3 buckets) + tests.
  - Columnas `workspace_id` (nullable) en `user`, `task_type`, `tier_list`, `brand`,
    `system_settings`, `task_meta` (solo ALTER ADD; uniques intactos).
  - `getCurrentWorkspaceId()` en `src/lib/workspace.ts` (ClickUp → su workspace;
    email/password → `DEFAULT_WORKSPACE_ID`).
  - `scripts/backfill-workspace.js` aplicado; data actual etiquetada al workspace
    de Inszone **90170099166** (= `brand.team_id`).
  - **SWEEP de scoping — HECHO en las superficies principales:**
    - Listas: `/api/users`, `/api/types` (+POST/PATCH/DELETE), `/api/tiers`,
      `/api/brands`, `/api/users/workload` → filtran por `workspaceId`.
    - Motor: `getVacationAwareUserSlots`/`getRankedCandidates`/`getBestUserWithCache`
      reciben `workspaceId` y filtran el pool de `user`; cache key incluye workspace.
    - `/api/tasks/suggestion/simple` y `/api/tasks/parallel` resuelven el workspace
      y lo pasan al motor; parallel valida tier/type/brand/user acotados y guarda
      `task_meta.workspaceId`.
    - `/api/sync/clickup-users` etiqueta a los miembros creados con el workspace.
  - **Hardening pendiente (no bloquea, anotar):**
    - `getAppSettings` (horario/umbrales) sigue COMPARTIDO — settings por workspace es
      refinamiento posterior (evita enhebrar workspaceId por las utils de fechas).
    - Sub-rutas `/api/users/[userId]`(roles/vacations), creación de brands/tiers y
      `/api/settings` aún no acotan por workspace (riesgo bajo; cerrar luego).
    - `user.id` PK = id de ClickUp → un mismo usuario en 2 workspaces colisiona;
      el PK debería ser (workspaceId, id). Migración posterior.
    - Unicidad real por (workspaceId, …) en task_type/tier_list/system_settings.
  - Requiere `DEFAULT_WORKSPACE_ID=90170099166` en `.env`/Vercel.
- **Fase 3 — CERRADA (implementada; pendiente solo validación en vivo del usuario):**
  - `getCurrentClickUpContext()` → `{ token, teamId }` (token de ClickUp del usuario,
    descifrado; fallback global+DEFAULT_WORKSPACE_ID para el admin email/password).
  - Enhebrado `{token, teamId}` por TODA la capa: `clickup-tasks.service`
    (`fetchActiveClickUpTasks`/`getActiveClickUpTasksByUser` con token + crawl acotado
    al teamId + **caché por workspace**), `clickup.service` (`createTaskInClickUp` con
    el token del usuario), `parallel-priority-insertion`, el motor
    (`getVacationAwareUserSlots`/`getRankedCandidates`/`getBestUserWithCache`), y las
    rutas suggestion/parallel/workload/kanban-sync/sync-users.
  - **Alineación de ids RESUELTA**: el `brand.team_id` 90170099166 era STALE.
    Verificado que los brand-lists viven bajo **"Inszoneins" = 9017044866** (ese es el
    team real). Re-backfill aplicado a 9017044866. → `DEFAULT_WORKSPACE_ID=9017044866`.
    El workspace de pruebas "Inszone Insurance" (ex-"OAuth") = 90171327636.
  - **Fix de cierre**: "On Approval" con `type=closed/done` ya NO se excluye (Inszone
    lo tiene como `closed`); la palabra clave de aprobación gana al `type`. +test.
  - **Validación en vivo (la confirma el usuario, no bloquea el código):**
    - Admin email/password → kanban SOLO de Inszone (las 3 tareas del workspace de
      pruebas ya no se cuelan).
    - Login ClickUp → solo el workspace que resolvió ese login.

### Fase 4 — EN CURSO.
**Hecho ya:**
- ✅ **PK compuesto `user(id, workspaceId)`** → la misma persona en varios workspaces
  (commit del usuario); user_role/user_vacation con `workspace_id` + relaciones
  compuestas. *(OJO: el `drizzle-kit push` se atascó en un índice cosmético de
  user_role; las tablas/datos quedaron correctos pero NO volver a pushear sin revisar.)*
- ✅ **Fix skeleton**: `useSyncUsers` invalida `workload`.
- ✅ **Tipo de tarea dinámico** en el form: `TaskTypeSelect` con los task types del
  workspace (se eliminó el switch UX/UI|Graphic y `getTypeKind`/`TaskKindSwitch`).
- ✅ **Sync de listas/brands**: `/api/sync/clickup-lists` (GET descubre, POST guarda) +
  `ListsSyncForm` + entrada "Lists" en el header. BrandSelect ahora dice "List".
- ✅ **Selector multi-workspace**: columna `clickup_connection.workspaces` (JSON con
  TODOS los teams autorizados; el activo sigue en `workspaceId`, que es lo que leen
  `getCurrentWorkspaceId`/`getCurrentClickUpContext`). `events.signIn` ya guarda todos
  los teams y **preserva el activo elegido** si sigue disponible. `GET/PATCH
  /api/workspaces` (el PATCH valida que el workspace sea uno autorizado). Hook
  `useWorkspaces`/`useSetActiveWorkspace` + `WorkspaceSwitcher` en el Header (solo si
  hay >1; al cambiar → `window.location.reload` para releer todo con el nuevo activo).
  Migración manual `scripts/add-workspaces-column.js` (ADD COLUMN nullable, idempotente;
  **NO** `drizzle-kit push`). **OJO**: las conexiones previas necesitan **RE-LOGIN** con
  ClickUp para poblar `workspaces` (antes solo se guardaba `teams[0]`); hasta entonces el
  GET devuelve solo el activo y el selector queda oculto.
- ✅ **Webhooks / realtime por workspace**: tabla `workspace_webhook` (webhookId +
  secret CIFRADO por workspace). `ensureWorkspaceWebhook` (`src/lib/workspace-webhook.ts`)
  registra el webhook de cada workspace en `events.signIn` (idempotente, best-effort, solo
  si hay `WEBHOOK_PUBLIC_URL`). El handler `/api/clickup-webhook` valida la firma y enruta
  por `?ws={workspaceId}` (sin `ws` = webhook global de Inszone, compat). Pusher pasa a
  canal `tasks-{workspaceId}` (`taskChannelForWorkspace`) y el cliente (`usePusherTaskSync`)
  escucha SOLO el de su workspace activo → sin fuga de realtime entre inquilinos. Migración
  `scripts/add-workspace-webhook-table.js`. **OJO**: solo se valida en PROD (el endpoint del
  webhook debe ser una URL pública estable; en preview/local no entran eventos). Requiere
  `WEBHOOK_PUBLIC_URL=https://assignify.vercel.app` en Vercel (Production) + desplegar el
  handler a prod ANTES de que se registren los webhooks que apuntan a él.
- ✅ **Hardening de aislamiento (cierre)**: (a) `DEFAULT_WORKSPACE_ID` correcto = **9017044866**
  (verificado en DB: ahí viven brands/tiers/settings/users reales; corregido en `.env` y
  `.env-production`; el `90170099166` era stale). (b) Limpiados 2 `task_type` huérfanos bajo el
  id stale (`scripts/cleanup-stale-task-types.js`). (c) **Unicidad por `(workspaceId, name)`** en
  `brand`/`task_type` (por `name`) y `system_settings` (por `category,key`) — antes unique GLOBAL,
  chocaban entre inquilinos: se reemplazó el índice (DROP del global + CREATE UNIQUE INDEX compuesto
  con `workspace_id`), **sin recrear tablas** (índices nombrados, origin=c) vía
  `scripts/fix-name-uniques.js` (generalizado); schema con `unique(...).on(workspaceId, …)`.
- ✅ **Settings por workspace**: `getAppSettings(workspaceId?)` filtra `system_settings` por
  workspace + cache key por workspace (fallback a `@/config` si el workspace no tiene filas → un
  inquilino nuevo usa defaults, no los de Inszone). Se enhebró `workspaceId` por las utils de fechas
  (`getNextAvailableStart`/`calculateWorkingDeadline`) y se propagó por el motor
  (`getVacationAwareUserSlots`→`selectBestUserWithVacationLogic`) y por `parallel-priority-insertion`
  (vía `clickupOpts.teamId`). `/api/settings` (GET siembra con `workspaceId`, PATCH filtra) y
  `/api/settings/reset` SCOPEADOS por workspace (el reset borraba TODOS los workspaces → fuga grave,
  corregida). `workspaceId` opcional (compat) en toda la cadena. El núcleo puro `assignment-ranking`
  no se tocó (20 tests siguen verdes).
- ✅ **Tiers con unidad de tiempo (days/hours/minutes) por workspace**: la duración sigue en
  "días base" (motor/`task_meta`/endpoints de tareas INTACTOS; 1 día = 8h = 480min); la unidad es
  solo edición/display. `duration-utils` (`unitToDays`/`daysToUnit`/`formatDuration`); `/api/tiers`
  GET→`{tiers, durationUnit}` + PATCH guarda la unidad (fila `system_settings` category `tier`);
  el selector vive en `SettingsForm` (sección Tier Durations); `TierSelect`/`DurationField`/
  `CreateTaskForm` muestran/editan en la unidad y convierten a días base al enviar. *(OJO:
  `TierListForm` es código MUERTO —no se monta—; el real es `SettingsForm`. Pendiente: borrarlo.)*
- ✅ **Fix aislamiento de ROLES por workspace** (el mismo userId puede tener roles en varios
  workspaces): `GET/PATCH /api/users/[userId]` acotan el usuario al workspace; `/api/users/workload`
  filtra `userRole`/`taskType`/`userVacation` por workspace (las cards mostraban roles ajenos);
  `POST /api/users/[userId]/roles` valida el tipo dentro del workspace.

### Fase 5 — onboarding (EN CURSO)
- ✅ **Onboarding wizard**: `OnboardingWizard` (Modal + Stepper) montado en `providers.tsx` (no en
  login). Aparece solo si el workspace **no fue onboarded Y le falta config** (sin miembros/listas/
  tipos, vía `useTaskData`), así no molesta a workspaces ya configurados. 3 pasos reutilizando
  componentes: `StepSyncMembers` (sobre `useClickUpUsers`/`useSyncUsers`) → `ListsSyncForm` →
  `TaskTypesForm`. Skip/Finish → `PATCH /api/onboarding {completed:true}` (flag en `system_settings`).
- **Pendiente Fase 5**: renombrar **"Designers" → "Team/Members"** (la app deja de ser solo de diseño).

### Fases 6–8 — EN PRODUCCIÓN (post-merge a `main`)
Tras mergear el SaaS a `main`, se iteró en motor, gestión de equipo, UX/UI y tiempo real.
Todo desplegado en Vercel.

**Motor / asignación:**
- ✅ **La fecha/hora EXACTA de liberación MANDA** (no el día redondeado ni el nº de
  tareas). `compareSlots` (`src/services/assignment-ranking.ts`) compara
  `effectiveAvailableMs` exacto: quien se libera antes gana con CUALQUIER diferencia
  (medio día, horas). La carga (congestión en días → carga total → id estable) solo
  desempata cuando se liberan EXACTAMENTE a la vez. Se **eliminó** el umbral de "fechas
  parecidas" (`closeWindowDays`). Umbrales que quedan, por-eje: `forceGeneralistDays`
  (especialista/generalista dentro del nivel), `levelEscalationDays`,
  `crossRoleEscalationDays`, `overloadSoftCapDays` (tope blando: único que mueve la fecha
  efectiva). Núcleo puro + tests Vitest siguen verdes.
- ✅ **Lock de creación por workspace (anti-concurrencia)**: dos creaciones casi
  simultáneas del mismo workspace ya no asignan tareas solapadas al mismo miembro.
  `withWorkspaceLock(wsId, fn)` (`src/lib/workspace-lock.ts`) serializa sobre la tabla
  Turso `assignment_lock` (PK `workspace_id` + `locked_at`, TTL 15s, INSERT ON CONFLICT +
  roba locks colgados; **degrada** a ejecutar sin lock si falla). `/api/tasks/parallel`
  envuelve "elegir diseñador + fecha + crear + invalidar" en él. Migración:
  `scripts/add-assignment-lock-table.js` (CREATE TABLE IF NOT EXISTS, idempotente).
- ✅ **Empuje en cascada de Low**: al crear una tarea de prioridad **> LOW** (Normal/High/
  Urgent), las Low **movibles** de cada diseñador asignado se recolocan DESPUÉS de ella en
  cascada, reprogramando fechas EN ClickUp. Una Low es movible solo si: TO_DO + creada hoy
  (mismo día local, `task_meta.createdAt`) + falta >1h para el cierre del día laboral; pasada
  esa ventana o en días anteriores, queda **fija** (su deadline ya se "comunicó" al
  solicitante). Núcleo puro `src/services/low-cascade.ts` (`isMovableLow`/`computeLowCascade`,
  con tests) + orquestador `cascadeLowTasksForUser` (`parallel-priority-insertion.service.ts`)
  + `rescheduleClickUpTaskDates` (clickup.service: PUT SOLO de fechas, token-aware — el viejo
  `updateTaskInClickUp` NO sirve: reescribe status/assignees, postea comentario, token global).
  Se expuso `utcOffsetHours` en `AppSettings` para anclar el "día local". **Único punto donde
  el motor modifica tareas existentes en ClickUp**; todo dentro del lock por workspace.

**Gestión de equipo:**
- ✅ **Form de crear**: arranca 100% vacío; sugiere SOLO con todo lleno (type, duración,
  brand, priority, level); limpia Tier/TaskType/Assignee al crear y por inactividad
  (gotcha: el `Select` necesita `value={value ?? ''}`, con `undefined` se vuelve no
  controlado y no limpia).
- ✅ **Miembros**: activar/desactivar (reversible; el motor lo excluye pero conserva
  roles/vacaciones), quitar del workspace (borra user+roles+vacaciones, NO toca ClickUp),
  editar nivel/roles/vacaciones. Modal de detalle con patrón **Save/Discard** (acumula
  cambios en estado local; `DiscardChangesDialog` al cerrar con cambios; "quitar" va
  aparte). Roles **SIN brand** (un rol = para todo el workspace); no permite rol duplicado.
- ✅ **Approvals auto-completar**: configurable y con on/off en Settings.
- ✅ **Fix auth**: `clickup_connection` ya no se duplicaba en cada login (se usa
  `account.providerAccountId` como id estable en `auth.config.ts` jwt + `auth.ts`).

**UX/UI (alineada con la intranet `inszone-intranet-patterns-okd`; mismo design system):**
- ✅ **Settings es una PÁGINA** `/settings` (ya NO un modal); el nav link va a la ruta.
- ✅ **Header**: badge de usuario con foto de ClickUp → dropdown `UserMenu` (identidad +
  ThemeToggle + Logout); `WorkspaceSwitcher` como dropdown en el nav. Componente
  `Dropdown` reutilizable con la transición exacta de la intranet (ENTER 220ms / EXIT
  160ms, `cubic-bezier(0.32,0.72,0,1)`, doble rAF). Header `z-[60]` por encima de la barra
  sticky. **Gotcha dark mode**: paneles flotantes usan `surface-card` (un paso más oscuro
  que `surface-raised`/`hover`/`border`, que en dark son todos `neutral-300`).
- ✅ **Lists como tabla con `Switch`** por lista (assignable), no MultiSelect.
- ✅ **Tasks**: solo el buscador (se quitó el botón Refresh; el realtime ya actualiza).
  Skeletons que hacen match (sin "salto" de tamaño). Capacity en una sola fila. Skeleton
  para usuarios sin sincronizar; los inactivos muestran card "Inactive" (no skeleton
  infinito — el endpoint `/api/users/workload` ya no filtra `active=true` y devuelve `active`).

**Tiempo real (Pusher, canal por workspace `tasks-{wsId}`; helpers en `src/lib/pusher.ts`,
cliente en `src/hooks/usePusherTaskSync.ts`):**
- ✅ **Tareas** (ya existía): webhook ClickUp → `task-updated` → invalida kanban/carga (+
  notificación del navegador).
- ✅ **Listas**: webhook ClickUp `listCreated/listUpdated/listDeleted` →
  `publishListsUpdate` → `lists-updated` → invalida `['clickup-lists']`.
  `ensureWorkspaceWebhook` hace **PUT** para añadir los eventos de listas a webhooks ya
  registrados → los workspaces existentes deben **RE-LOGUEAR** para recibirlos.
- ✅ **Sugerencia viva (A)**: todo evento realtime dispara el evento `window`
  `assignify:tasks-changed`; el form abierto y completo recalcula la sugerencia.
- ✅ **Miembros (interno)**: los endpoints que mutan el equipo (`/api/sync/clickup-users`
  POST, `/api/users/[userId]` PATCH/DELETE, `roles` POST + `roles/[roleId]` DELETE/PATCH,
  `vacations` POST + `vacations/[vacationId]` DELETE) emiten `members-updated`
  (`publishMembersUpdate`) → los demás usuarios del workspace refrescan equipo/carga en
  vivo y recalculan la sugerencia. **OJO: ClickUp NO emite webhook de altas/bajas de
  miembros del team** (solo tareas/listas/carpetas/espacios/goals); para detectar a quien
  se unió en ClickUp habría que hacer **polling** de `GET /team/{id}/member` (no
  implementado; `useClickUpUsers` tiene staleTime 2min + refetch al montar/focus como
  aproximación).

**Pendiente (operativo, al desplegar a prod):**
- En Vercel (Production): `WEBHOOK_PUBLIC_URL`, `CRON_SECRET` y `AUTH_URL=https://assignify.vercel.app`
  (este último para que el redirect del OAuth sea estable; ver `.env-production`).

### (Referencia) Plan original de Fase 4
1. **Sync de listas/brands por workspace** (lo más importante): página estilo
   `/designers` que DESCUBRE las listas del workspace (crawl space→folder→list con el
   token del usuario — reusar la lógica de `clickup-tasks.service`) y deja ELEGIR
   cuáles son asignables; se guardan como `brand` con su `workspaceId`/`teamId`.
   Endpoint nuevo `/api/sync/clickup-lists` (GET descubre, POST guarda). Hoy los brands
   se configuran a mano → un workspace nuevo no puede poblarlos. Estructura ClickUp =
   Team > Folder > List; un brand = una List (puede colgar de un space o de una
   carpeta). Naming: "Brand" es de Inszone; genérico = "List/Project" (decidir si
   renombrar o usar etiqueta configurable por workspace).
2. **Selector multi-workspace**: guardar TODOS los teams autorizados y permitir
   elegir/cambiar el activo (hoy se toma `teams[0]` en `events.signIn`). Persistir el
   elegido; `getCurrentClickUpContext` usa ese.
3. **Webhooks por workspace**: registrar un webhook por workspace al conectar (la OAuth
   app de ClickUp lo permite vía API); enrutar/validar por workspace (hoy hay 1 global).
4. **Cerrar hardening de Fase 2**: `getAppSettings` por workspace; scopear sub-rutas
   `/api/users/[userId]`(roles/vacations), creación de brands/tiers y `/api/settings`;
   PK de `user` → (workspaceId, clickupUserId); uniques por (workspaceId, …).
5. **Onboarding**: primer login ClickUp → elegir workspace → sync listas + miembros →
   definir tipos/tiers.

### Cómo arrancar mañana (checklist)
- Rama **`feat/saas-multi-tenant`** (NO mergear a `main` hasta validar). Seguir ahí.
- `.env`: `AUTH_SECRET`, `AUTH_CLICKUP_ID`/`AUTH_CLICKUP_SECRET`, `ENCRYPTION_KEY` (opc.),
  y **`DEFAULT_WORKSPACE_ID=9017044866`** (Inszone real). Luego `npm run dev`.
- Ids útiles: **Inszone real = 9017044866**; workspace de pruebas
  "Inszone Insurance" = **90171327636** (tiene 3 tareas de prueba en distintos status).
- Validar Fase 3 (admin Inszone vs login ClickUp) ANTES de empezar Fase 4.
- Verificación: `npx tsc --noEmit` · `npm run build` · `npm test` (20 tests).

## Plan por fases (sugerido)

1. **Auth ClickUp OAuth** (login + token cifrado por usuario) conviviendo con el
   single-tenant detrás de un flag.
2. **Modelo multi-tenant en DB**: columnas `workspaceId` + migración; scoping en
   todas las queries de config.
3. **Servicios/motor por token**: quitar el token global; pasar el del usuario.
4. **Webhooks por workspace** + caché por workspace.
5. **Onboarding + renombrado** Designers→Team y UI de config por workspace.
6. **Cuotas/escala**: rate-limits de ClickUp ahora por token de usuario (mejor que
   uno global), pero vigilar el crawl por workspace.

## Gotchas / a vigilar

- **No romper producción single-tenant** mientras se construye: rama separada + flag.
- ClickUp OAuth: definir bien el **redirect** (`/api/auth/callback/clickup`) y los
  scopes; el token no expira (guardar cifrado, permitir "reconectar").
- Cada query que hoy asume "todos los activos / todas las tareas" debe quedar
  **acotada al workspace**; un olvido = fuga de datos entre inquilinos.
- El motor (`assignment-ranking` es puro y no cambia; lo que cambia es de DÓNDE
  salen los slots: por workspace).
- Reusar la skill `assignify-context` para el detalle del motor/flujo actual.

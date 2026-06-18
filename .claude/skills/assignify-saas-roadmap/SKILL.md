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

> Estado: **PLANEADO, no implementado.** La app en producción es single-tenant
> (un workspace de ClickUp, `CLICKUP_API_TOKEN` global). Este documento captura el
> diseño acordado para transformarla en un SaaS donde cada persona conecta su
> propio ClickUp. Trabajar esto en una **rama aparte**; no romper el single-tenant.

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
- **Fase 3 — apenas la BASE; el grueso PENDIENTE (2 blockers):**
  - Hecho: `getCurrentClickUpContext()` (token de ClickUp por usuario + teamId;
    fallback al token global para el admin email/password).
  - **PENDIENTE (grueso):** enhebrar `{token, teamId}` por TODA la capa de ClickUp
    (`clickup-tasks.service`: `cu`/`fetchActiveClickUpTasks` con token + crawl acotado
    al teamId + cache por team; `clickup.service`: `createTaskInClickUp`; el motor
    `getVacationAwareUserSlots` ← suggestion/parallel; workload; kanban sync;
    sync-users) para que cada inquilino lea/cree con SU token y SU workspace.
  - **BLOCKER 1 — ids de workspace NO alineados con ClickUp**: la config de Turso
    quedó etiquetada con **90170099166** (= `brand.team_id`, probablemente STALE),
    pero el token ve los teams REALES **"Inszoneins"=9017044866** y "OAuth"=90171327636.
    Para Fase 3 el `workspaceId` DEBE ser el **team id real de ClickUp**. Primera tarea
    de Fase 3: confirmar el team real (casi seguro **9017044866**), re-backfillear Turso
    a ese id y ajustar `DEFAULT_WORKSPACE_ID`. (Fase 2 funciona igual: es consistente
    internamente.)
  - **BLOCKER 2 — testabilidad**: validar el aislamiento real requiere un SEGUNDO
    workspace con tareas/miembros propios (el "OAuth" está vacío).
  - **OJO discrepancia de ids**: el token global ve "Inszoneins"=9017044866 y
    "OAuth"=90171327636, pero los brands traen team_id 90170099166. Para Fase 2
    basta la CONSISTENCIA interna (todo etiquetado 90170099166 + `DEFAULT_WORKSPACE_ID`
    = 90170099166 → el admin ve su data). Resolver cuál es el id "real" de ClickUp
    es asunto de Fase 3 (lectura de tareas por token/workspace).
  - **Para activar/probar Fase 2**: poner `DEFAULT_WORKSPACE_ID=90170099166` en `.env`
    (y Vercel). El usuario que entra por ClickUp cae en su workspace propio (vacío);
    para ver la data de Inszone, entrar con email/password (→ DEFAULT).

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

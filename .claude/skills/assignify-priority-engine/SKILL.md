---
name: assignify-priority-engine
description: >-
  Cómo funciona EN DETALLE el motor de asignación / sistema de prioridades de Assignify:
  las dos preguntas (QUIÉN se asigna y CUÁNDO / con qué fechas), el modelo de carriles por
  prioridad, el comparador puro (fecha exacta → congestión → carga), el doble escalado
  (cargo sobre nivel), especialista vs generalista, el empuje en cascada de Low con su
  congelación al cierre del día, vacaciones, festivos y horario laboral, y la concurrencia
  (lock por workspace). CONSULTA esta skill siempre que toques el motor, la sugerencia de
  diseñador, el cálculo de fechas/deadlines, las prioridades, o debuggees por qué una tarea
  se asignó a cierto miembro o quedó fechada así. Complementa `assignify-context` (overview).
---

# Assignify — sistema de prioridades (motor de asignación) EN DETALLE

El motor responde DOS preguntas independientes, con código separado:

1. **¿QUIÉN?** — a qué diseñador sugerir/asignar. Vive en `task-assignment.service.ts`
   (IO) + `assignment-ranking.ts` (núcleo PURO, testeado).
2. **¿CUÁNDO?** — con qué `startDate`/`deadline` se crea la tarea. Vive en
   `parallel-priority-insertion.service.ts`, más el **empuje en cascada de Low**
   (`low-cascade.ts`).

Ambas comparten un mismo concepto central — el **CARRIL DE PRIORIDAD** — para que QUIÉN y
CUÁNDO concuerden. La PRIORIDAD nunca decide "a dedo" quién: influye solo vía fechas y
congestión del carril.

> Fuente de datos: las TAREAS se leen EN VIVO de ClickUp (`fetchActiveClickUpTasks`, crawl
> cacheado 45s por workspace). La CONFIG (miembros, roles, niveles, vacaciones, tiers, tipos,
> umbrales, horario) vive en Turso. Ver `assignify-context` para el reparto de datos.

---

## 0) Conceptos base

- **Prioridades** (`Priority`, `PRIORITY_RANK`): `LOW`(1) < `NORMAL`(2) < `HIGH`(3) < `URGENT`(4).
  `mapClickUpPriority` mapea el string de ClickUp (`urgent/high/normal/low`; default `NORMAL`).
- **Estados que OCUPAN** (`OCCUPYING_STATUSES` / `PENDING_CLICKUP_STATUSES`): solo `TO_DO` e
  `IN_PROGRESS`. **`ON_APPROVAL` NO cuenta** ni como carga ni para disponibilidad (ya está
  entregado). `mapClickUpStatusToLocal` decide el estado (ON_APPROVAL gana incluso a
  `type=closed/done`, porque Inszone marca "On Approval" como closed).
- **Carga total** (`totalAssignedDurationDays`): suma de **duraciones reales** de TODAS las
  tareas pendientes del diseñador (no el conteo). Duración por tarea = `estimateTaskDurationDays`:
  (1) `task_meta.durationDays` si la creó Assignify; (2) si no, días hábiles `start→due`;
  (3) piso de 1 día.
- **CARRIL de prioridad**: para una tarea de prioridad P, el "carril" son las tareas del
  diseñador de prioridad **IGUAL o MAYOR** a P. La tarea nueva se encola **tras** ese carril y
  corre **en paralelo** con las de menor prioridad. Así un URGENT no espera detrás de una cola
  de LOW.
- **1 día laboral = 8 horas.** El horario está en **UTC** y se edita por workspace (ver §6).

---

## 1) ¿QUIÉN? — sugerencia de diseñador

**Flujo:** `CreateTaskForm` → `useTaskSuggestion` → `GET /api/tasks/suggestion/simple` →
`getRankedCandidates` → `getVacationAwareUserSlots` (arma los slots) +
`selectBestUserWithVacationLogic` → `pickBestAcrossAffinity` (decide). Devuelve
`{ suggestedUserId, candidates[] }`: FUENTE ÚNICA del sugerido Y de las opciones+badges del
selector (no hay segundo endpoint/criterio).

### 1.1 Construir los slots — `getVacationAwareUserSlots`
Pool = **TODOS los miembros activos del workspace** (no se pre-filtra por compatibilidad; la
afinidad ordena la preferencia). Por cada uno calcula un `VacationAwareUserSlot`:

- **`roleAffinity`** (eje superior al de nivel): `1` = tiene rol para el `typeId` con
  `isPrimary=true` (cargo PRIMARIO); `2` = lo tiene con `isPrimary=false` (SECUNDARIO); `3` = no
  tiene rol para el tipo (otro cargo, fallback). El match de brand ya viene en la query
  (`roles where brandId = brand OR NULL`).
- **`availableDate`** (cuándo se libera): se calcula sobre el **carril** (`laneTasks` =
  prioridad ≥ la pedida): `getNextAvailableStart(max(dueDate del carril))`; si el carril está
  vacío, `getNextAvailableStart(now)`. Luego se ajusta saltando **vacaciones** del miembro
  (`getNextAvailableStartAfterVacations`).
- **`totalAssignedDurationDays`**: carga total (todas las pendientes, en días).
- **`samePriorityOrHigherLoadDays`**: congestión del carril en **días** de trabajo (lo que usa
  la DECISIÓN). `samePriorityOrHigherLoad` (conteo) solo alimenta el texto del selector.
- **`isSpecialist`**: tiene rol para el tipo pedido **y NINGÚN** rol de otro tipo.
- **`level`**: Jr/Mid/Sr (de Turso), para el escalado de nivel.
- **`status`** (badge, NO decide): `on_vacation` (de vacaciones ahora o su fecha se corrió por
  una vacación), `overloaded` (> `OVERLOAD_THRESHOLD_DAYS` = 10 días pendientes), o `available`.

### 1.2 Decidir — `pickBestAcrossAffinity` (núcleo PURO, `assignment-ranking.ts`)
DOBLE ESCALADO: **cargo por encima de nivel**. Lee los umbrales de `settings.ranking`.

1. Agrupa los slots por `roleAffinity` (1 primario → 2 secundario → 3 otro).
2. Dentro de cada grupo, `pickBestByLevelEscalation` elige respetando el **nivel**:
   - Solo niveles **≥ el pedido** (nunca uno inferior en automático).
   - Toma el mejor de cada nivel (`pickBestInLevel`) y empieza por el nivel pedido; si el mejor
     del nivel actual se libera **más de `levelEscalationDays`** después que el del nivel
     superior, **escala** (Jr→Mid→Sr).
3. **Escalado de cargo** entre grupos: empieza por el grupo de afinidad 1; si su mejor se libera
   **más de `crossRoleEscalationDays`** después que el del grupo siguiente, considera también
   ese grupo (1→2→3) — "ve a otros cargos cuando los preferidos están saturados".

`pickBestInLevel`: ordena por `compareSlots` y toma el primero; **matiz especialista/generalista**
— si el mejor es especialista y existe un generalista que se libera **más de `forceGeneralistDays`**
antes, prefiere al generalista (reservar al especialista).

### 1.3 El comparador — `compareSlots` (lo más importante)
Orden de preferencia entre dos slots:

1. **Fecha/hora EXACTA de liberación** (`effectiveAvailableMs`): quien se libera ANTES gana, con
   **cualquier** diferencia (medio día, horas). Es el criterio dominante; la cola ya está
   reflejada en esa fecha, así que **el tamaño de la cola NO compite con la fecha**.
2. Solo si empatan EXACTAMENTE al mismo instante, desempata por: **congestión del carril en días**
   (`samePriorityOrHigherLoadDays`) → **carga total** (`totalAssignedDurationDays`) → **id estable**
   (`userId`, nunca el orden de llegada al array).

`effectiveAvailableMs` = `availableDate`, salvo que `overloadSoftCapDays > 0` y el miembro
exceda ese tope de carga: entonces se le **empuja** la fecha efectiva en proporción al exceso
(tope blando para no sobreasignar). Con 0 (default) no hay penalización.

> ⚠️ Ya NO existe el umbral de "fechas parecidas" (`closeWindowDays`): se eliminó. Antes la
> congestión ganaba dentro de una ventana de días; ahora la fecha exacta manda y la congestión
> solo desempata el empate exacto.

### 1.4 Orden de la lista del selector — `getRankedCandidates`
Sugerido primero → por `status` (available < overloaded < on_vacation) → por `roleAffinity`
(1<2<3) → por fecha. Cada candidato trae un `reason` legible (`buildReason`).

El **override manual** (elegir a mano en el form) ignora cargo y nivel; se registra en
`task_meta.wasOverride`.

---

## 2) ¿CUÁNDO? — fechas (modelo de carriles) — `calculateParallelPriorityInsertion`

**Flujo:** `POST /api/tasks/parallel` → por cada diseñador asignado, `calculateParallelPriorityInsertion(userId, priority, durationDays, {token, teamId})`.

1. Lee las tareas activas del usuario en vivo (`getActiveClickUpTasksByUser`), filtra `deadline >= hoy`.
2. `queueAhead` = tareas de prioridad **≥** la pedida (el carril).
3. `startDate` = `getNextAvailableStart(max(deadline del carril))`; si no hay carril,
   `getNextAvailableStart(now)`.
4. `deadline` = `calculateWorkingDeadline(startDate, durationDays * 8)`.
5. Ajusta por vacaciones (`applyVacationLogic`).

Resultado por prioridad: **URGENT** tras la última URGENT; **HIGH** tras la última URGENT/HIGH;
**NORMAL** tras la última URGENT/HIGH/NORMAL; **LOW** al final. Cada prioridad corre en paralelo
con las menores. Históricamente esto **no movía** ninguna tarea (`noTasksAffected`) — hoy hay UNA
excepción: las Low (§3).

---

## 3) Empuje en cascada de Low (la prioridad reordena) — `low-cascade.ts` + `cascadeLowTasksForUser`

**Problema que resuelve:** como una Normal corre "en paralelo" con las Low, al crear una Normal en
un diseñador que ya tenía una Low, **ambas quedaban el mismo día** (solapadas). Una persona no hace
dos tareas de día completo a la vez.

**Regla:** al crear una tarea de prioridad **> LOW** (Normal/High/Urgent), las Low **movibles** de
cada diseñador asignado se recolocan **DESPUÉS** de la tarea nueva, **en cascada**, reprogramando
sus fechas EN ClickUp.

- **Una Low es MOVIBLE** (`isMovableLow`, núcleo puro) solo si las TRES:
  1. está en **`TO_DO`** (no empezada ni entregada);
  2. fue **creada hoy** — mismo **día local** del workspace, vía `task_meta.createdAt` (sin
     `task_meta`, p.ej. creada fuera de Assignify, → **no movible**);
  3. **falta más de ~1h** (`closeBufferHours`, def 1) para el **cierre del día laboral** (`END`).
  Si no, la Low queda **FIJA**: su deadline ya se considera **comunicado al solicitante** y no
  debe cambiar (los deadlines de Low se comunican al cierre del día; durante el día son
  provisionales y se reordenan). Todo se computa en **hora local** (anclada con
  `settings.utcOffsetHours`) para que el cruce de la medianoche UTC no descuadre "hoy" ni "la
  última hora".
- **Cascada** (`computeLowCascade`, núcleo puro): ordena las movibles por inicio actual; cursor
  inicia en el deadline de la tarea nueva; cada Low va a `max(su inicio, cursor)` resolviendo el
  hueco real (horario/festivos/vacaciones del dueño); el cursor avanza a su fin. **"Empujar, no
  adelantar"**: una Low que ya estaba después del cursor no se mueve.
- **IO** (`cascadeLowTasksForUser` en `parallel-priority-insertion.service.ts`): lee Low TO_DO del
  user, cruza `task_meta` (createdAt/durationDays), filtra movibles, corre la cascada con un
  `resolveOwnerSlot` (vacaciones del dueño), y aplica `rescheduleClickUpTaskDates` **secuencial**
  (al primer fallo CORTA, para no descuadrar el orden).
- **Enganche** (`/api/tasks/parallel`, dentro del `withWorkspaceLock`): tras crear la tarea y
  guardar `task_meta`, si `priority !== 'LOW'`, por cada diseñador asignado se llama
  `cascadeLowTasksForUser(userId, insertionResults[userId].deadline, …)`. Luego `publishTaskUpdate`
  (canal del workspace) + un evento extra si se movieron Low, y `invalidateAllCache`.

> **`rescheduleClickUpTaskDates`** (clickup.service): PUT a `/task/{id}` con SOLO `start_date`/
> `due_date` (+ `*_date_time:true`), token-aware. **NO usar `updateTaskInClickUp`**: reescribe
> status/assignees, postea comentario de metadata y usa el token global (rompe multi-tenant).
>
> **Es el ÚNICO punto donde el motor modifica fechas de tareas YA creadas en ClickUp.**

---

## 4) Ejemplo trabajado (el caso real)

Erick tiene una Normal que termina el **miércoles 19:00** (se libera el jueves).

1. **Crea una Low** → carril ≥ LOW = todas → tras la última deadline → **jueves 10:00–19:00**.
2. **Crea una Normal** → carril ≥ NORMAL (NO incluye la Low) → tras la última Normal → **jueves**.
   - **Antes:** Low y Normal ambas el jueves (solapadas). ❌
   - **Ahora:** el empuje de Low corre: la Low (movible: TO_DO + creada hoy + con margen) se
     recoloca tras el deadline de la Normal → **viernes**. Normal jueves, Low viernes. ✅
3. **3 Low + una Normal** → las 3 Low se empujan en cascada (vie, lun, mar…).
4. **Una Normal en la última hora del día** → la Low NO se mueve (su deadline ya se va a
   comunicar); la Normal se encola después de la Low.

---

## 5) Vacaciones, festivos y horario — `task-calculation-utils.ts`

- **`isNonWorkingDay`**: sábado, domingo o festivo (`usHolidays.json`, fechas YYYY-MM-DD UTC;
  incluye Juneteenth).
- **`getNextAvailableStart(date)`**: avanza hasta el primer instante laboral: salta no-laborables;
  si `hour < START` → START; si está en el almuerzo (`[LUNCH_START, LUNCH_END)`) → LUNCH_END; si
  `hour >= END` → siguiente día a START. Redondea a la siguiente media hora (`roundUpToNextHalfHour`).
- **`calculateWorkingDeadline(start, hoursNeeded)`**: consume las horas en los bloques de trabajo
  `[START, LUNCH_START]` y `[LUNCH_END, END]`, saltando no-laborables, hasta agotar `hoursNeeded`
  (= `durationDays * 8`).
- **Vacaciones**: si la tarea (empezando cuando el miembro se libera) choca con una vacación, el
  inicio se mueve a **después** de la vacación (`getNextAvailableStartAfterVacations`, hasta 10
  iteraciones por si hay varias). NO excluye al miembro: lo reprograma.

---

## 6) Settings del motor (Turso, por workspace) — `app-settings.service.ts`

`getAppSettings(workspaceId)` (cacheado 60s; fallback a `@/config` si la DB falla). Devuelve:

- **`workHours`** (en **UTC**): `START`, `LUNCH_START`, `LUNCH_END`, `END`. El usuario los edita en
  hora LOCAL + huso y se convierten (`utcHour = localHour − utcOffset`). Inszone (huso −5):
  `START 15, LUNCH 19–20, END 24` UTC = **10:00, 14:00–15:00, 19:00 local**. `END` puede ser 24
  (medianoche UTC).
- **`utcOffsetHours`** (p.ej. −5): expuesto para anclar el "día local" del empuje de Low.
- **`ranking`** (= `RankingConfig` del núcleo): `forceGeneralistDays` (especialista/generalista),
  `levelEscalationDays` (escalar de nivel), `crossRoleEscalationDays` (escalar de cargo),
  `overloadSoftCapDays` (tope blando de carga; 0 = off).

---

## 7) Concurrencia — `withWorkspaceLock` (`src/lib/workspace-lock.ts`)

`/api/tasks/parallel` envuelve "elegir diseñador + calcular fecha + crear + empujar Low + invalidar"
en un lock por workspace (tabla Turso `assignment_lock`, TTL 15s; INSERT ON CONFLICT + roba locks
colgados; **degrada** a ejecutar sin lock si falla). Así dos creaciones casi simultáneas del mismo
workspace se serializan: la 2ª ve ya la tarea (y las Low movidas) de la 1ª.

---

## 8) Archivos clave

| Pieza | Archivo |
|---|---|
| Núcleo PURO "¿QUIÉN?" (comparador + escalados) | `src/services/assignment-ranking.ts` (+ `.test.ts`) |
| IO "¿QUIÉN?" (slots, roleAffinity, congestión, vacaciones) | `src/services/task-assignment.service.ts` |
| IO "¿CUÁNDO?" (carriles) + empuje de Low (`cascadeLowTasksForUser`) | `src/services/parallel-priority-insertion.service.ts` |
| Núcleo PURO empuje de Low (`isMovableLow`/`computeLowCascade`) | `src/services/low-cascade.ts` (+ `.test.ts`) |
| Reprogramar fechas en ClickUp | `rescheduleClickUpTaskDates` en `src/services/clickup.service.ts` |
| Horario/festivos/deadline | `src/utils/task-calculation-utils.ts` |
| Mapeo prioridad/estado de ClickUp | `src/utils/clickup-status-mapping-utils.ts` |
| Settings del motor (umbrales/horario por workspace) | `src/services/app-settings.service.ts` |
| Lock por workspace | `src/lib/workspace-lock.ts` |
| Endpoints | `GET /api/tasks/suggestion/simple` (QUIÉN), `POST /api/tasks/parallel` (crear + CUÁNDO) |

## 9) Reglas de oro al tocar el motor
- El núcleo de decisión (`assignment-ranking.ts`, `low-cascade.ts`) es **PURO y testeado**:
  mantén la lógica ahí y añade tests Vitest (`npm test`); la IO solo lee datos y delega.
- **La fecha exacta manda** en QUIÉN; la prioridad influye solo vía carril/congestión y vía el
  empuje de Low en CUÁNDO. Nunca elijas diseñador "por prioridad" directamente.
- `ON_APPROVAL` no ocupa. La carga se mide en **días de duración real**, no en conteo de tareas.
- Verifica con `npx tsc --noEmit` + `npm test` antes de commitear; si tocas el motor, corre los tests.

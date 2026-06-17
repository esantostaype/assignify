# Roadmap de mejora — Assignify

> Plan por fases para volver a poner la app en uso. Cada fase entrega algo funcional
> por sí sola; se pueden ejecutar en sesiones separadas. Marca los `[ ]` a medida que avances.

## Contexto del diagnóstico (jun 2026)

- **Causa raíz del abandono:** el tiempo real con Socket.IO **no funciona en Vercel**.
  Vercel son funciones serverless efímeras; Socket.IO necesita un servidor vivo en memoria.
  El webhook actualiza la base de datos, pero el navegador nunca se entera → la lista se
  queda congelada. (`src/app/api/clickup-webhook/route.ts:603` llama por HTTP a
  `socket_emitter`, que casi siempre corre en otra instancia sin el objeto `io`.)
- **Decisión tomada:** reemplazar Socket.IO por **Pusher Channels** (tiempo real instantáneo,
  gestionado, plan gratis suficiente para un equipo de diseño: 200k mensajes/día, 100 conexiones).
- **Lo que está bien y NO se toca:** modelo de datos (`schema.prisma`), algoritmo de
  asignación por rol/carga/disponibilidad/vacaciones (`task-assignment.service.ts:676`),
  cálculo de deadlines con horario laboral y festivos (`task-calculation-utils.ts`).

---

## Fase 1 — Tiempo real + saneamiento del webhook  ⭐  ✅ COMPLETADA (16-jun-2026)

**Objetivo:** que un cambio de estado en ClickUp se refleje en la app en vivo, de forma
segura y sin ruido. Es lo que te hizo abandonar; se arregló primero.

Hecho a nivel de código (build de producción verificado, exit 0):

- [x] Cuenta y app de Pusher creadas (cluster `us2`).
- [x] `npm install pusher pusher-js` + `npm uninstall socket.io socket.io-client`.
- [x] Credenciales en `.env` (6 vars `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` + `CLICKUP_VERIFY_SIGNATURE`).
- [x] `src/lib/pusher.ts` (servidor) con helper `publishTaskUpdate()` tolerante a fallos.
- [x] `src/hooks/usePusherTaskSync.ts` + `src/components/RealtimeListener.tsx`, montado en
      `providers.tsx` (árbol autenticado, dentro de React Query). Al recibir evento invalida
      `taskKeys.clickup()` → el kanban se repinta solo.
- [x] Webhook: emisión por Pusher **centralizada** en `POST` para TODOS los eventos que mutan
      (antes solo emitía `taskUpdated`; `taskStatusUpdated`/`taskAssigneeUpdated` no emitían → bug).
- [x] **Emisores extra descubiertos y migrados a Pusher:** `api/tasks/route.ts`,
      `api/tasks/parallel/route.ts`, `api/tasks/[id]/route.ts` (usaba el patrón muerto
      `req.socket.server.io`) y `services/clickup.service.ts` (`emitTaskUpdateEvent`).
      Además, `config/index.ts` apuntaba el emitter a OTRO dominio (`task-automation-zeta`).
- [x] **Seguridad:** verificación de firma HMAC de ClickUp sobre el `rawBody`. Controlada por
      `CLICKUP_VERIFY_SIGNATURE` (en `false` registra el resultado; en `true` rechaza con 401).
- [x] **Limpieza:** los ~100 `console.log` del webhook quedan tras `DEBUG_WEBHOOK=true`
      (los `console.error` se mantienen).
- [x] **Socket.IO eliminado** por completo: archivos `socket_io.ts`, `socket_emitter.ts`,
      `useSocket.ts`, componentes muertos `TaskQueue.tsx` y `Tasks.tsx` (viejo), y deps.

**Activación en producción — ✅ VERIFICADO end-to-end (16-jun-2026):**

- [x] 6 variables `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` + `CLICKUP_VERIFY_SIGNATURE` cargadas en Vercel.
- [x] Token de ClickUp **rotado** (estaba expuesto, ver nota de seguridad abajo) y actualizado en `.env` + Vercel.
- [x] **Webhook de ClickUp reapuntado**: estaba en el dominio viejo `task-automation-zeta.vercel.app`
      y `suspended` (99 fallos). Ahora apunta a `https://assignify.vercel.app/api/clickup-webhook`,
      `active`, con eventos `taskCreated/Updated/Deleted/StatusUpdated/AssigneeUpdated`.
      Gestionado con `scripts/setup-clickup-webhook.js`.
- [x] Probado: cambiar estado en ClickUp → la tarjeta se mueve/desaparece en la app en vivo. ✅
- [x] Toast de aviso (sale siempre; ClickUp no manda el nombre en el webhook, se toma de la caché).

**Pendientes menores (seguridad):**

- [ ] **Rotar el `secret` de Pusher** (quedó expuesto en el chat) → actualizar `.env` + Vercel.
- [ ] Cuando confirmes que las firmas coinciden en logs, poner `CLICKUP_VERIFY_SIGNATURE=true` en Vercel.

**Nota de seguridad (resuelta):** había 3 tokens de ClickUp hardcodeados en `scripts/` que se
subieron a un repo público. Se sanearon los scripts (leen de `process.env`), se reescribió la
historia de git (force-push a un commit limpio) y se **rotó el token**. Los scripts de ClickUp
ahora se ejecutan con `node scripts/<archivo>.js` (cargan el token del `.env`).

**Hecho cuando:** cambias una tarea en ClickUp y la app la actualiza sola en <2s, sin recargar. ✅ LOGRADO

---

## Fase 2 — Limpieza del motor de asignación

**Objetivo:** un solo camino de asignación, mantenible, que respete la prioridad.

- [ ] Borrar endpoints muertos/duplicados, dejar solo `suggestion/simple`:
  - [ ] `src/app/api/tasks/suggestion/route.ts`
  - [ ] `src/app/api/tasks/suggestion/manual/route.ts`
  - [ ] `src/app/api/tasks/suggestion/smart/route.ts`  (633 líneas comentadas, ver Fase 4)
  - [ ] `src/app/api/tasks/suggestion/hybrid/route.ts`
- [ ] Borrar servicios huérfanos (nadie los importa):
  - [ ] `src/services/task-assignment-simplified.service.ts`
  - [ ] `src/services/parallel-priority-insertion.service.ts`
  - [ ] revisar si `optimized-data-fetcher.service.ts` se usa; si no, borrar.
- [ ] **Arreglar la prioridad hardcodeada:** `suggestion/simple/route.ts` pasa siempre
      `'NORMAL'` a `getBestUserWithCache`. Recibir `priority` real desde el front y pasarla.

**Hecho cuando:** queda 1 endpoint + 1 servicio de asignación, y una tarea URGENT se sugiere
distinto que una LOW.

---

## Fase 3 — Sincronización completa con ClickUp

**Objetivo:** que las tareas nuevas de ClickUp aparezcan solas, sin sincronización manual.

- [ ] Implementar `handleTaskCreated` de verdad (hoy solo escribe un log,
      `clickup-webhook/route.ts:656`): crear la tarea local con su mapeo de tipo/categoría/marca.
- [ ] **DECISIÓN PENDIENTE:** ¿la sincronización es solo ClickUp → app, o también
      app → ClickUp (bidireccional)? Definir antes de implementar.
- [ ] Manejo robusto de "tarea no encontrada" (¿crear vs. ignorar?).

**Hecho cuando:** creas una tarea en ClickUp y aparece en la app sin tocar el botón de sync.

---

## Fase 4 — UX de asignación (más intuitiva)

**Objetivo:** asignar de forma clara, sin parpadeos, viendo la disponibilidad de un vistazo.

- [ ] Reescribir el auto-select de `UserAssignmentSelect.tsx:86-152` sin la guerra de
      `refs`/`requestAnimationFrame`/flags. Patrón: sugerir visible → aplicar con 1 clic →
      no pelear con la selección manual.
- [ ] Panel por diseñador con: carga actual, próxima fecha libre, estado de vacaciones
      (los datos ya existen vía `useEnhancedUsers`).
- [ ] Rescatar la idea del viejo `/smart`: en vez de **excluir** a quien tiene vacaciones,
      ofrecer *"disponible a partir del X"*.

**Hecho cuando:** asignar una tarea es claro en una pasada, sin saltos de selección.

---

## Fase 5 — Pulido (opcional)

- [ ] Capa de IA con el AI SDK ya instalado: explicar en lenguaje natural *por qué* se
      sugirió a alguien.
- [ ] Vista kanban por estados con el tiempo real ya funcionando.
- [ ] Métricas de equipo (carga por persona, cuellos de botella).

---

### Orden recomendado
1 → 2 → 3 → 4 → 5. La Fase 1 sola ya devuelve la app a un estado usable.

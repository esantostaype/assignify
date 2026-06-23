'use client'
// Diccionario bilingüe (EN/ES) + contexto de idioma para la guía interactiva.
// El idioma vive solo en esta página (no afecta al resto de la app); el tema sí es
// el global (UiThemeProvider). EN es la fuente de la forma; ES debe calzar el mismo tipo.
import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'es'

const en = {
  topbar: { guide: 'Guide', back: 'Open the app', langLabel: 'Language' },
  nav: {
    intro: 'Overview',
    login: 'Sign in',
    setup: 'Set up',
    settings: 'Settings',
    criteria: 'How it assigns',
    example: 'Live example',
    create: 'Create a task',
  },
  hero: {
    badge: 'Interactive guide',
    title: 'Assign design work the smart way.',
    subtitle:
      'Assignify reads your live ClickUp tasks and decides WHO should take each new task and WHEN it realistically fits — by skill, level, priority and real working hours. This guide walks you through everything, step by step.',
    scroll: 'Start the tour',
  },
  login: {
    title: 'Sign in with ClickUp',
    lead: 'Assignify works on top of your own ClickUp workspace. You log in with ClickUp — no separate password — and Assignify only ever sees the workspace you authorize.',
    steps: [
      { title: 'Open Assignify', body: 'Go to the app and press “Continue with ClickUp”.' },
      { title: 'Authorize the workspace', body: 'ClickUp asks you to grant access. Pick the workspace (Team) you want Assignify to manage and confirm.' },
      { title: 'You’re in', body: 'You land on the Tasks board. Everything you see is your live ClickUp data — Assignify never stores a copy of your tasks, it reads them on the fly.' },
    ],
    note: 'Your token is per-user and scoped to that workspace. Switching workspace later is one click from the top bar.',
  },
  setup: {
    title: 'One-time set up',
    lead: 'Before the engine can assign anything, it needs to know three things: where tasks can go, what kinds of work exist, and who is on the team.',
    items: [
      {
        tag: 'Lists',
        title: 'Choose assignable lists',
        body: 'In Lists, toggle which ClickUp lists (your brands / clients) can receive tasks. Only the lists you enable show up when creating a task. The list never changes WHO does the work — it’s just where the task is filed.',
      },
      {
        tag: 'Types',
        title: 'Define task types',
        body: 'In Types, create the kinds of work you do — e.g. Graphic Design, UX/UI, Motion. Each member’s role is tied to a type, so types are what let the engine match the right person to the right task.',
      },
      {
        tag: 'Team',
        title: 'Sync your team',
        body: 'In Team, sync the ClickUp members who do the work. For each one you set a level (Junior / Mid / Senior), one or more roles (which type they cover, primary or secondary) and their vacations. That’s the raw material the engine ranks on.',
      },
    ],
  },
  settings: {
    title: 'Settings, explained',
    lead: 'Settings tune how the engine thinks. They live per workspace and you can change them any time — the next task you create uses the new values.',
    groups: [
      {
        name: 'Work schedule',
        desc: 'The hours a working day actually has. Everything — start dates, deadlines, the “frees up” date — is computed inside these hours, skipping lunch, weekends and US holidays.',
        fields: [
          { label: 'Start / End', desc: 'When the workday begins and ends in your local time (e.g. 10:00–19:00).' },
          { label: 'Lunch', desc: 'A non-working break in the middle of the day (e.g. 14:00–15:00). Tasks never consume these hours.' },
          { label: 'Timezone', desc: 'Your UTC offset. You edit hours in local time; the engine stores them in UTC so everyone sees consistent dates.' },
        ],
      },
      {
        name: 'Task assignment',
        desc: 'Four thresholds that decide when the engine “escalates” away from the most obvious person. All are measured in days of difference between candidates’ free dates.',
        fields: [
          { label: 'Force-generalist days', desc: 'If a specialist is the best pick but a generalist frees up this many days earlier, prefer the generalist — to keep specialists available for work only they can do.' },
          { label: 'Level escalation days', desc: 'Start at the requested level; if the best person at that level frees up more than this many days later than someone more senior, bump up a level (Jr→Mid→Sr).' },
          { label: 'Cross-role escalation days', desc: 'Start with primary-role people; if they free up more than this many days later than a secondary-role person, consider the secondary group too.' },
          { label: 'Overload soft cap', desc: 'A gentle ceiling: members past this much pending work get their effective free date nudged later, so the engine spreads load. 0 turns it off.' },
        ],
      },
      {
        name: 'Approvals',
        desc: 'When a task reaches the “On Approval” column it’s already delivered, so it no longer counts as load. You can let Assignify auto-complete delivered tasks after a while.',
        fields: [
          { label: 'Auto-complete', desc: 'Turn on to automatically close tasks that have been waiting in On Approval.' },
          { label: 'Delay', desc: 'How long a task waits in On Approval before it’s auto-completed.' },
        ],
      },
      {
        name: 'Tier durations',
        desc: 'Tiers are quick presets for how long a task takes (S, M, L, …). Picking a tier when creating a task pre-fills the duration; you can still override it.',
        fields: [
          { label: 'Duration per tier', desc: 'The default working time each tier represents, in your chosen unit (days, hours or minutes).' },
          { label: 'Unit', desc: 'The unit you prefer to think in. The engine always converts to working hours under the hood (1 day = 8 h).' },
        ],
      },
    ],
  },
  criteria: {
    title: 'How the engine assigns work',
    lead: 'Every time you create a task the engine answers two independent questions: WHO should do it, and WHEN does it realistically fit. The golden rule: priority never picks a person directly — it only influences dates.',
    whoTitle: 'WHO — picking the person',
    who: [
      { k: 'Affinity', t: 'Right role first', d: 'Members with a PRIMARY role for the task’s type are preferred, then SECONDARY roles, then everyone else. The type is the bridge between a task and a person.' },
      { k: 'The date rule', t: 'Whoever frees up first wins', d: 'This is the heart of it. The engine looks at the exact moment each candidate becomes free (after their current queue, lunch, weekends, holidays and vacations) and picks the earliest. The size of someone’s queue does NOT compete with the date — it’s already baked into when they free up.' },
      { k: 'Specialist vs generalist', t: 'Reserve the specialist', d: 'If a specialist and a generalist would free up around the same time, the generalist gets it — so the specialist stays open for work only they can do.' },
      { k: 'Level escalation', t: 'Senior only when it helps', d: 'It starts at the level you asked for and only climbs to a more senior person if that clearly frees the task up sooner.' },
      { k: 'Tie-breakers', t: 'Only on an exact tie', d: 'If two people free up at the very same instant, it breaks the tie by lane congestion, then total load, then a stable id — never by who happened to be listed first.' },
    ],
    whenTitle: 'WHEN — the dates',
    when: [
      { k: 'Priority lanes', t: 'Urgent never waits behind Low', d: 'A new task only queues behind tasks of EQUAL or HIGHER priority (its “lane”) and runs in parallel with lower ones. So an Urgent slots in right after the last Urgent/High — it doesn’t sit behind a pile of Low tasks.' },
      { k: 'Working time', t: 'Real hours, not calendar days', d: 'Deadlines are filled hour by hour inside your work schedule — skipping lunch, weekends, holidays and the assignee’s vacations. A 2-day task starting Friday lands on Tuesday, not the weekend.' },
      { k: 'The Low cascade', t: 'A higher task pushes today’s Low', d: 'Because a Normal runs in parallel with Low, creating one could overlap a Low you just made. So movable Low tasks (created today, not started, with time to spare) are pushed to AFTER the new task — “push, don’t advance”. Their deadline is only treated as final at the end of the day.' },
    ],
  },
  example: {
    title: 'See it in action',
    lead: 'Three members, one week. Step through a few real tasks and watch how the engine places each one. Bar colour = priority.',
    members: [
      { id: 'A', name: 'Member A', role: 'Graphic Design', level: 'Senior', tag: 'Specialist' },
      { id: 'B', name: 'Member B', role: 'Graphic Design · UX/UI', level: 'Mid', tag: 'Generalist' },
      { id: 'C', name: 'Member C', role: 'Graphic Design', level: 'Junior', tag: 'Specialist' },
    ],
    legend: { normal: 'Normal', low: 'Low', high: 'High', urgent: 'Urgent' },
    prev: 'Back',
    next: 'Next task',
    reset: 'Restart',
    start: 'All three members start with an empty week.',
    steps: [
      {
        task: 'Homepage redesign',
        meta: 'Graphic Design · Normal · 2 days',
        why: 'Everyone is free, so the engine picks one (here, Member A) and blocks Mon–Tue. From now on the others free up sooner than A.',
      },
      {
        task: 'Mobile app onboarding',
        meta: 'UX/UI · Normal · 1 day',
        why: 'This needs UX/UI, and only Member B holds that role. Affinity wins — it goes to B even though A and C are also around.',
      },
      {
        task: 'Sales one-pager',
        meta: 'Graphic Design · Normal · 1 day',
        why: 'A is busy until Tuesday and B until end of Monday. Member C is free right now and frees up first — the date rule decides.',
      },
      {
        task: 'Internal newsletter',
        meta: 'Graphic Design · Low · 1 day',
        why: 'A Low queues at the very end. Member B’s next open slot is Tuesday, so the Low lands there (grey bar).',
      },
      {
        task: 'Investor deck',
        meta: 'Graphic Design · Normal · 1 day',
        why: 'A Normal outranks a Low. It takes B’s Tuesday slot, and the newsletter Low — created today, not started — is PUSHED to Wednesday. “Push, don’t advance.”',
        highlight: true,
      },
    ],
  },
  create: {
    title: 'Create a task',
    lead: 'Now the easy part. Fill the form and Assignify suggests the best member and the dates in real time — you can accept the suggestion or pick someone yourself.',
    fields: [
      { label: 'Task type', desc: 'The kind of work — drives who is eligible.' },
      { label: 'Level', desc: 'The minimum level you want; the engine may go higher only if it helps.' },
      { label: 'Name', desc: 'What the task is called in ClickUp.' },
      { label: 'List', desc: 'Which ClickUp list it’s filed under. Does not affect who or when.' },
      { label: 'Tier & duration', desc: 'Pick a tier to pre-fill the duration, or type your own.' },
      { label: 'Priority', desc: 'Low / Normal / High / Urgent — influences the dates, never the person.' },
      { label: 'Assignee', desc: 'The engine suggests one; override it any time.' },
    ],
    outro: 'Press Create and Assignify writes the task back to ClickUp with the right assignee, start date and deadline — and, if needed, gently reshuffles today’s movable Low tasks.',
    cta: 'Open Assignify',
  },
  footer: 'Assignify by Inszone — smart assignment for creative teams.',
}

type GuideContent = typeof en

const es: GuideContent = {
  topbar: { guide: 'Guía', back: 'Abrir la app', langLabel: 'Idioma' },
  nav: {
    intro: 'Resumen',
    login: 'Iniciar sesión',
    setup: 'Configurar',
    settings: 'Ajustes',
    criteria: 'Cómo asigna',
    example: 'Ejemplo en vivo',
    create: 'Crear una tarea',
  },
  hero: {
    badge: 'Guía interactiva',
    title: 'Asigna el trabajo de diseño de forma inteligente.',
    subtitle:
      'Assignify lee tus tareas de ClickUp en vivo y decide QUIÉN debería tomar cada tarea nueva y CUÁNDO encaja de verdad — por especialidad, nivel, prioridad y horario laboral real. Esta guía te lo explica todo, paso a paso.',
    scroll: 'Empezar el recorrido',
  },
  login: {
    title: 'Inicia sesión con ClickUp',
    lead: 'Assignify funciona sobre tu propio workspace de ClickUp. Inicias sesión con ClickUp —sin otra contraseña— y Assignify solo ve el workspace que autorices.',
    steps: [
      { title: 'Abre Assignify', body: 'Entra a la app y pulsa “Continuar con ClickUp”.' },
      { title: 'Autoriza el workspace', body: 'ClickUp te pide dar acceso. Elige el workspace (Team) que quieres que Assignify gestione y confirma.' },
      { title: 'Listo', body: 'Llegas al tablero de Tareas. Todo lo que ves son tus datos en vivo de ClickUp — Assignify nunca guarda una copia de tus tareas, las lee al vuelo.' },
    ],
    note: 'Tu token es por-usuario y limitado a ese workspace. Cambiar de workspace después es un clic desde la barra superior.',
  },
  setup: {
    title: 'Configuración inicial',
    lead: 'Antes de que el motor pueda asignar, necesita saber tres cosas: dónde pueden ir las tareas, qué tipos de trabajo existen y quién está en el equipo.',
    items: [
      {
        tag: 'Listas',
        title: 'Elige las listas asignables',
        body: 'En Listas activas qué listas de ClickUp (tus marcas / clientes) pueden recibir tareas. Solo las que actives aparecen al crear una tarea. La lista nunca cambia QUIÉN hace el trabajo — solo es dónde se archiva.',
      },
      {
        tag: 'Tipos',
        title: 'Define los tipos de tarea',
        body: 'En Tipos creas las clases de trabajo que haces — p. ej. Graphic Design, UX/UI, Motion. El cargo de cada miembro va ligado a un tipo, así que los tipos son lo que permite al motor emparejar a la persona correcta con la tarea correcta.',
      },
      {
        tag: 'Equipo',
        title: 'Sincroniza tu equipo',
        body: 'En Equipo sincronizas a los miembros de ClickUp que hacen el trabajo. A cada uno le defines un nivel (Junior / Mid / Senior), uno o más cargos (qué tipo cubren, primario o secundario) y sus vacaciones. Esa es la materia prima que el motor ordena.',
      },
    ],
  },
  settings: {
    title: 'Los ajustes, explicados',
    lead: 'Los ajustes afinan cómo piensa el motor. Viven por workspace y los puedes cambiar cuando quieras — la siguiente tarea que crees usa los nuevos valores.',
    groups: [
      {
        name: 'Horario laboral',
        desc: 'Las horas que de verdad tiene un día de trabajo. Todo —fechas de inicio, deadlines, la fecha en que alguien “se libera”— se calcula dentro de estas horas, saltando el almuerzo, fines de semana y feriados de EE. UU.',
        fields: [
          { label: 'Inicio / Fin', desc: 'Cuándo empieza y termina el día en tu hora local (p. ej. 10:00–19:00).' },
          { label: 'Almuerzo', desc: 'Una pausa no laborable a media jornada (p. ej. 14:00–15:00). Las tareas nunca consumen estas horas.' },
          { label: 'Zona horaria', desc: 'Tu huso (offset UTC). Editas las horas en local; el motor las guarda en UTC para que todos vean fechas consistentes.' },
        ],
      },
      {
        name: 'Asignación de tareas',
        desc: 'Cuatro umbrales que deciden cuándo el motor “escala” fuera de la persona más obvia. Todos se miden en días de diferencia entre las fechas de liberación de los candidatos.',
        fields: [
          { label: 'Días para forzar generalista', desc: 'Si un especialista es la mejor opción pero un generalista se libera estos días antes, prefiere al generalista — para mantener a los especialistas libres para lo que solo ellos pueden hacer.' },
          { label: 'Días para escalar de nivel', desc: 'Empieza en el nivel pedido; si el mejor de ese nivel se libera más de estos días después que alguien más senior, sube de nivel (Jr→Mid→Sr).' },
          { label: 'Días para escalar de cargo', desc: 'Empieza por los de cargo primario; si se liberan más de estos días después que alguien de cargo secundario, considera también al grupo secundario.' },
          { label: 'Tope blando de carga', desc: 'Un techo suave: a los miembros que pasan esta carga pendiente se les empuja la fecha efectiva más tarde, para repartir la carga. 0 lo desactiva.' },
        ],
      },
      {
        name: 'Aprobaciones',
        desc: 'Cuando una tarea llega a la columna “On Approval” ya está entregada, así que deja de contar como carga. Puedes dejar que Assignify auto-complete las tareas entregadas tras un tiempo.',
        fields: [
          { label: 'Auto-completar', desc: 'Actívalo para cerrar automáticamente las tareas que llevan rato esperando en On Approval.' },
          { label: 'Espera', desc: 'Cuánto espera una tarea en On Approval antes de auto-completarse.' },
        ],
      },
      {
        name: 'Duración por tier',
        desc: 'Los tiers son presets rápidos de cuánto toma una tarea (S, M, L, …). Elegir un tier al crear una tarea precarga la duración; igual la puedes cambiar.',
        fields: [
          { label: 'Duración por tier', desc: 'El tiempo de trabajo por defecto que representa cada tier, en la unidad que elijas (días, horas o minutos).' },
          { label: 'Unidad', desc: 'La unidad en la que prefieres pensar. El motor siempre convierte a horas de trabajo por dentro (1 día = 8 h).' },
        ],
      },
    ],
  },
  criteria: {
    title: 'Cómo asigna el motor',
    lead: 'Cada vez que creas una tarea el motor responde dos preguntas independientes: QUIÉN la hace y CUÁNDO encaja de verdad. La regla de oro: la prioridad nunca elige persona directamente — solo influye en las fechas.',
    whoTitle: 'QUIÉN — elegir a la persona',
    who: [
      { k: 'Afinidad', t: 'Primero el cargo correcto', d: 'Se prefiere a quienes tienen un cargo PRIMARIO para el tipo de la tarea, luego SECUNDARIO, luego el resto. El tipo es el puente entre una tarea y una persona.' },
      { k: 'La regla de la fecha', t: 'Gana quien se libera primero', d: 'Es el corazón de todo. El motor mira el instante exacto en que cada candidato queda libre (tras su cola actual, almuerzo, fines de semana, feriados y vacaciones) y elige el más temprano. El tamaño de la cola NO compite con la fecha — ya está reflejado en cuándo se libera.' },
      { k: 'Especialista vs generalista', t: 'Reserva al especialista', d: 'Si un especialista y un generalista se liberarían casi a la vez, se la lleva el generalista — para que el especialista quede libre para lo que solo él puede hacer.' },
      { k: 'Escalado de nivel', t: 'Senior solo cuando ayuda', d: 'Arranca en el nivel que pediste y solo sube a alguien más senior si eso libera la tarea claramente antes.' },
      { k: 'Desempates', t: 'Solo ante un empate exacto', d: 'Si dos personas se liberan en el mismísimo instante, desempata por congestión del carril, luego carga total, luego un id estable — nunca por quién apareció primero en la lista.' },
    ],
    whenTitle: 'CUÁNDO — las fechas',
    when: [
      { k: 'Carriles por prioridad', t: 'Un Urgent nunca espera tras un Low', d: 'Una tarea nueva solo hace cola tras tareas de prioridad IGUAL o MAYOR (su “carril”) y corre en paralelo con las menores. Así un Urgent entra justo tras el último Urgent/High — no se sienta detrás de una pila de Low.' },
      { k: 'Tiempo laboral', t: 'Horas reales, no días de calendario', d: 'Los deadlines se llenan hora por hora dentro de tu horario — saltando almuerzo, fines de semana, feriados y las vacaciones de quien la hace. Una tarea de 2 días que empieza el viernes cae el martes, no el fin de semana.' },
      { k: 'La cascada de Low', t: 'Una tarea mayor empuja al Low de hoy', d: 'Como un Normal corre en paralelo con los Low, crear uno podría solaparse con un Low que acabas de hacer. Por eso los Low movibles (creados hoy, sin empezar, con margen) se empujan DESPUÉS de la tarea nueva — “empujar, no adelantar”. Su deadline solo se da por final al cierre del día.' },
    ],
  },
  example: {
    title: 'Míralo funcionando',
    lead: 'Tres miembros, una semana. Avanza por unas tareas reales y mira cómo el motor coloca cada una. Color de barra = prioridad.',
    members: [
      { id: 'A', name: 'Member A', role: 'Graphic Design', level: 'Senior', tag: 'Especialista' },
      { id: 'B', name: 'Member B', role: 'Graphic Design · UX/UI', level: 'Mid', tag: 'Generalista' },
      { id: 'C', name: 'Member C', role: 'Graphic Design', level: 'Junior', tag: 'Especialista' },
    ],
    legend: { normal: 'Normal', low: 'Low', high: 'High', urgent: 'Urgent' },
    prev: 'Atrás',
    next: 'Siguiente tarea',
    reset: 'Reiniciar',
    start: 'Los tres miembros empiezan con la semana vacía.',
    steps: [
      {
        task: 'Rediseño de homepage',
        meta: 'Graphic Design · Normal · 2 días',
        why: 'Todos están libres, así que el motor elige a uno (aquí, Member A) y bloquea lun–mar. Desde ahora los demás se liberan antes que A.',
      },
      {
        task: 'Onboarding de la app móvil',
        meta: 'UX/UI · Normal · 1 día',
        why: 'Esto necesita UX/UI, y solo Member B tiene ese cargo. Gana la afinidad — va para B aunque A y C también estén disponibles.',
      },
      {
        task: 'One-pager de ventas',
        meta: 'Graphic Design · Normal · 1 día',
        why: 'A está ocupado hasta el martes y B hasta el final del lunes. Member C está libre ahora y se libera primero — decide la regla de la fecha.',
      },
      {
        task: 'Newsletter interno',
        meta: 'Graphic Design · Low · 1 día',
        why: 'Un Low hace cola al final del todo. El siguiente hueco de Member B es el martes, así que el Low cae ahí (barra gris).',
      },
      {
        task: 'Deck para inversores',
        meta: 'Graphic Design · Normal · 1 día',
        why: 'Un Normal manda sobre un Low. Toma el hueco del martes de B, y el Low del newsletter —creado hoy, sin empezar— se EMPUJA al miércoles. “Empujar, no adelantar.”',
        highlight: true,
      },
    ],
  },
  create: {
    title: 'Crea una tarea',
    lead: 'Ahora lo fácil. Llena el formulario y Assignify sugiere el mejor miembro y las fechas en tiempo real — puedes aceptar la sugerencia o elegir a alguien tú.',
    fields: [
      { label: 'Tipo de tarea', desc: 'La clase de trabajo — define quién es elegible.' },
      { label: 'Nivel', desc: 'El nivel mínimo que quieres; el motor puede subir solo si ayuda.' },
      { label: 'Nombre', desc: 'Cómo se llama la tarea en ClickUp.' },
      { label: 'Lista', desc: 'En qué lista de ClickUp se archiva. No afecta a quién ni cuándo.' },
      { label: 'Tier y duración', desc: 'Elige un tier para precargar la duración, o escribe la tuya.' },
      { label: 'Prioridad', desc: 'Low / Normal / High / Urgent — influye en las fechas, nunca en la persona.' },
      { label: 'Asignado', desc: 'El motor sugiere uno; cámbialo cuando quieras.' },
    ],
    outro: 'Pulsa Crear y Assignify escribe la tarea de vuelta en ClickUp con el asignado, la fecha de inicio y el deadline correctos — y, si hace falta, reacomoda con suavidad los Low movibles de hoy.',
    cta: 'Abrir Assignify',
  },
  footer: 'Assignify by Inszone — asignación inteligente para equipos creativos.',
}

const DICT: Record<Lang, GuideContent> = { en, es }

interface GuideCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: GuideContent
}
const GuideContext = createContext<GuideCtx | null>(null)

export function GuideLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  return <GuideContext.Provider value={{ lang, setLang, t: DICT[lang] }}>{children}</GuideContext.Provider>
}

export function useGuide(): GuideCtx {
  const ctx = useContext(GuideContext)
  if (!ctx) throw new Error('useGuide must be used inside <GuideLangProvider>')
  return ctx
}

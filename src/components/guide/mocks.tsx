'use client'
// Mini-mockups animados de cada parte de la app, para que la guía sea GRÁFICA (estilo
// railway) y no cajas de texto. Cada uno representa una pantalla real de Assignify con un
// toque de movimiento (framer-motion). Bilingües vía useGuide(). Tema = el global.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Clock01Icon,
  Target02Icon,
  CheckmarkCircle01Icon,
  Layers01Icon,
  Folder01Icon,
  SwatchIcon,
  UserGroup03Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/cn'
import { Icon, PiCheck, PiArrowRight, PiSparkle } from '@/lib/icons'
import { Logo } from '@/components/Logo'
import { useGuide } from './i18n'

const AV = ['https://i.pravatar.cc/80?img=12', 'https://i.pravatar.cc/80?img=47', 'https://i.pravatar.cc/80?img=32']
const ease = [0.32, 0.72, 0, 1] as const

// ── Faux app window ─────────────────────────────────────────────────────────────
function Win({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-(--color-border-default) bg-(--color-surface-card) shadow-sm', className)}>
      <div className="flex items-center gap-1.5 border-b border-(--color-border-default) bg-(--color-surface-subtle) px-3 py-2">
        <span className="size-2.5 rounded-full bg-error-500/50" />
        <span className="size-2.5 rounded-full bg-warning-500/50" />
        <span className="size-2.5 rounded-full bg-success-500/50" />
        {title && <span className="ml-2 truncate text-[11px] text-(--color-text-muted)">{title}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// Avatar redondo de muestra.
function Av({ i, size = 28 }: { i: number; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={AV[i]} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-(--color-border-default)" style={{ width: size, height: size }} />
}

// ── 1 · Login (proceso de 3 frames con highlight que avanza) ──────────────────────
export function LoginFlow() {
  const { t } = useGuide()
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 1700)
    return () => clearInterval(id)
  }, [])

  const Frame = ({ i, children }: { i: number; children: React.ReactNode }) => (
    <motion.div
      animate={{ opacity: active === i ? 1 : 0.55, scale: active === i ? 1 : 0.97 }}
      transition={{ duration: 0.4, ease }}
      className={cn(
        'relative flex-1 rounded-xl border bg-(--color-surface-card) p-3',
        active === i ? 'border-primary-500/60 shadow-md shadow-primary-500/10' : 'border-(--color-border-default)',
      )}
    >
      <span className="absolute -top-2 left-3 grid size-5 place-items-center rounded-full bg-primary-600 text-[10px] font-bold text-white">{i + 1}</span>
      {children}
    </motion.div>
  )

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      {/* Frame 1 — sign in */}
      <Frame i={0}>
        <div className="flex flex-col items-center gap-2.5 py-2 text-center">
          <Logo width={92} height={26} />
          <motion.div
            animate={active === 0 ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 1.2, repeat: active === 0 ? Infinity : 0 }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            <span className="size-1.5 rounded-full bg-white" />
            Continue with ClickUp
          </motion.div>
        </div>
      </Frame>
      <Icon icon={PiArrowRight} size={16} className="mx-auto hidden shrink-0 text-(--color-text-muted) sm:block" />
      {/* Frame 2 — authorize */}
      <Frame i={1}>
        <div className="py-2 text-center">
          <div className="mx-auto mb-2 grid size-7 place-items-center rounded-md bg-(--color-surface-subtle) text-[11px] font-bold text-(--color-text-muted)">CU</div>
          <div className="text-[11px] font-medium text-(--color-text-strong)">{t.login.steps[1].title}</div>
          <div className="mt-2 inline-flex rounded-md bg-success-500/15 px-2.5 py-1 text-[10px] font-semibold text-success-600">Allow ✓</div>
        </div>
      </Frame>
      <Icon icon={PiArrowRight} size={16} className="mx-auto hidden shrink-0 text-(--color-text-muted) sm:block" />
      {/* Frame 3 — tasks board */}
      <Frame i={2}>
        <div className="py-2">
          <div className="mb-1.5 text-[10px] font-semibold text-(--color-text-muted)">Tasks</div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((c) => (
              <div key={c} className="flex-1 space-y-1 rounded-md bg-(--color-surface-subtle) p-1.5">
                <div className="h-1.5 w-3/4 rounded bg-(--color-border-strong)" />
                <div className="h-4 rounded bg-(--color-surface-card)" />
                <div className="h-4 rounded bg-(--color-surface-card)" />
              </div>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  )
}

// ── 2 · Setup (Lists / Types / Team) ──────────────────────────────────────────────
export function SetupMocks() {
  const { t } = useGuide()
  const [on, setOn] = useState([true, true, false])
  useEffect(() => {
    const id = setInterval(() => setOn((o) => [o[0], o[1], !o[2]]), 1500)
    return () => clearInterval(id)
  }, [])
  const lists = ['Inszone', 'R.E. Chaix', 'Pinney']
  const types = ['Graphic Design', 'UX/UI', 'Motion']
  const team = [
    { n: 'Member A', lv: 'Senior' },
    { n: 'Member B', lv: 'Mid' },
    { n: 'Member C', lv: 'Junior' },
  ]
  const lvColor: Record<string, string> = {
    Senior: 'bg-primary-500/15 text-primary-600',
    Mid: 'bg-warning-500/15 text-warning-600',
    Junior: 'bg-success-500/15 text-success-600',
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Lists */}
      <Win title={t.setup.items[0].tag}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-(--color-text-strong)">
          <HugeiconsIcon icon={Folder01Icon} size={15} /> {t.setup.items[0].title}
        </div>
        <div className="space-y-1.5">
          {lists.map((l, i) => (
            <div key={l} className="flex items-center justify-between rounded-md bg-(--color-surface-subtle) px-2.5 py-1.5">
              <span className="text-[11px] text-(--color-text-default)">{l}</span>
              <span className={cn('flex h-4 w-7 items-center rounded-full p-0.5 transition-colors', on[i] ? 'bg-primary-600' : 'bg-(--color-border-strong)')}>
                <motion.span layout className="size-3 rounded-full bg-white" style={{ marginLeft: on[i] ? 'auto' : 0 }} />
              </span>
            </div>
          ))}
        </div>
      </Win>
      {/* Types */}
      <Win title={t.setup.items[1].tag}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-(--color-text-strong)">
          <HugeiconsIcon icon={SwatchIcon} size={15} /> {t.setup.items[1].title}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {types.map((ty, i) => (
            <motion.span
              key={ty}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, ease }}
              className="rounded-md bg-primary-500/12 px-2.5 py-1 text-[11px] font-medium text-primary-600"
            >
              {ty}
            </motion.span>
          ))}
        </div>
      </Win>
      {/* Team */}
      <Win title={t.setup.items[2].tag}>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-(--color-text-strong)">
          <HugeiconsIcon icon={UserGroup03Icon} size={15} /> {t.setup.items[2].title}
        </div>
        <div className="space-y-1.5">
          {team.map((m, i) => (
            <div key={m.n} className="flex items-center gap-2 rounded-md bg-(--color-surface-subtle) px-2 py-1.5">
              <Av i={i} size={22} />
              <span className="truncate text-[11px] text-(--color-text-default)">{m.n}</span>
              <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold', lvColor[m.lv])}>{m.lv}</span>
            </div>
          ))}
        </div>
      </Win>
    </div>
  )
}

// ── 3 · Settings (panel con tabs + campos) ─────────────────────────────────────────
export function SettingsMock() {
  const { t } = useGuide()
  const tabs = [
    { icon: Clock01Icon, name: t.settings.groups[0].name },
    { icon: Target02Icon, name: t.settings.groups[1].name },
    { icon: CheckmarkCircle01Icon, name: t.settings.groups[2].name },
    { icon: Layers01Icon, name: t.settings.groups[3].name },
  ]
  const [active, setActive] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % tabs.length), 1900)
    return () => clearInterval(id)
  }, [tabs.length])
  return (
    <Win title="Settings">
      <div className="flex gap-4">
        {/* tabs */}
        <div className="w-2/5 space-y-1 border-r border-(--color-border-default) pr-3">
          {tabs.map((tb, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
                active === i ? 'bg-(--color-text-muted)/[0.1] text-(--color-text-strong)' : 'text-(--color-text-muted)',
              )}
            >
              <HugeiconsIcon icon={tb.icon} size={14} className="shrink-0" />
              <span className="truncate">{tb.name}</span>
            </button>
          ))}
        </div>
        {/* fields */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.22 }}
              className="space-y-2.5"
            >
              {t.settings.groups[active].fields.slice(0, 3).map((f, j) => (
                <div key={j}>
                  <div className="mb-1 text-[10px] font-semibold text-(--color-text-default)">{f.label}</div>
                  <div className="flex h-6 items-center rounded-md border border-(--color-border-default) bg-(--color-surface-input) px-2 text-[10px] text-(--color-text-muted)">
                    {active === 0 && j === 0 ? '10:00 – 19:00' : active === 0 && j === 1 ? '14:00 – 15:00' : '···'}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Win>
  )
}

// ── 4 · Criteria (WHO ranking + WHEN priority lanes) ────────────────────────────────
export function CriteriaFlow() {
  const { t, lang } = useGuide()
  // WHO: el "free in" de cada miembro; el ganador (menor) se resalta.
  const who = [
    { i: 0, free: '2d', val: 2 },
    { i: 1, free: '1d', val: 1 },
    { i: 2, free: 'now', val: 0 },
  ]
  const winner = 2
  // WHEN: carriles; un Urgent entra al frente.
  const lanes: { k: 'urgent' | 'high' | 'normal' | 'low'; bg: string }[] = [
    { k: 'urgent', bg: 'bg-error-500' },
    { k: 'high', bg: 'bg-warning-500' },
    { k: 'normal', bg: 'bg-primary-500' },
    { k: 'low', bg: 'bg-neutral-400' },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* WHO */}
      <div className="rounded-xl border border-(--color-border-default) bg-(--color-surface-card) p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-500">{t.criteria.whoTitle}</div>
        <div className="space-y-2">
          {who.map((w) => (
            <motion.div
              key={w.i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: w.i * 0.1, ease }}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-2 transition-colors',
                w.i === winner ? 'border-primary-500/60 bg-primary-500/10' : 'border-(--color-border-default)',
              )}
            >
              <Av i={w.i} size={28} />
              <span className="text-xs font-medium text-(--color-text-strong)">Member {String.fromCharCode(65 + w.i)}</span>
              <span className="ml-auto text-[11px] text-(--color-text-muted)">
                {lang === 'es' ? 'libre' : 'free'}: {w.free}
              </span>
              {w.i === winner && (
                <motion.span
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}
                  className="grid size-4 place-items-center rounded-full bg-primary-600 text-white"
                >
                  <Icon icon={PiCheck} size={10} />
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-(--color-text-muted)">{t.criteria.who[1].d}</p>
      </div>

      {/* WHEN — priority lanes */}
      <div className="rounded-xl border border-(--color-border-default) bg-(--color-surface-card) p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-warning-600">{t.criteria.whenTitle}</div>
        <div className="space-y-2">
          {lanes.map((ln, idx) => (
            <div key={ln.k} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[10px] font-semibold text-(--color-text-muted)">{t.example.legend[ln.k]}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-(--color-surface-subtle)">
                {/* existing block */}
                {idx !== 0 && <div className={cn('absolute inset-y-1 left-1 w-1/3 rounded', ln.bg, 'opacity-70')} />}
                {/* the urgent task slides into the front of its lane */}
                {idx === 0 && (
                  <motion.div
                    initial={{ x: '120%' }}
                    whileInView={{ x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.6, ease }}
                    className={cn('absolute inset-y-1 left-1 flex w-2/5 items-center justify-center rounded text-[9px] font-bold text-white', ln.bg)}
                  >
                    NEW ★
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-(--color-text-muted)">{t.criteria.when[0].d}</p>
      </div>
    </div>
  )
}

// ── 5 · Create (form + sugerencia en vivo) ──────────────────────────────────────────
export function CreateFlow() {
  const { t, lang } = useGuide()
  const rows = [
    { label: t.create.fields[0].label, val: 'Graphic Design' },
    { label: t.create.fields[5].label, val: 'Normal' },
    { label: t.create.fields[4].label, val: '2d' },
  ]
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_minmax(200px,260px)]">
      {/* form */}
      <Win title={t.create.title}>
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, ease }}
            >
              <div className="mb-1 text-[10px] font-semibold text-(--color-text-muted)">{r.label}</div>
              <div className="flex h-7 items-center rounded-md border border-(--color-border-default) bg-(--color-surface-input) px-2.5 text-[11px] font-medium text-(--color-text-strong)">
                {r.val}
              </div>
            </motion.div>
          ))}
        </div>
      </Win>

      <Icon icon={PiArrowRight} size={18} className="mx-auto hidden text-primary-500 sm:block" />

      {/* live suggestion */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 22 }}
        className="rounded-xl border border-primary-500/40 bg-primary-500/[0.06] p-4"
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-bold text-primary-600">
          <Icon icon={PiSparkle} size={11} /> {lang === 'es' ? 'Sugerido' : 'Suggested'}
        </div>
        <div className="flex items-center gap-2.5">
          <Av i={0} size={36} />
          <div>
            <div className="text-sm font-semibold text-(--color-text-strong)">Member A</div>
            <div className="text-[11px] text-(--color-text-muted)">Senior · Graphic Design</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-(--color-surface-card) px-2.5 py-1.5 text-[11px] text-(--color-text-default)">
          <Icon icon={PiCheck} size={12} className="text-success-600" />
          Jun 16 → Jun 17
        </div>
      </motion.div>
    </div>
  )
}

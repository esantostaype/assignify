'use client'
// Ejemplo interactivo del motor: 3 miembros, una semana, y un stepper (con auto-play) que
// crea 10 tareas y muestra —con un gantt animado full-width— cómo el motor las coloca por
// afinidad, "quién se libera primero", carriles de prioridad y la cascada de Low.
// Mismo lenguaje visual que el gantt de Team: fila de semana, líneas punteadas, fines de
// semana sombreados, barras de 32px y leyenda abajo. En la guía el nombre va DENTRO de la barra.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { Icon, PiArrowLeft, PiArrowRight, PiArrowsClockwise, PiPlayCircle } from '@/lib/icons'
import { useGuide } from './i18n'

type Prio = 'normal' | 'low' | 'high' | 'urgent'
type MemberId = 'A' | 'B' | 'C'
interface Bar {
  id: string
  m: MemberId
  start: number
  span: number
  prio: Prio
  step: number // índice en t.example.steps → de ahí sale el nombre de la tarea
}

const AVATARS: Record<MemberId, string> = {
  A: 'https://i.pravatar.cc/120?img=12',
  B: 'https://i.pravatar.cc/120?img=47',
  C: 'https://i.pravatar.cc/120?img=32',
}

const PRIO_BAR: Record<Prio, string> = {
  normal: 'bg-primary-500/90 text-white',
  low: 'bg-neutral-400/85 text-white dark:bg-neutral-300/85 dark:text-neutral-950',
  high: 'bg-warning-500/90 text-warning-950',
  urgent: 'bg-error-500/90 text-white',
}
const PRIO_DOT: Record<Prio, string> = {
  normal: 'bg-primary-500',
  low: 'bg-neutral-400',
  high: 'bg-warning-500',
  urgent: 'bg-error-500',
}

// Estado del gantt DESPUÉS de cada paso (0 = semana vacía). Hecho a mano para que coincida con
// el criterio del motor (afinidad → fecha → carriles → cascada de Low). El newsletter (Low) se
// crea en mar y la cascada lo empuja a mié cuando llega el Normal "Investor deck".
const home: Bar = { id: 'home', m: 'A', start: 0, span: 2, prio: 'normal', step: 0 }
const onb: Bar = { id: 'onb', m: 'B', start: 0, span: 2, prio: 'normal', step: 1 }
const brand: Bar = { id: 'brand', m: 'C', start: 0, span: 1, prio: 'normal', step: 2 }
const one: Bar = { id: 'one', m: 'C', start: 1, span: 1, prio: 'normal', step: 3 }
// Paralelas: launch (High) corre a la vez que el Normal de B; hotfix (Urgent) a la vez que el de A.
const launch: Bar = { id: 'launch', m: 'B', start: 0, span: 1, prio: 'high', step: 4 }
const hotfix: Bar = { id: 'hotfix', m: 'A', start: 0, span: 1, prio: 'urgent', step: 5 }
const deck: Bar = { id: 'deck', m: 'C', start: 2, span: 1, prio: 'normal', step: 7 }
const news = (start: number): Bar => ({ id: 'news', m: 'C', start, span: 1, prio: 'low', step: 6 })

const STATES: Bar[][] = [
  [],
  [home],
  [home, onb],
  [home, onb, brand],
  [home, onb, brand, one],
  [home, onb, brand, one, launch], // High en PARALELO sobre el Normal de B (apilado)
  [home, onb, brand, one, launch, hotfix], // Urgent en PARALELO sobre el Normal de A (apilado)
  [home, onb, brand, one, launch, hotfix, news(2)],
  [home, onb, brand, one, launch, hotfix, deck, news(3)], // cascada: el Low pasa mié → jue
]

// Reparte barras que SE SOLAPAN (paralelas) en sub-carriles apilados (cada lane = primera
// fila libre donde no se solapa con la anterior), para que no queden una encima de otra.
function allocLanes(items: { l: number; r: number }[]): { lane: number[]; count: number } {
  const order = items.map((it, i) => ({ i, l: it.l, r: it.r })).sort((a, b) => a.l - b.l)
  const ends: number[] = []
  const lane = new Array(items.length).fill(0) as number[]
  for (const it of order) {
    let k = ends.findIndex((e) => it.l >= e)
    if (k === -1) {
      k = ends.length
      ends.push(it.r)
    } else {
      ends[k] = it.r
    }
    lane[it.i] = k
  }
  return { lane, count: Math.max(1, ends.length) }
}
const COLS = 7
const LAST = STATES.length - 1
const WEEK_H = 24
const DAY_H = 36
const ROW_H = 52

export function WorkedExample() {
  const { t, lang } = useGuide()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Auto-play: avanza un paso cada 1.6 s hasta el final.
  useEffect(() => {
    if (!playing) return
    if (step >= LAST) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStep((s) => Math.min(LAST, s + 1)), 1600)
    return () => clearTimeout(id)
  }, [playing, step])

  const dayWd = lang === 'es'
    ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayNum = ['16', '17', '18', '19', '20', '21', '22']
  const weekendBg =
    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(148,163,184,0.16) 4px, rgba(148,163,184,0.16) 8px)'

  const bars = STATES[step]
  const activeStep = step > 0 ? t.example.steps[step - 1] : null
  const highlighted = Boolean((activeStep as { highlight?: boolean } | null)?.highlight)

  const goPrev = () => {
    setPlaying(false)
    setStep((s) => Math.max(0, s - 1))
  }
  const goNext = () => {
    setPlaying(false)
    setStep((s) => Math.min(LAST, s + 1))
  }
  const reset = () => {
    setPlaying(false)
    setStep(0)
  }

  return (
    <div className="space-y-4">
      {/* ── Gantt full-width ── */}
      <div className="overflow-hidden rounded-2xl border border-(--color-border-default) bg-(--color-surface-card)">
        <div className="flex">
          {/* Columna de miembros (igual que en la app) */}
          <div className="w-32 shrink-0 sm:w-48">
            <div style={{ height: WEEK_H + DAY_H }} className="border-b border-(--color-border-default)" />
            {t.example.members.map((m) => (
              <div
                key={m.id}
                style={{ height: ROW_H }}
                className="flex items-center gap-2.5 border-b border-(--color-border-default) px-3 last:border-b-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={AVATARS[m.id as MemberId]}
                  alt={m.name}
                  className="size-8 shrink-0 rounded-full object-cover ring-2 ring-(--color-border-default)"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-(--color-text-strong)">{m.name}</div>
                  <div className="hidden truncate text-[11px] text-(--color-text-muted) sm:block">
                    {m.level} · {m.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pista */}
          <div className="min-w-0 flex-1">
            {/* Fila de semana */}
            <div
              style={{ height: WEEK_H }}
              className="flex items-center border-b border-(--color-border-default) px-2.5 text-[11px] font-medium text-(--color-text-muted)"
            >
              {t.example.week}
            </div>
            {/* Header de días */}
            <div style={{ height: DAY_H }} className="flex">
              {dayWd.map((d, i) => (
                <div
                  key={i}
                  style={i >= 5 ? { background: weekendBg } : undefined}
                  className="flex flex-1 flex-col items-center justify-center border-b border-l border-(--color-border-default) text-(--color-text-muted)"
                >
                  <span className="text-[11px] font-medium leading-none">{d}</span>
                  <span className="text-[10px] leading-tight opacity-70">{dayNum[i]}</span>
                </div>
              ))}
            </div>
            {/* Filas con barras */}
            {t.example.members.map((m) => {
              const mBars = bars.filter((b) => b.m === (m.id as MemberId))
              const { lane, count } = allocLanes(mBars.map((b) => ({ l: b.start, r: b.start + b.span })))
              const GAP = 3
              const usableH = ROW_H - 12
              const barH = Math.min(28, (usableH - (count - 1) * GAP) / count)
              const top0 = (ROW_H - (count * barH + (count - 1) * GAP)) / 2
              return (
                <div
                  key={m.id}
                  style={{ height: ROW_H }}
                  className="relative border-b border-(--color-border-default) last:border-b-0"
                >
                  {/* Líneas de día (punteadas) + fines de semana sombreados */}
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: COLS }).map((_, i) => (
                      <div
                        key={i}
                        style={i >= 5 ? { background: weekendBg } : undefined}
                        className="flex-1 border-l border-dashed border-(--color-border-default)/70"
                      />
                    ))}
                  </div>
                  {/* Barras del miembro — apiladas (sub-carriles) si corren en paralelo */}
                  <AnimatePresence>
                    {mBars.map((b, idx) => (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                        style={{
                          left: `calc(${(b.start / COLS) * 100}% + 3px)`,
                          width: `calc(${(b.span / COLS) * 100}% - 6px)`,
                          top: top0 + lane[idx] * (barH + GAP),
                          height: barH,
                        }}
                        className={cn(
                          'absolute flex items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold shadow-sm',
                          PRIO_BAR[b.prio],
                        )}
                      >
                        <span className="truncate">{t.example.steps[b.step].task}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>

        {/* Leyenda abajo */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-(--color-border-default) px-3 py-2.5">
          {(['normal', 'low', 'high', 'urgent'] as Prio[]).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 text-[11px] text-(--color-text-muted)">
              <span className={cn('size-2.5 rounded-full', PRIO_DOT[p])} />
              {t.example.legend[p]}
            </span>
          ))}
        </div>
      </div>

      {/* ── Barra de control + explicación ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-border-default) bg-(--color-surface-card) p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {activeStep ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        highlighted ? 'bg-primary-500/15 text-primary-600' : 'bg-(--color-surface-subtle) text-(--color-text-muted)',
                      )}
                    >
                      {highlighted ? '★ ' : ''}
                      {activeStep.meta}
                    </span>
                    <h4 className="text-base font-semibold text-(--color-text-strong)">{activeStep.task}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-(--color-text-muted)">{activeStep.why}</p>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-(--color-text-muted)">{t.example.start}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* dots */}
          <div className="hidden items-center gap-1 sm:flex">
            {STATES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Step ${i}`}
                onClick={() => {
                  setPlaying(false)
                  setStep(i)
                }}
                className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-primary-500' : 'w-1.5 bg-(--color-border-strong) hover:bg-(--color-text-muted)')}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0}
              aria-label={t.example.prev}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-(--color-border-default) text-(--color-text-default) transition-colors hover:bg-(--color-surface-subtle) disabled:opacity-40"
            >
              <Icon icon={PiArrowLeft} size={16} />
            </button>
            {step >= LAST ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-surface-subtle) px-3 py-2 text-sm font-semibold text-(--color-text-strong) transition-colors hover:bg-(--color-surface-hover)"
              >
                <Icon icon={PiArrowsClockwise} size={16} />
                {t.example.reset}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? t.example.pause : t.example.play}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-(--color-border-default) text-(--color-text-default) transition-colors hover:bg-(--color-surface-subtle)"
                >
                  {playing ? (
                    <span className="flex gap-[3px]">
                      <span className="h-3.5 w-1 rounded-sm bg-current" />
                      <span className="h-3.5 w-1 rounded-sm bg-current" />
                    </span>
                  ) : (
                    <Icon icon={PiPlayCircle} size={18} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  {t.example.next}
                  <Icon icon={PiArrowRight} size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

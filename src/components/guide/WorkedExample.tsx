'use client'
// Ejemplo interactivo del motor: 3 miembros, una semana, y un stepper que crea tareas
// y muestra (con un mini-gantt animado) cómo el motor las coloca. Las barras se animan con
// framer-motion; la cascada de Low (paso final) se ve como un deslizamiento lateral (layout).
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { Icon, PiArrowLeft, PiArrowRight, PiArrowsClockwise } from '@/lib/icons'
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

// Avatares realistas (servicio de placeholders) + acento por miembro.
const AVATARS: Record<MemberId, string> = {
  A: 'https://i.pravatar.cc/120?img=12',
  B: 'https://i.pravatar.cc/120?img=47',
  C: 'https://i.pravatar.cc/120?img=32',
}

const PRIO_BAR: Record<Prio, string> = {
  normal: 'bg-primary-500/90 text-white',
  low: 'bg-neutral-400/80 text-white dark:bg-neutral-300/80',
  high: 'bg-warning-500/90 text-warning-950',
  urgent: 'bg-error-500/90 text-white',
}
const PRIO_DOT: Record<Prio, string> = {
  normal: 'bg-primary-500',
  low: 'bg-neutral-400',
  high: 'bg-warning-500',
  urgent: 'bg-error-500',
}

// Estado del gantt DESPUÉS de cada paso (0 = semana vacía). Hecho a mano para que coincida
// con el criterio del motor (afinidad → fecha → carriles → cascada de Low).
const homepage: Bar = { id: 'homepage', m: 'A', start: 0, span: 2, prio: 'normal', step: 0 }
const onboarding: Bar = { id: 'onboarding', m: 'B', start: 0, span: 1, prio: 'normal', step: 1 }
const onepager: Bar = { id: 'onepager', m: 'C', start: 0, span: 1, prio: 'normal', step: 2 }
const STATES: Bar[][] = [
  [],
  [homepage],
  [homepage, onboarding],
  [homepage, onboarding, onepager],
  [homepage, onboarding, onepager, { id: 'newsletter', m: 'B', start: 1, span: 1, prio: 'low', step: 3 }],
  [
    homepage,
    onboarding,
    onepager,
    { id: 'deck', m: 'B', start: 1, span: 1, prio: 'normal', step: 4 },
    { id: 'newsletter', m: 'B', start: 2, span: 1, prio: 'low', step: 3 }, // empujado mar → mié
  ],
]
const COLS = 5

export function WorkedExample() {
  const { t, lang } = useGuide()
  const [step, setStep] = useState(0) // 0..5

  const dayNames = lang === 'es' ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const dayNums = ['16', '17', '18', '19', '20']
  const bars = STATES[step]
  const activeStep = step > 0 ? t.example.steps[step - 1] : null
  const highlighted = Boolean((activeStep as { highlight?: boolean } | null)?.highlight)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)] lg:items-start">
      {/* Mini-gantt */}
      <div className="overflow-hidden rounded-2xl border border-(--color-border-default) bg-(--color-surface-card)">
        <div className="flex">
          {/* Columna de miembros */}
          <div className="w-32 shrink-0 sm:w-44">
            <div className="h-10 border-b border-(--color-border-default)" />
            {t.example.members.map((m) => (
              <div key={m.id} className="flex h-16 items-center gap-2.5 border-b border-(--color-border-default) px-3 last:border-b-0">
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

          {/* Pista (header de días + filas con barras) */}
          <div className="min-w-0 flex-1">
            {/* Header de días */}
            <div className="flex h-10">
              {dayNames.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center justify-center border-b border-l border-(--color-border-default) text-(--color-text-muted)"
                >
                  <span className="text-[11px] font-medium leading-none">{d}</span>
                  <span className="text-[10px] leading-tight opacity-70">{dayNums[i]}</span>
                </div>
              ))}
            </div>
            {/* Filas */}
            {t.example.members.map((m) => (
              <div key={m.id} className="relative h-16 border-b border-(--color-border-default) last:border-b-0">
                {/* Líneas de día */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: COLS }).map((_, i) => (
                    <div key={i} className="flex-1 border-l border-(--color-border-default)/60" />
                  ))}
                </div>
                {/* Barras del miembro */}
                <AnimatePresence>
                  {bars
                    .filter((b) => b.m === (m.id as MemberId))
                    .map((b) => (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        style={{
                          left: `calc(${(b.start / COLS) * 100}% + 4px)`,
                          width: `calc(${(b.span / COLS) * 100}% - 8px)`,
                        }}
                        className={cn(
                          'absolute top-1/2 flex h-9 -translate-y-1/2 items-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold shadow-sm',
                          PRIO_BAR[b.prio],
                        )}
                      >
                        <span className="truncate">{t.example.steps[b.step].task}</span>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-(--color-border-default) px-3 py-2.5">
          {(['normal', 'low', 'high', 'urgent'] as Prio[]).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 text-[11px] text-(--color-text-muted)">
              <span className={cn('size-2.5 rounded-full', PRIO_DOT[p])} />
              {t.example.legend[p]}
            </span>
          ))}
        </div>
      </div>

      {/* Panel del paso actual */}
      <div className="flex flex-col gap-4 rounded-2xl border border-(--color-border-default) bg-(--color-surface-card) p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
            {step}/{STATES.length - 1}
          </span>
          <div className="flex gap-1.5">
            {STATES.map((_, i) => (
              <span
                key={i}
                className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-primary-500' : 'w-1.5 bg-(--color-border-strong)')}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="min-h-[150px]"
          >
            {activeStep ? (
              <div className="flex flex-col gap-2">
                <div
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    highlighted
                      ? 'bg-primary-500/15 text-primary-600'
                      : 'bg-(--color-surface-subtle) text-(--color-text-muted)',
                  )}
                >
                  {highlighted ? '★ ' : ''}
                  {activeStep.meta}
                </div>
                <h4 className="text-lg font-semibold text-(--color-text-strong)">{activeStep.task}</h4>
                <p className="text-sm leading-relaxed text-(--color-text-default)">{activeStep.why}</p>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <p className="text-sm leading-relaxed text-(--color-text-muted)">{t.example.start}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-(--color-border-default) text-(--color-text-default) transition-colors hover:bg-(--color-surface-subtle) disabled:opacity-40"
            aria-label={t.example.prev}
          >
            <Icon icon={PiArrowLeft} size={16} />
          </button>
          {step === STATES.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-(--color-surface-subtle) px-4 py-2 text-sm font-semibold text-(--color-text-strong) transition-colors hover:bg-(--color-surface-hover)"
            >
              <Icon icon={PiArrowsClockwise} size={16} />
              {t.example.reset}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STATES.length - 1, s + 1))}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              {t.example.next}
              <Icon icon={PiArrowRight} size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

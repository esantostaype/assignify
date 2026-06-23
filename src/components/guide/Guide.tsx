'use client'
// Guía interactiva de Assignify: layout propio (distinto a la app), bilingüe (EN/ES) y con
// tema claro/oscuro (el global). Recorrido paso a paso: login → setup → settings → cómo
// asigna el motor → ejemplo en vivo → crear una tarea. Animaciones con framer-motion.
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Icon, PiArrowRight, PiGlobe, PiCheck } from '@/lib/icons'
import { useGuide, type Lang } from './i18n'
import { WorkedExample } from './WorkedExample'
import { LoginFlow, SetupMocks, SettingsMock, CriteriaFlow, CreateFlow } from './mocks'

const SECTION_IDS = ['login', 'setup', 'settings', 'criteria', 'example', 'create'] as const

// ── Reveal on scroll ──────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.32, 0.72, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Language pill (EN | ES) ─────────────────────────────────────────────────────
function LangToggle() {
  const { lang, setLang, t } = useGuide()
  const OPTS: { id: Lang; label: string }[] = [
    { id: 'en', label: 'EN' },
    { id: 'es', label: 'ES' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={t.topbar.langLabel}
      className="inline-flex items-center gap-0.5 rounded-full border border-(--color-border-default) bg-(--color-surface-subtle) p-0.5"
    >
      <Icon icon={PiGlobe} size={14} className="ml-1.5 mr-0.5 text-(--color-text-muted)" />
      {OPTS.map((o) => {
        const active = lang === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLang(o.id)}
            className={cn(
              'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold transition-colors',
              active ? 'bg-(--color-surface-card) text-(--color-text-strong) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-default)',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Section heading with index ──────────────────────────────────────────────────
function SectionHead({ index, title, lead }: { index: number; title: string; lead: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-500">
        <span className="grid size-6 place-items-center rounded-full bg-primary-500/12 text-xs">{index}</span>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-(--color-text-strong) sm:text-3xl">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-(--color-text-muted)">{lead}</p>
    </div>
  )
}

export function Guide() {
  const { t } = useGuide()
  const [active, setActive] = useState<string>('login')

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    )
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen scroll-smooth bg-(--color-surface-app) text-(--color-text-default)">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 border-b border-(--color-border-default) bg-(--color-surface-app)/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Logo width={116} height={34} />
            <span className="hidden rounded-full bg-(--color-surface-subtle) px-2.5 py-1 text-xs font-semibold text-(--color-text-muted) sm:inline">
              {t.topbar.guide}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LangToggle />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <span className="hidden sm:inline">{t.topbar.back}</span>
              <Icon icon={PiArrowRight} size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[-30%] mx-auto h-[480px] max-w-3xl rounded-full bg-primary-500/20 blur-[120px]"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-center lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-(--color-border-default) bg-(--color-surface-card) px-3 py-1.5 text-xs font-semibold text-primary-500">
              <span className="size-1.5 rounded-full bg-primary-500" />
              {t.hero.badge}
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-(--color-text-strong) sm:text-5xl lg:text-6xl">
              {t.hero.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-(--color-text-muted)">{t.hero.subtitle}</p>
            <a
              href="#login"
              className="mt-9 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-colors hover:bg-primary-700"
            >
              {t.hero.scroll}
              <Icon icon={PiArrowRight} size={16} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Body: side nav + sections ── */}
      <div className="mx-auto max-w-6xl px-5 pb-28 lg:px-8">
        <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-14">
          {/* Side nav (scrollspy) */}
          <nav className="sticky top-24 hidden h-fit lg:block">
            <ul className="space-y-1 border-l border-(--color-border-default)">
              {SECTION_IDS.map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={cn(
                      '-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors',
                      active === id
                        ? 'border-primary-500 font-semibold text-(--color-text-strong)'
                        : 'border-transparent text-(--color-text-muted) hover:text-(--color-text-default)',
                    )}
                  >
                    {t.nav[id]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sections */}
          <div className="min-w-0 space-y-24 pt-8 lg:space-y-32 lg:pt-4">
            {/* 1 · Login */}
            <section id="login" className="scroll-mt-24">
              <SectionHead index={1} title={t.login.title} lead={t.login.lead} />
              <Reveal>
                <LoginFlow />
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 rounded-xl border border-dashed border-(--color-border-default) px-4 py-3 text-sm text-(--color-text-muted)">
                  💡 {t.login.note}
                </p>
              </Reveal>
            </section>

            {/* 2 · Setup */}
            <section id="setup" className="scroll-mt-24">
              <SectionHead index={2} title={t.setup.title} lead={t.setup.lead} />
              <Reveal>
                <SetupMocks />
              </Reveal>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {t.setup.items.map((it, i) => (
                  <p key={i} className="text-sm leading-relaxed text-(--color-text-muted)">
                    {it.body}
                  </p>
                ))}
              </div>
            </section>

            {/* 3 · Settings */}
            <section id="settings" className="scroll-mt-24">
              <SectionHead index={3} title={t.settings.title} lead={t.settings.lead} />
              <Reveal className="mb-6">
                <SettingsMock />
              </Reveal>
              <div className="space-y-4">
                {t.settings.groups.map((g, i) => (
                  <Reveal key={i} delay={i * 0.05}>
                    <div className="rounded-2xl border border-(--color-border-default) bg-(--color-surface-card) p-5">
                      <h3 className="text-lg font-semibold text-(--color-text-strong)">{g.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-(--color-text-muted)">{g.desc}</p>
                      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {g.fields.map((f, j) => (
                          <div key={j} className="rounded-lg bg-(--color-surface-subtle) p-3">
                            <dt className="text-sm font-semibold text-(--color-text-default)">{f.label}</dt>
                            <dd className="mt-0.5 text-xs leading-relaxed text-(--color-text-muted)">{f.desc}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            {/* 4 · Criteria */}
            <section id="criteria" className="scroll-mt-24">
              <SectionHead index={4} title={t.criteria.title} lead={t.criteria.lead} />
              <Reveal className="mb-8">
                <CriteriaFlow />
              </Reveal>
              <div className="grid gap-8 lg:grid-cols-2">
                <Reveal>
                  <div className="rounded-2xl border border-(--color-border-default) bg-(--color-surface-card) p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-(--color-text-strong)">
                      <span className="grid size-7 place-items-center rounded-lg bg-primary-500/12 text-sm font-bold text-primary-500">?</span>
                      {t.criteria.whoTitle}
                    </h3>
                    <ul className="space-y-4">
                      {t.criteria.who.map((w, i) => (
                        <li key={i} className="border-l-2 border-primary-500/40 pl-3.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary-500">{w.k}</div>
                          <div className="text-sm font-semibold text-(--color-text-strong)">{w.t}</div>
                          <p className="mt-0.5 text-sm leading-relaxed text-(--color-text-muted)">{w.d}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
                <Reveal delay={0.08}>
                  <div className="rounded-2xl border border-(--color-border-default) bg-(--color-surface-card) p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-(--color-text-strong)">
                      <span className="grid size-7 place-items-center rounded-lg bg-warning-500/15 text-sm font-bold text-warning-600">⏱</span>
                      {t.criteria.whenTitle}
                    </h3>
                    <ul className="space-y-4">
                      {t.criteria.when.map((w, i) => (
                        <li key={i} className="border-l-2 border-warning-500/40 pl-3.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-warning-600">{w.k}</div>
                          <div className="text-sm font-semibold text-(--color-text-strong)">{w.t}</div>
                          <p className="mt-0.5 text-sm leading-relaxed text-(--color-text-muted)">{w.d}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
            </section>

            {/* 5 · Live example */}
            <section id="example" className="scroll-mt-24">
              <SectionHead index={5} title={t.example.title} lead={t.example.lead} />
              <Reveal>
                <WorkedExample />
              </Reveal>
            </section>

            {/* 6 · Create */}
            <section id="create" className="scroll-mt-24">
              <SectionHead index={6} title={t.create.title} lead={t.create.lead} />
              <Reveal className="mb-6">
                <CreateFlow />
              </Reveal>
              <div className="grid gap-3 sm:grid-cols-2">
                {t.create.fields.map((f, i) => (
                  <Reveal key={i} delay={i * 0.04}>
                    <div className="flex items-start gap-3 rounded-xl border border-(--color-border-default) bg-(--color-surface-card) p-4">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-500/15 text-success-600">
                        <Icon icon={PiCheck} size={12} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-(--color-text-strong)">{f.label}</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-(--color-text-muted)">{f.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.1}>
                <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-(--color-border-default) bg-gradient-to-br from-primary-500/10 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-sm leading-relaxed text-(--color-text-default)">{t.create.outro}</p>
                  <Link
                    href="/"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    {t.create.cta}
                    <Icon icon={PiArrowRight} size={16} />
                  </Link>
                </div>
              </Reveal>
            </section>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-(--color-border-default) py-8">
        <div className="mx-auto max-w-6xl px-5 text-center text-sm text-(--color-text-muted) lg:px-8">{t.footer}</div>
      </footer>
    </div>
  )
}

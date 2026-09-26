'use client'
// src/components/SmoothScroll.tsx
// Scroll suave (Lenis — motor de Locomotive Scroll v5, respeta sticky) + scrollbar
// OVERLAY custom: el nativo se oculta (no ocupa espacio ni trae flechas) y dibujamos
// un thumb propio en position:absolute, color sutil, encima del contenido. Solo se ve
// al scrollear con la ruedita o al acercar el mouse al borde derecho; es arrastrable.
// Red de seguridad: si Lenis falla, el wrapper conserva overflow-y-auto nativo.
import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { cn } from '@/lib/cn'

export function SmoothScroll({
  children,
  className,
  contentClassName = '',
  preventParentLenis = false,
}: {
  children: React.ReactNode
  className?: string
  /** Clase del wrapper de contenido. El shell pasa 'flex h-full flex-col' para que
   *  una página (tablero) pueda LLENAR el alto; los scrollers anidados lo dejan vacío
   *  (contenido de alto natural que hace scroll). */
  contentClassName?: string
  /** Scrollers anidados dentro de otro SmoothScroll (columnas): marca el wrapper con
   *  data-lenis-prevent para que el Lenis exterior ignore su wheel. */
  preventParentLenis?: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const content = contentRef.current
    const thumb = thumbRef.current
    if (!wrapper || !thumb) return

    const MARGIN = 4 // aire arriba/abajo del thumb
    let dragging = false
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    const show = () => {
      thumb.classList.add('is-visible')
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        if (!dragging) thumb.classList.remove('is-visible')
      }, 1200)
    }

    const metrics = () => {
      const { scrollHeight, clientHeight } = wrapper
      const trackH = clientHeight - MARGIN * 2
      const thumbH = Math.max(28, (clientHeight / scrollHeight) * trackH)
      const maxTop = Math.max(0, trackH - thumbH)
      return { scrollHeight, clientHeight, thumbH, maxTop }
    }

    const update = () => {
      const { scrollHeight, clientHeight, thumbH, maxTop } = metrics()
      if (scrollHeight <= clientHeight + 1) {
        thumb.style.opacity = '0' // nada que scrollear → thumb oculto
        return
      }
      thumb.style.opacity = '' // deja que .is-visible controle la visibilidad
      const ratio = wrapper.scrollTop / (scrollHeight - clientHeight)
      const top = Math.max(0, Math.min(maxTop, ratio * maxTop))
      thumb.style.height = `${thumbH}px`
      thumb.style.transform = `translateY(${top}px)`
    }

    const onScroll = () => {
      update()
      show()
    }
    wrapper.addEventListener('scroll', onScroll, { passive: true })

    const onMove = (e: MouseEvent) => {
      const r = wrapper.getBoundingClientRect()
      if (r.right - e.clientX <= 40) show()
    }
    wrapper.addEventListener('mousemove', onMove)

    // ── Smooth scroll (Lenis) ────────────────────────────────────────────────
    let lenis: Lenis | null = null
    let raf = 0
    try {
      lenis = new Lenis({
        wrapper,
        content: content ?? wrapper,
        duration: 1.05,
        smoothWheel: true,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      })
      const loop = (time: number) => {
        lenis?.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    } catch {
      /* sin smooth: overflow-y-auto nativo sigue */
    }

    // ── Drag del thumb ───────────────────────────────────────────────────────
    let startY = 0
    let startScroll = 0
    const onThumbDown = (e: MouseEvent) => {
      dragging = true
      startY = e.clientY
      startScroll = wrapper.scrollTop
      thumb.classList.add('is-visible')
      document.body.style.userSelect = 'none'
      e.preventDefault()
    }
    const onDocMove = (e: MouseEvent) => {
      if (!dragging) return
      const { scrollHeight, clientHeight, maxTop } = metrics()
      if (maxTop <= 0) return
      const dy = e.clientY - startY
      const target = startScroll + (dy / maxTop) * (scrollHeight - clientHeight)
      const clamped = Math.max(0, Math.min(scrollHeight - clientHeight, target))
      if (lenis) lenis.scrollTo(clamped, { immediate: true })
      else wrapper.scrollTop = clamped
    }
    const onDocUp = () => {
      if (!dragging) return
      dragging = false
      document.body.style.userSelect = ''
      show()
    }
    thumb.addEventListener('mousedown', onThumbDown)
    document.addEventListener('mousemove', onDocMove)
    document.addEventListener('mouseup', onDocUp)

    // Recalcular al cambiar el tamaño del contenido/viewport.
    const ro = new ResizeObserver(update)
    ro.observe(wrapper)
    if (content) ro.observe(content)

    update()

    return () => {
      wrapper.removeEventListener('scroll', onScroll)
      wrapper.removeEventListener('mousemove', onMove)
      thumb.removeEventListener('mousedown', onThumbDown)
      document.removeEventListener('mousemove', onDocMove)
      document.removeEventListener('mouseup', onDocUp)
      ro.disconnect()
      if (hideTimer) clearTimeout(hideTimer)
      if (raf) cancelAnimationFrame(raf)
      lenis?.destroy()
    }
  }, [])

  return (
    // outer = flex-col: el wrapper acota por FLEX (flex-1 min-h-0), no por % (h-full),
    // así funciona tanto con padres de alto definido (shell) como por flex (modal/drawer
    // con max-h auto, donde h-full NO resolvía → no scrolleaba y tapaba el footer).
    <div className={cn('relative flex h-full min-h-0 flex-col', className)}>
      <div
        ref={wrapperRef}
        data-lenis-prevent={preventParentLenis ? '' : undefined}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-[inherit]"
      >
        <div ref={contentRef} className={contentClassName}>{children}</div>
      </div>
      <div ref={thumbRef} className="smooth-thumb" aria-hidden />
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/notifications.ts
// Notificaciones nativas del navegador + sonido para eventos en tiempo real.

let audioCtx: AudioContext | null = null

/** Pide permiso de notificaciones tras el primer gesto del usuario (política de Chrome). */
export function requestNotificationPermission(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'default') return

  const ask = () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    window.removeEventListener('click', ask)
    window.removeEventListener('keydown', ask)
  }
  // Chrome ignora el prompt sin interacción; lo pedimos al primer clic/tecla.
  window.addEventListener('click', ask, { once: true })
  window.addEventListener('keydown', ask, { once: true })
}


/** Reproduce un "ding-dong" corto con Web Audio (no requiere archivos). */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    // Los navegadores suspenden el audio hasta que hay interacción del usuario.
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})

    const now = audioCtx.currentTime

    // Ganancia maestra alta para que se escuche bien.
    const master = audioCtx.createGain()
    master.gain.value = 0.85
    master.connect(audioCtx.destination)

    // Campanada doble ascendente con cuerpo (triangle) y buen sustain.
    const tones = [
      { freq: 784, at: 0, dur: 0.22 },
      { freq: 1047, at: 0.18, dur: 0.4 },
    ]
    for (const { freq, at, dur } of tones) {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(master)
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.9, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
      osc.start(now + at)
      osc.stop(now + at + dur + 0.05)
    }
  } catch {
    // Silencioso si el navegador bloquea el audio.
  }
}

/** Muestra una notificación del sistema (si el usuario dio permiso). */
export function showBrowserNotification(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const notification = new Notification(title, {
      body,
      icon: '/images/logo.svg',
      tag: 'assignify-task-update',
      renotify: true,
    } as any)
    // Al hacer clic, enfocar la pestaña de la app.
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // ignore
  }
}

/** Notifica un cambio de tarea: notificación del sistema + sonido. */
export function notifyTaskChange(title: string, body?: string): void {
  showBrowserNotification(title, body)
  playNotificationSound()
}

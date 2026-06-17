// src/utils/notifications.ts
// Notificaciones nativas del navegador + sonido (public/images/alert.mp3) para
// eventos en tiempo real.

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

// Elemento de audio reutilizado para el sonido de alerta.
let alertAudio: HTMLAudioElement | null = null

/** Reproduce el sonido de alerta (public/images/alert.mp3). */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return
  try {
    if (!alertAudio) {
      alertAudio = new Audio('/images/alert.mp3')
      alertAudio.volume = 0.7
    }
    alertAudio.currentTime = 0
    // El navegador bloquea autoplay sin interacción previa; si falla, silencioso.
    void alertAudio.play().catch(() => {})
  } catch {
    // ignore
  }
}

/** Muestra una notificación del sistema (si el usuario dio permiso). */
export function showBrowserNotification(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    // Sin `tag`: cada notificación es independiente y se acumula (no se reemplazan).
    const notification = new Notification(title, {
      body,
      icon: '/images/logo.svg',
    })
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

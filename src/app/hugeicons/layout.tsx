import { UiThemeProvider } from '@/providers/UiThemeProvider'
import { HotToaster } from '@/lib/hotToast'

// Layout RAÍZ de Hugeicons: es una herramienta de referencia INDEPENDIENTE del resto de
// la app y de Auth.js — tiene su PROPIO login (username/password del .env), protegido por
// el middleware + /api/hugeicons. Aquí solo montamos el tema (para el ThemeToggle y las
// CSS vars); NO montamos SessionProvider, Realtime ni Onboarding (todo eso es de la app
// principal). Envuelve tanto la pantalla de login como el contenido protegido (gallery).
export default function HugeiconsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <UiThemeProvider>
      {children}
      <HotToaster />
    </UiThemeProvider>
  )
}

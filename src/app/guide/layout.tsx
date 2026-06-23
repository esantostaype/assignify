import { UiThemeProvider } from '@/providers/UiThemeProvider'
import { GuideLangProvider } from '@/components/guide/i18n'

export const metadata = {
  title: 'Assignify — Guide',
  description: 'Interactive, step-by-step guide to Assignify: sign in, set up, settings, how the assignment engine works, a live example and creating a task.',
}

// Layout PROPIO de la guía (fuera del shell de la app): solo el tema (global) + el idioma
// (local a la guía). Ruta pública (ver auth.config) para que se pueda leer sin login.
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <UiThemeProvider>
      <GuideLangProvider>{children}</GuideLangProvider>
    </UiThemeProvider>
  )
}

import { SettingsForm } from '@/components'

export default function PageSettings() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-16 z-50 bg-(--color-surface-header) backdrop-blur-lg">
        <div className="flex items-center gap-2 border-b border-(--color-border-default) p-4">
          <h1 className="text-xl text-(--color-text-strong)">Settings</h1>
        </div>
      </div>
      {/* flex-1 en toda la cadena para que el estado de carga del form se centre en el
          área de contenido (no en todo el alto del site). */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
          <SettingsForm />
        </div>
      </div>
    </div>
  )
}
